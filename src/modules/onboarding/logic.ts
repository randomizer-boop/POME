import type { Account, Allocations, Goal, RecurringPayment, Transaction } from '../../shared/types';

export type StepId = 'balances' | 'income' | 'recurring' | 'budget' | 'goal' | 'expense';

/** Order matters: real balances, then income — everything else is measured against it */
export const STEPS: StepId[] = ['balances', 'income', 'recurring', 'budget', 'goal', 'expense'];

export interface GuideData {
  accounts: Account[];
  transactions: Transaction[];   // full history
  recurring: RecurringPayment[];
  allocations: Allocations;
  goals: Goal[];
}

/** Which first-steps are already done — derived from the user's data, nothing stored */
export function stepsDone(d: GuideData): Record<StepId, boolean> {
  return {
    balances: d.accounts.some(a => a.openingBalance !== 0),
    income: d.transactions.some(t => t.amount > 0),
    recurring: d.recurring.length > 0,
    budget: Object.keys(d.allocations).length > 0,
    goal: d.goals.length > 0,
    expense: d.transactions.some(t => t.amount < 0 && !t.recurringId),
  };
}

export const nextStep = (done: Record<StepId, boolean>): StepId | null => STEPS.find(s => !done[s]) ?? null;
