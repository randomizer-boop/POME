// ─── Pay cycle: "until the next salary", not "until the end of the month" ────
// Money has to last until the next income arrives. So safe-to-spend looks at the window
//   today … the day before the next expected income
// and reserves every bill due inside that window (even if it's next month).
// Without income rules it falls back to the calendar month.

import type { Period, RecurringPayment, Transaction } from '../../shared/types';
import { isoDay } from '../../shared/config';
import { sum } from '../../shared/money';
import { isBillRule, isIncomeRule, likelyPayment } from '../recurring/logic';
import { isFlexibleExpense, isIncome } from '../transactions/logic';

/** Longest window we plan for; a far-away (e.g. yearly) income falls back to month end */
const MAX_DAYS_AHEAD = 45;

// ISO date helpers (YYYY-MM-DD compares correctly as strings)
const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (iso: string) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
export const addDays = (iso: string, n: number) => { const d = parse(iso); d.setDate(d.getDate() + n); return toIso(d); };
/** Days from a to b inclusive (a = b → 1) */
export const daysInclusive = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000) + 1;

/** Dates a rule is due on between `from` and `to` (inclusive) */
export function occurrences(r: RecurringPayment, from: string, to: string): string[] {
  const out: string[] = [];
  const start = parse(from), end = parse(to);
  for (let d = new Date(start.getFullYear(), start.getMonth(), 1); d <= end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    if (r.frequency === 'yearly' && d.getMonth() !== (r.month ?? 0)) continue;
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const iso = toIso(new Date(d.getFullYear(), d.getMonth(), Math.min(r.day, last)));
    if (iso >= from && iso <= to) out.push(iso);
  }
  return out;
}

/** Has the occurrence due on `date` been paid/received? (a transaction in that month linked to the rule;
 *  for income also an unlinked income of the same amount, so a salary added by hand isn't counted twice) */
function settled(r: RecurringPayment, date: string, allTxs: Transaction[]): boolean {
  const monthTxs = allTxs.filter(t => t.date.slice(0, 7) === date.slice(0, 7));
  return monthTxs.some(t => t.recurringId === r.id) || (isIncomeRule(r) && !!likelyPayment(r, monthTxs));
}

export interface PayCycle {
  mode: 'income' | 'month';
  /** first day of the current cycle (last income day, or 1st of the month) */
  start: string;
  /** last day covered — the day before the next income, or month end */
  end: string;
  today: string;
  /** next income date (mode 'income') */
  nextIncome: string | null;
  daysElapsed: number;      // start … today
  daysLeft: number;         // today … end
  length: number;           // start … end
  /** income due today but not recorded yet — counted as arriving today */
  incomeDueToday: number;
  /** bills to pay until the next income, payday included (overdue this month too), with due dates */
  bills: { rule: RecurringPayment; date: string }[];
  billsTotal: number;
  /** actual flexible spending in the cycle so far / today, income received in the cycle */
  spentInCycle: number;
  spentToday: number;
  incomeInCycle: number;
}

export function payCycle(rules: RecurringPayment[], allTxs: Transaction[], p: Period): PayCycle {
  const today = isoDay(p, p.current);
  const monthStart = isoDay(p, 1);
  const monthEnd = isoDay(p, p.total);
  const incomeRules = rules.filter(r => r.active && isIncomeRule(r));

  // income: the next one strictly after today; one due today and not yet recorded counts as arriving today
  const ahead = incomeRules.flatMap(r => occurrences(r, today, addDays(today, 400)).map(date => ({ r, date })));
  const dueToday = ahead.filter(o => o.date === today && !settled(o.r, o.date, allTxs));
  const next = ahead.filter(o => o.date > today).map(o => o.date).sort()[0] ?? null;
  const last = incomeRules.flatMap(r => occurrences(r, addDays(today, -400), today)).sort().pop() ?? null;

  const useIncome = next !== null && daysInclusive(today, next) - 1 <= MAX_DAYS_AHEAD;
  const end = useIncome ? addDays(next!, -1) : monthEnd;
  // the cycle can't start before the previous month or after today
  const start = useIncome && last ? (last < addDays(today, -MAX_DAYS_AHEAD) ? monthStart : last) : monthStart;

  // bills: everything not paid yet from the 1st of this month (overdue included; older months can't be
  // marked paid any more) up to the next payday, payday included (rent often leaves before the salary lands)
  const billsFrom = monthStart;
  const billsUntil = useIncome ? next! : end;
  const bills = rules
    .filter(r => r.active && isBillRule(r))
    .flatMap(r => occurrences(r, billsFrom, billsUntil).map(date => ({ rule: r, date })))
    .filter(o => !settled(o.rule, o.date, allTxs))
    .sort((a, b) => a.date.localeCompare(b.date));

  const inCycle = allTxs.filter(t => t.date >= start && t.date <= today);
  return {
    mode: useIncome ? 'income' : 'month',
    start, end, today, nextIncome: useIncome ? next : null,
    daysElapsed: daysInclusive(start, today),
    daysLeft: daysInclusive(today, end),
    length: daysInclusive(start, end),
    incomeDueToday: sum(dueToday.map(o => o.r.amount)),
    bills, billsTotal: sum(bills.map(b => b.rule.amount)),
    spentInCycle: sum(inCycle.filter(isFlexibleExpense).map(t => -t.amount)),
    spentToday: sum(inCycle.filter(t => t.date === today && isFlexibleExpense(t)).map(t => -t.amount)),
    incomeInCycle: sum(inCycle.filter(isIncome).map(t => t.amount)),
  };
}
