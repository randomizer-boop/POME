import type { Account, Allocations, Goal, RecurringPayment, Transaction } from '../../shared/types';
import { isBillRule, isIncomeRule } from '../recurring/logic';

// Setup wizard (not a checklist): each step asks for real data right there.
// Order matters — money that already moved (salary received, bills paid) is entered BEFORE the
// balances, and is recorded without changing them, so nothing is counted twice.
export type StepId = 'savings' | 'income' | 'bills' | 'balances' | 'budget' | 'goal';

export const STEPS: StepId[] = ['savings', 'income', 'bills', 'balances', 'budget', 'goal'];
/** Steps that can be skipped ("I don't have fixed payments", "later") */
export const OPTIONAL: StepId[] = ['income', 'bills', 'budget', 'goal'];

export interface GuideData {
  accounts: Account[];
  transactions: Transaction[];   // full history
  recurring: RecurringPayment[];
  allocations: Allocations;
  goals: Goal[];
  /** the user picked their savings % (a setting, not data) */
  savingsChosen?: boolean;
  /** steps the user confirmed or skipped in the wizard */
  confirmed?: StepId[];
}

/** Which steps are done — from the user's data, or confirmed/skipped in the wizard */
export function stepsDone(d: GuideData): Record<StepId, boolean> {
  const ok = (s: StepId) => d.confirmed?.includes(s) ?? false;
  return {
    savings: !!d.savingsChosen || ok('savings'),
    income: d.recurring.some(isIncomeRule) || ok('income'),
    bills: d.recurring.some(isBillRule) || ok('bills'),
    balances: d.accounts.some(a => a.openingBalance !== 0) || ok('balances'),
    budget: Object.keys(d.allocations).length > 0 || ok('budget'),
    goal: d.goals.length > 0 || ok('goal'),
  };
}

export const nextStep = (done: Record<StepId, boolean>): StepId | null => STEPS.find(s => !done[s]) ?? null;

/** Salary/bill due on `day` has already come this month (so the wizard asks "already received/paid?") */
export const alreadyDue = (day: number, today: number) => day <= today;
