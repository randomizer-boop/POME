// ─── Pay cycle: "until the next salary", not "until the end of the month" ────
// Money has to last until the next income arrives. So safe-to-spend looks at the window
//   today … the day before the next expected income
// and reserves every bill due inside that window (even if it's next month).
// Without income rules it falls back to the calendar month.

import type { Period, RecurringPayment, Transaction } from '../../shared/types';
import { isoDay } from '../../shared/config';
import { sum } from '../../shared/money';
import { isBillRule, isIncomeRule, occurrences, schedule } from '../recurring/logic';
import { addDays, daysInclusive } from '../../shared/dates';
import { isFlexibleExpense, isIncome } from '../transactions/logic';

/** Longest window we plan for; a far-away (e.g. yearly) income falls back to month end */
const MAX_DAYS_AHEAD = 45;

export { addDays, daysInclusive, occurrences };

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
  /** bills to pay until the next income, payday included (overdue this month too): due date + what's left to pay */
  bills: { rule: RecurringPayment; date: string; amount: number }[];
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
  const incomeToday = schedule(incomeRules, allTxs, today, today);
  const dueToday = [...incomeToday.values()].flat().filter(o => o.owed && !o.settled);
  const next = ahead.filter(o => o.date > today).map(o => o.date).sort()[0] ?? null;
  const last = incomeRules.flatMap(r => occurrences(r, addDays(today, -400), today)).sort().pop() ?? null;

  const useIncome = next !== null && daysInclusive(today, next) - 1 <= MAX_DAYS_AHEAD;
  const end = useIncome ? addDays(next!, -1) : monthEnd;
  // the cycle can't start before the previous month or after today
  const start = useIncome && last ? (last < addDays(today, -MAX_DAYS_AHEAD) ? monthStart : last) : monthStart;

  // bills: every occurrence still owed from the 1st of this month (overdue included; older months can't be
  // marked paid any more) up to the next payday, payday included (rent often leaves before the salary lands).
  // Paid ones are out — including ones paid early (29 Sep for 5 Oct); partly paid ones count what's left.
  const billsFrom = monthStart;
  const billsUntil = useIncome ? next! : end;
  const bills = [...schedule(rules.filter(r => r.active && isBillRule(r)), allTxs, billsFrom, billsUntil).values()]
    .flat()
    .filter(o => o.owed && !o.settled)
    .map(o => ({ rule: o.rule, date: o.date, amount: o.remaining }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const inCycle = allTxs.filter(t => t.date >= start && t.date <= today);
  return {
    mode: useIncome ? 'income' : 'month',
    start, end, today, nextIncome: useIncome ? next : null,
    daysElapsed: daysInclusive(start, today),
    daysLeft: daysInclusive(today, end),
    length: daysInclusive(start, end),
    incomeDueToday: sum(dueToday.map(o => o.remaining)),
    bills, billsTotal: sum(bills.map(b => b.amount)),
    spentInCycle: sum(inCycle.filter(isFlexibleExpense).map(t => -t.amount)),
    spentToday: sum(inCycle.filter(t => t.date === today && isFlexibleExpense(t)).map(t => -t.amount)),
    incomeInCycle: sum(inCycle.filter(isIncome).map(t => t.amount)),
  };
}
