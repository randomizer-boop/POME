// Recurring rules are *planned* money. They never count as actual income/expenses —
// only the transaction that pays (or receives) them does, once it exists.
// Rules with category "Income" are expected income (salary); all others are bills.
import type { Period, RecurringPayment, Transaction } from '../../shared/types';
import { add, sub, sum, sumBy } from '../../shared/money';
import { isoDay } from '../../shared/config';
import { addDays, parseIso, prevMonthStart, toIso } from '../../shared/dates';

export const isIncomeRule = (r: RecurringPayment) => r.category === 'Income';
export const isBillRule = (r: RecurringPayment) => !isIncomeRule(r);

export type RecurringStatus = 'paid' | 'upcoming' | 'overdue' | 'paused';

// ─── Occurrences and what paid them ───────────────────────────────────────────
// A rule produces one occurrence per month (or year). Payments are matched to occurrences
// explicitly, not by calendar month:
//   • a payment is a transaction linked to the rule (recurringId), or an unlinked one that
//     clearly is it — same direction, same category, same account, amount ±2%;
//   • payments are applied oldest-first (FIFO) to occurrences that are already owed or come
//     within PREPAY_DAYS — so paying on 29 Sep closes the 5 Oct bill if September's is paid
//     (or wasn't owed), and a late payment closes the overdue one first;
//   • a rule is owed from the day it was created (or its first payment, if earlier) — a salary
//     or bill added on the 29th isn't "overdue since the 5th";
//   • partial payments reduce what's left; ±2% counts as fully paid.

/** A payment may close an occurrence at most this many days before its due date */
export const PREPAY_DAYS = 35;
const TOLERANCE = 0.02;

const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
/** Charge day clamped to the month length (e.g. 31 → 30 in September) */
const chargeDay = (r: RecurringPayment, year: number, month: number) => Math.min(r.day, daysInMonth(year, month));

export const isDueInPeriod = (r: RecurringPayment, p: Period) =>
  r.frequency === 'monthly' || r.month === p.index;

/** Dates a rule is due on between `from` and `to` (inclusive, ISO) */
export function occurrences(r: RecurringPayment, from: string, to: string): string[] {
  const out: string[] = [];
  const start = parseIso(from), end = parseIso(to);
  for (let d = new Date(start.getFullYear(), start.getMonth(), 1); d <= end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    if (r.frequency === 'yearly' && d.getMonth() !== (r.month ?? 0)) continue;
    const iso = toIso(new Date(d.getFullYear(), d.getMonth(), chargeDay(r, d.getFullYear(), d.getMonth())));
    if (iso >= from && iso <= to) out.push(iso);
  }
  return out;
}

export interface Occurrence {
  rule: RecurringPayment;
  date: string;
  /** already paid / received toward it (never more than the amount) */
  paid: number;
  /** still to pay / receive (0 when settled) */
  remaining: number;
  settled: boolean;
  /** false for dates before the rule existed — nothing is owed for them */
  owed: boolean;
}

const sameDirection = (r: RecurringPayment, t: Transaction) => (isIncomeRule(r) ? t.amount > 0 : t.amount < 0);
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const amountGap = (r: RecurringPayment, t: Transaction) => Math.abs(Math.abs(t.amount) - r.amount) / Math.max(r.amount, 0.01);
const nameHit = (r: RecurringPayment, t: Transaction) => {
  const a = norm(r.name), b = norm(t.description);
  return !!a && !!b && (a.includes(b) || b.includes(a));
};
/** An unlinked transaction that clearly is this rule's payment (no guessing on "any 300 000") */
function autoMatches(r: RecurringPayment, t: Transaction): boolean {
  if (t.recurringId || !sameDirection(r, t) || amountGap(r, t) > TOLERANCE) return false;
  // income: same category or the same name (a salary added by hand); bills: same category AND account
  return isIncomeRule(r) ? t.category === r.category || nameHit(r, t) : t.category === r.category && t.accountId === r.accountId;
}

/**
 * Occurrences of every rule between `from` and `to`, with payments allocated.
 * `allTxs` is the full history (only what has happened, i.e. up to "today").
 * Payments from the month before `from` are considered too, so an early payment made then
 * (29 Sep for 5 Oct) closes the right occurrence; last month's own bills absorb last month's
 * payments first.
 */
export function schedule(rules: RecurringPayment[], allTxs: Transaction[], from: string, to: string): Map<string, Occurrence[]> {
  const lookback = prevMonthStart(from);
  const used = new Set<string>();
  const out = new Map<string, Occurrence[]>();
  // linked payments first, then auto-matches (each transaction pays one rule only)
  const ordered = [...rules].sort((a, b) => a.day - b.day);
  const linked = new Map(ordered.map(r => [r.id, allTxs.filter(t => t.recurringId === r.id && t.date >= addDays(lookback, -PREPAY_DAYS))]));
  for (const r of ordered) for (const t of linked.get(r.id)!) used.add(t.id);

  for (const r of ordered) {
    const matched = allTxs.filter(t => t.date >= addDays(lookback, -PREPAY_DAYS) && !used.has(t.id) && autoMatches(r, t));
    matched.forEach(t => used.add(t.id));
    const payments = [...linked.get(r.id)!, ...matched].sort((a, b) => a.date.localeCompare(b.date));

    // owed from creation, or from the first payment if it came earlier (e.g. recorded as "already paid")
    const firstPaid = payments[0]?.date;
    const startsOn = r.createdAt && firstPaid && firstPaid < r.createdAt ? firstPaid : r.createdAt ?? null;
    const occ: Occurrence[] = occurrences(r, lookback, to).map(date => {
      const owed = !startsOn || date >= startsOn;
      return { rule: r, date, paid: 0, remaining: owed ? r.amount : 0, settled: !owed, owed };
    });

    for (const t of payments) {
      let left = Math.abs(t.amount);
      for (const o of occ) {
        if (left <= 0) break;
        if (o.settled) continue;
        // last month's occurrences only take last month's payments: they aren't tracked any more,
        // and a new user's unrecorded September must not swallow October's payment
        if (o.date < from && t.date >= from) continue;
        if (addDays(o.date, -PREPAY_DAYS) > t.date) break;          // too far ahead to be this payment
        const take = Math.min(left, o.remaining);
        o.paid = add(o.paid, take);
        o.remaining = sub(o.remaining, take);
        left = sub(left, take);
        if (o.remaining <= r.amount * TOLERANCE) { o.settled = true; o.remaining = 0; }
      }
    }
    out.set(r.id, occ.filter(o => o.date >= from));
  }
  return out;
}

/** The occurrence of `r` in the calendar month of `p` (undefined for yearly rules in other months) */
function occurrenceIn(r: RecurringPayment, txs: Transaction[], p: Period): { occ?: Occurrence; later: Occurrence[] } {
  const from = isoDay(p, 1);
  const to = addDays(from, 800);
  const list = schedule([r], txs, from, to).get(r.id) ?? [];
  return { occ: list.find(o => o.date.slice(0, 7) === from.slice(0, 7)), later: list };
}

export function recurringStatus(r: RecurringPayment, txs: Transaction[], p: Period): RecurringStatus {
  if (!r.active) return 'paused';
  const { occ, later } = occurrenceIn(r, txs, p);
  if (!occ) return 'upcoming';
  if (!occ.owed) return later.find(o => o.owed)?.settled ? 'paid' : 'upcoming';   // added after its day this month
  if (occ.settled) return 'paid';
  return occ.date < isoDay(p, p.current) ? 'overdue' : 'upcoming';
}

/** Date of the next charge that isn't paid yet */
export function nextChargeDate(r: RecurringPayment, txs: Transaction[], p: Period): Date {
  const { later } = occurrenceIn(r, txs, p);
  const next = later.find(o => o.owed && !o.settled);
  return next ? parseIso(next.date) : parseIso(later[later.length - 1]?.date ?? isoDay(p, p.current));
}

/** Left to pay on this month's occurrence (partial payments reduce it) */
export function remainingThisPeriod(r: RecurringPayment, txs: Transaction[], p: Period): number {
  const { occ } = occurrenceIn(r, txs, p);
  return occ ? occ.remaining : 0;
}

export const daysUntil = (d: Date, p: Period) =>
  Math.round((d.getTime() - new Date(p.year, p.index, p.current).getTime()) / 86_400_000);

/** This month's occurrences of the given rules (owed ones only) */
function monthOccurrences(rules: RecurringPayment[], txs: Transaction[], p: Period): Occurrence[] {
  const from = isoDay(p, 1), to = isoDay(p, p.total);
  const map = schedule(rules.filter(r => r.active), txs, from, to);
  return [...map.values()].flat().filter(o => o.owed);
}

/**
 * Active bills still to be paid this month (overdue included) — planned, not yet spent.
 * `amount` is what's LEFT to pay (partial payments taken off). `txs` = full history.
 */
export const unpaidThisPeriod = (rules: RecurringPayment[], txs: Transaction[], p: Period): RecurringPayment[] =>
  monthOccurrences(rules.filter(isBillRule), txs, p)
    .filter(o => !o.settled)
    .map(o => ({ ...o.rule, amount: o.remaining }))
    .sort((a, b) => a.day - b.day);

/** Planned income this month that hasn't arrived yet (linked or clearly matched income counts as arrived) */
export const expectedIncome = (rules: RecurringPayment[], txs: Transaction[], p: Period): number =>
  sumBy(monthOccurrences(rules.filter(isIncomeRule), txs, p).filter(o => !o.settled), o => o.remaining);

export const monthlyEquivalent = (r: RecurringPayment) => (r.frequency === 'yearly' ? r.amount / 12 : r.amount);

/** Bills this month: how much in total, how much already paid, monthly average of all active bills */
export function billsSummary(rules: RecurringPayment[], txs: Transaction[], p: Period) {
  const occ = monthOccurrences(rules.filter(isBillRule), txs, p);
  return {
    total: sumBy(occ, o => o.rule.amount),
    paid: sumBy(occ, o => o.paid),
    perMonth: sum(rules.filter(r => isBillRule(r) && r.active).map(monthlyEquivalent)),
  };
}

export type RecurringDraftError = 'name' | 'amount' | 'day' | null;

export function validateRecurring(name: string, amount: number, day: number): RecurringDraftError {
  if (!name.trim()) return 'name';
  if (!Number.isFinite(amount) || amount <= 0) return 'amount';
  if (!Number.isInteger(day) || day < 1 || day > 31) return 'day';
  return null;
}

/** Days from today to this period's charge day (negative = overdue) */
export const daysToCharge = (r: RecurringPayment, p: Period) => chargeDay(r, p.year, p.index) - p.current;

/** Unpaid payments that need attention now: overdue or due within `withinDays` */
export const urgentBills = (unpaid: RecurringPayment[], p: Period, withinDays = 3) =>
  unpaid.filter(r => daysToCharge(r, p) <= withinDays);

// ─── "Already paid": match a recurring payment to an expense the user already recorded ──

/** This period's unlinked expenses that could be the payment of `r`, best match first (max 5) */
export function paymentCandidates(r: RecurringPayment, txs: Transaction[]): Transaction[] {
  return txs
    .filter(t => sameDirection(r, t) && !t.recurringId)
    .map(t => ({ t, gap: amountGap(r, t), name: nameHit(r, t), cat: t.category === r.category }))
    .filter(x => x.gap <= 0.25 || x.name || x.cat)
    .sort((a, b) => (a.gap - (a.name ? 0.5 : 0) - (a.cat ? 0.2 : 0)) - (b.gap - (b.name ? 0.5 : 0) - (b.cat ? 0.2 : 0)))
    .slice(0, 5)
    .map(x => x.t);
}

/** A near-certain match (same amount ±2% and same category or name) — offered with one click */
export function likelyPayment(r: RecurringPayment, txs: Transaction[]): Transaction | null {
  return paymentCandidates(r, txs).find(t => amountGap(r, t) <= 0.02 && (t.category === r.category || nameHit(r, t))) ?? null;
}
