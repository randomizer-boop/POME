import { describe, expect, it } from 'vitest';
import { nextStep, stepsDone } from './logic';

const empty = { accounts: [], transactions: [], recurring: [], allocations: {}, goals: [] };

describe('onboarding steps', () => {
  it('starts with income for a new account', () => {
    const done = stepsDone(empty);
    expect(Object.values(done).every(v => !v)).toBe(true);
    expect(nextStep(done)).toBe('balances');
  });

  it('marks steps from data; a paid bill is not the "first expense"', () => {
    const done = stepsDone({
      ...empty,
      transactions: [
        { id: '1', date: '2026-09-01', description: 'Salary', category: 'Income', amount: 1000, accountId: 'main' },
        { id: '2', date: '2026-09-02', description: 'Rent', category: 'Housing', amount: -400, accountId: 'main', recurringId: 'r' },
      ],
      allocations: { Groceries: 300 },
      accounts: [{ id: 'main', openingBalance: 500 }],
    });
    expect(done).toEqual({ balances: true, income: true, recurring: false, budget: true, goal: false, expense: false });
    expect(nextStep(done)).toBe('recurring');
  });
});
