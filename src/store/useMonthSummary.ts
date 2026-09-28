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
import { goalsPlannedTotal, goalsSavedTotal } from '../modules/goals/logic';
import { projectMonthEnd } from '../modules/forecast/logic';
import { divide, percent, sub, sumBy } from '../shared/money';
import { inPeriod, shiftPeriod } from '../shared/config';
import { payCycle } from '../modules/safe-to-spend/cycle';
import { useSettings } from './Settings';

export interface SummaryOptions {
  /** fixed safety buffer in base currency (null = automatic) */
  safetyBuffer?: number | null;
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
  const unpaid = unpaidThisPeriod(recurring, transactions, period);
  const billsUpcoming = sumBy(unpaid, r => r.amount);
  const expectedIncome = expectedIncomeOf(recurring, transactions, period);
  const bills = billsSummary(recurring, transactions, period);

  const budget = buildBudget(allocations, transactions);
  const budgetSum = budgetTotals(budget);

  const goalsPlanned = goalsPlannedTotal(goals);
  const goalsSaved = goalsSavedTotal(goals);

  // safe to spend covers the pay cycle (until the next income), not just the month
  const cycle = payCycle(recurring, allTransactions, period);
  const safe = computeSafeToSpend({
    liquidBalance, incomeReceived: cycle.incomeInCycle, expectedIncome: cycle.incomeDueToday, upcomingBills: cycle.billsTotal,
    goalsPlanned, savedThisMonth: saved, flexibleSpent: cycle.spentInCycle, spentToday: cycle.spentToday,
    daysPassed: cycle.daysElapsed, daysTotal: cycle.length, bufferAmount: opts.safetyBuffer,
  });

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

export function useMonthSummary(): MonthSummary {
  const { period, accounts, transactions, transfers, allTransactions, allTransfers, recurring, allocations, goals } = useFinance();
  const { safetyBuffer } = useSettings();
  return useMemo(
    () => summarize({ period, accounts, transactions, transfers, allTransactions, allTransfers, recurring, allocations, goals }, { safetyBuffer }),
    [period, accounts, transactions, transfers, allTransactions, allTransfers, recurring, allocations, goals, safetyBuffer],
  );
}
