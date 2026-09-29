// ─── Derived numbers for the period ───────────────────────────────────────────
// The only place that wires module logic together. Pages read from here and never
// compute money themselves:
//   accounts → transactions (actual) → recurring (planned) → budget → goals → safe-to-spend → forecast

import { useMemo } from 'react';
import type { Account, Allocations, Goal, Period, RecurringPayment, Transaction, Transfer } from '../shared/types';
import { useFinance } from './FinanceStore';
import { LIQUID_ACCOUNTS, accountBalances, savedThisPeriod, savingsRate, totalBalance } from '../modules/accounts/logic';
import { billsPaidTotal, expenseTotal, flexibleTotal, incomeTotal } from '../modules/transactions/logic';
import { buildBudget, budgetTotals } from '../modules/budget/logic';
import { billsSummary, expectedIncome as expectedIncomeOf, unpaidThisPeriod } from '../modules/recurring/logic';
import { computeSafeToSpend } from '../modules/safe-to-spend/logic';
import { goalsPlannedTotal, goalsSavedTotal, goalsThisMonth, isGoalTransfer } from '../modules/goals/logic';
import { projectMonthEnd } from '../modules/forecast/logic';
import { divide, percent, sub, sumBy } from '../shared/money';
import { inPeriod, isoDay, shiftPeriod } from '../shared/config';
import { payCycle } from '../modules/safe-to-spend/cycle';

export interface SummaryOptions {
  /** share of income to save, 0…0.9 (default 5%) */
  savingsRate?: number;
  /** day of the period to look at (safe-to-spend "as of" that day); default period.current */
  day?: number;
}

export interface SummaryInput {
  period: Period;
  accounts: Account[];
  /** this period only */
  transactions: Transaction[];
  transfers: Transfer[];
  /** full history (for balances) */
  allTransactions: Transaction[];
  allTransfers: Transfer[];
  recurring: RecurringPayment[];
  allocations: Allocations;
  goals: Goal[];
}

type SafeInput = Pick<SummaryInput, 'period' | 'accounts' | 'allTransactions' | 'allTransfers' | 'recurring' | 'goals'>;

/**
 * Safe to spend "as of" a day of the period: only what had happened by the end of that day counts.
 * The ONE formula behind every daily limit in the app (card, calendar, past days).
 */
export function safeOnDay({ period, accounts, allTransactions, allTransfers, recurring, goals }: SafeInput, day: number, savingsRate?: number) {
  const dayPeriod = { ...period, current: day };
  const asOf = isoDay(period, day);
  const txsAsOf = allTransactions.filter(t => t.date <= asOf);
  const xsAsOf = allTransfers.filter(x => x.date <= asOf);
  const liquidAsOf = totalBalance(accountBalances(accounts, txsAsOf, xsAsOf), LIQUID_ACCOUNTS);
  const cycle = payCycle(recurring, txsAsOf, dayPeriod);
  // goals ← top-ups to goals this calendar month; the savings % ← other transfers to Savings in the pay cycle
  const goalsMonth = goalsThisMonth(goals, xsAsOf.filter(x => inPeriod(x.date, period)));
  const savedInCycle = savedThisPeriod(xsAsOf.filter(x => x.date >= cycle.start && !isGoalTransfer(x, goals)));
  const safe = computeSafeToSpend({
    liquidBalance: liquidAsOf, incomeReceived: cycle.incomeInCycle, expectedIncome: cycle.incomeDueToday, upcomingBills: cycle.billsTotal,
    goalsPlanned: goalsMonth.planned, goalsPaid: goalsMonth.done, savedInCycle,
    flexibleSpent: cycle.spentInCycle, spentToday: cycle.spentToday,
    daysPassed: cycle.daysElapsed, daysTotal: cycle.length, savingsRate,
  });
  return { cycle, safe };
}

/** Each day's limit (as it was at the start of that day) and what was spent — for the calendar. Days 1 … period.current */
export function dayLimits(input: SafeInput, savingsRate?: number): { limit: number; spent: number }[] {
  return Array.from({ length: input.period.current }, (_, i) => {
    const { safe } = safeOnDay(input, i + 1, savingsRate);
    return { limit: safe.todayLimit, spent: safe.spentToday };
  });
}

/** Pure: every number the pages show for a period (all in base currency). Unit-tested. */
export function summarize({ period, accounts, transactions, transfers, allTransactions, allTransfers, recurring, allocations, goals }: SummaryInput, opts: SummaryOptions = {}) {
  // accounts — balances use the full history; transfers only move money between them
  const balances = accountBalances(accounts, allTransactions, allTransfers);
  const totalBalanceAll = totalBalance(balances);
  const liquidBalance = totalBalance(balances, LIQUID_ACCOUNTS);
  const saved = savedThisPeriod(transfers);

  // actual money this period
  const income = incomeTotal(transactions);
  const expenses = expenseTotal(transactions);
  const billsPaid = billsPaidTotal(transactions);
  const flexibleSpent = flexibleTotal(transactions);

  // planned money this period (not in actual totals until paid/received)
  // full history: a bill paid early (end of last month) or late still finds its payment
  const unpaid = unpaidThisPeriod(recurring, allTransactions, period);
  const billsUpcoming = sumBy(unpaid, r => r.amount);
  const expectedIncome = expectedIncomeOf(recurring, allTransactions, period);
  const bills = billsSummary(recurring, allTransactions, period);

  const budget = buildBudget(allocations, transactions);
  const budgetSum = budgetTotals(budget);

  const goalsPlanned = goalsPlannedTotal(goals);
  const goalsSaved = goalsSavedTotal(goals);

  // safe to spend covers the pay cycle (until the next income), not just the month
  // a later day of the month = forecast: today's data, that day's position in the cycle, nothing spent yet that day
  const day = Math.max(1, Math.min(period.total, opts.day ?? period.current));
  const { cycle, safe } = safeOnDay({ period, accounts, allTransactions, allTransfers, recurring, goals }, day, opts.savingsRate);

  const prev = shiftPeriod(period, -1);
  const lastMonthSpent = flexibleTotal(allTransactions.filter(t => inPeriod(t.date, prev)));
  const forecast = projectMonthEnd({
    liquidBalance, expectedIncome, upcomingBills: billsUpcoming, flexibleSpent, period,
    lastMonthDailyAvg: divide(lastMonthSpent, prev.total),
  });

  return {
    balances, totalBalance: totalBalanceAll, liquidBalance, saved,
    income, expenses, billsPaid, flexibleSpent, expectedIncome,
    unpaid, billsUpcoming, bills,
    budget, budgetSum, goalsPlanned, goalsSaved,
    safe, forecast, cycle, hasLastMonth: lastMonthSpent > 0,
    savingsRate: savingsRate(saved, income),
    /** expenses as % of income */
    expenseShare: percent(expenses, income),
    /** how the month ended: income − expenses − money set aside (transfers aren't spending) */
    monthResult: sub(income, expenses, Math.max(0, saved)),
  };
}

export type MonthSummary = ReturnType<typeof summarize>;

/** Daily limits for the calendar — same formula as the Safe-to-spend card */
export function useDayLimits() {
  const { period, accounts, allTransactions, allTransfers, recurring, goals, savingsRate } = useFinance();
  return useMemo(
    () => dayLimits({ period, accounts, allTransactions, allTransfers, recurring, goals }, savingsRate),
    [period, accounts, allTransactions, allTransfers, recurring, goals, savingsRate],
  );
}

export function useMonthSummary(): MonthSummary {
  const { period, viewDay, accounts, transactions, transfers, allTransactions, allTransfers, recurring, allocations, goals, savingsRate } = useFinance();
  return useMemo(
    () => summarize({ period, accounts, transactions, transfers, allTransactions, allTransfers, recurring, allocations, goals }, { savingsRate, day: viewDay }),
    [period, viewDay, accounts, transactions, transfers, allTransactions, allTransfers, recurring, allocations, goals, savingsRate],
  );
}
