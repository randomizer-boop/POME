import { describe, expect, it } from 'vitest';
import { alreadyDue, nextStep, stepsDone } from './logic';

const empty = { accounts: [], transactions: [], recurring: [], allocations: {}, goals: [] };
const salary = { id: 's', name: 'Salary', category: 'Income', amount: 1000, accountId: 'main' as const, frequency: 'monthly' as const, day: 5, active: true };
const rent = { ...salary, id: 'r', name: 'Rent', category: 'Housing' };

describe('setup wizard steps', () => {
  it('starts with the savings %, then income — before balances', () => {
    expect(nextStep(stepsDone(empty))).toBe('savings');
    expect(nextStep(stepsDone({ ...empty, savingsChosen: true }))).toBe('income');
  });

  it('income and bills are told apart; balances come after them', () => {
    const d = stepsDone({ ...empty, savingsChosen: true, recurring: [salary] });
    expect(d.income).toBe(true);
    expect(d.bills).toBe(false);
    expect(nextStep(d)).toBe('bills');
    expect(nextStep(stepsDone({ ...empty, savingsChosen: true, recurring: [salary, rent] }))).toBe('balances');
  });

  it('skipped / confirmed steps count as done', () => {
    const d = stepsDone({ ...empty, savingsChosen: true, confirmed: ['income', 'bills', 'balances', 'budget'] });
    expect(nextStep(d)).toBe('goal');
    expect(nextStep(stepsDone({ ...empty, savingsChosen: true, confirmed: ['income', 'bills', 'balances', 'budget', 'goal'] }))).toBeNull();
  });

  it('asks "already received/paid?" only for days that have come', () => {
    expect(alreadyDue(5, 29)).toBe(true);
    expect(alreadyDue(30, 29)).toBe(false);
  });
});
