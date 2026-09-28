// Recurring rules are *planned* money. They never count as actual income/expenses —
// only the transaction that pays (or receives) them does, once it exists.
// Rules with category "Income" are expected income (salary); all others are bills.
import type { Period, RecurringPayment, Transaction } from '../../shared/types';
import { sum, sumBy } from '../../shared/money';

export const isIncomeRule = (r: RecurringPayment) => r.category === 'Income';
export const isBillRule = (r: RecurringPayment) => !isIncomeRule(r);

export type RecurringStatus = 'paid' | 'upcoming' | 'overdue' | 'paused';

const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
/** Charge day clamped to the month length (e.g. 31 → 30 in September) */
const chargeDay = (r: RecurringPayment, year: number, month: number) => Math.min(r.day, daysInMonth(year, month));

export const isDueInPeriod = (r: RecurringPayment, p: Period) =>
  r.frequency === 'monthly' || r.month === p.index;

/** `txs` are the period's transactions */
export const isPaidInPeriod = (r: RecurringPayment, txs: Transaction[]) =>
  txs.some(t => t.recurringId === r.id);

export function recurringStatus(r: RecurringPayment, txs: Transaction[], p: Period): RecurringStatus {
  if (!r.active) return 'paused';
  if (!isDueInPeriod(r, p)) return 'upcoming';
  if (isPaidInPeriod(r, txs)) return 'paid';
  return chargeDay(r, p.year, p.index) < p.current ? 'overdue' : 'upcoming';
}

/** Date of the next charge that hasn't happened yet */
export function nextChargeDate(r: RecurringPayment, txs: Transaction[], p: Period): Date {
  const dueNowUnpaid = isDueInPeriod(r, p) && !isPaidInPeriod(r, txs);
  if (r.frequency === 'monthly') {
    const [y, m] = dueNowUnpaid ? [p.year, p.index] : p.index === 11 ? [p.year + 1, 0] : [p.year, p.index + 1];
    return new Date(y, m, chargeDay(r, y, m));
  }
  const month = r.month ?? 0;
  const year = dueNowUnpaid || month > p.index ? p.year : p.year + 1;
  return new Date(year, month, chargeDay(r, year, month));
}

export const daysUntil = (d: Date, p: Period) =>
  Math.round((d.getTime() - new Date(p.year, p.index, p.current).getTime()) / 86_400_000);

/** Active bills still to be paid this period (overdue included) — planned, not yet spent */
export const unpaidThisPeriod = (rules: RecurringPayment[], txs: Transaction[], p: Period) =>
  rules
    .filter(r => isBillRule(r) && r.active && isDueInPeriod(r, p) && !isPaidInPeriod(r, txs))
    .sort((a, b) => a.day - b.day);

/** Planned income (e.g. salary) this period that hasn't arrived yet.
 *  Counted as received if a transaction is linked to it, or an unlinked income of the
 *  same amount (±2%) was recorded — so a salary added by hand isn't counted twice. */
export function expectedIncome(rules: RecurringPayment[], txs: Transaction[], p: Period): number {
  return sumBy(
    rules.filter(r => isIncomeRule(r) && r.active && isDueInPeriod(r, p) && !isPaidInPeriod(r, txs) && !likelyPayment(r, txs)),
    r => r.amount,
  );
}

export const monthlyEquivalent = (r: RecurringPayment) => (r.frequency === 'yearly' ? r.amount / 12 : r.amount);

/** Bills this period: how much in total, how much already paid, monthly average of all active bills */
export function billsSummary(rules: RecurringPayment[], txs: Transaction[], p: Period) {
  const due = rules.filter(r => isBillRule(r) && r.active && isDueInPeriod(r, p));
  const paid = due.filter(r => isPaidInPeriod(r, txs));
  return {
    total: sumBy(due, r => r.amount),
    paid: sumBy(paid, r => r.amount),
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

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const amountGap = (r: RecurringPayment, t: Transaction) => Math.abs(Math.abs(t.amount) - r.amount) / Math.max(r.amount, 0.01);
const nameHit = (r: RecurringPayment, t: Transaction) => {
  const a = norm(r.name), b = norm(t.description);
  return !!a && !!b && (a.includes(b) || b.includes(a));
};

/** This period's unlinked expenses that could be the payment of `r`, best match first (max 5) */
export function paymentCandidates(r: RecurringPayment, txs: Transaction[]): Transaction[] {
  const sameDirection = (t: Transaction) => (isIncomeRule(r) ? t.amount > 0 : t.amount < 0);
  return txs
    .filter(t => sameDirection(t) && !t.recurringId)
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
