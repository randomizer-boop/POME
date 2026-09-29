import { describe, expect, it } from 'vitest';
import type { Account, Transaction, Transfer } from '../../shared/types';
import { accountBalances, needsReconcile, savedThisPeriod, validateTransfer } from './logic';

const accs: Account[] = [{ id: 'cash', openingBalance: 100 }, { id: 'main', openingBalance: 1000 }, { id: 'savings', openingBalance: 0 }];
const txs: Transaction[] = [{ id: 't', date: '2026-09-01', description: 'x', category: 'Dining', amount: -50, accountId: 'main' }];
const xs: Transfer[] = [{ id: 'x', date: '2026-09-02', from: 'main', to: 'savings', amount: 300 }];

describe('accounts', () => {
  it('applies transactions and transfers to balances', () => {
    expect(accountBalances(accs, txs, xs)).toEqual({ cash: 100, main: 650, savings: 300 });
  });

  it('counts net money moved into savings', () => {
    expect(savedThisPeriod([...xs, { id: 'y', date: '2026-09-03', from: 'savings', to: 'cash', amount: 50 }])).toBe(250);
  });

  it('rejects invalid transfers', () => {
    const bal = accountBalances(accs, txs, xs);
    expect(validateTransfer('main', 'main', 10, bal)).toBe('same');
    expect(validateTransfer('main', 'cash', 0, bal)).toBe('amount');
    expect(validateTransfer('cash', 'main', 101, bal)).toBe('insufficient');
    expect(validateTransfer('cash', 'main', 100, bal)).toBeNull();
  });
});

describe('reconciliation reminder', () => {
  it('asks once a week, only when there is something to reconcile', () => {
    expect(needsReconcile('2026-09-20', '2026-09-26', true)).toBe(false);
    expect(needsReconcile('2026-09-20', '2026-09-27', true)).toBe(true);
    expect(needsReconcile('2026-09-01', '2026-09-27', false)).toBe(false);
    expect(needsReconcile(null, '2026-09-27', true)).toBe(false);
  });
});

describe('recording money that is already in the balance', () => {
  it('shifting the opening by the new transaction keeps the balance the user typed', async () => {
    const { accountBalances, openingFor } = await import('./logic');
    const accs = [{ id: 'main' as const, openingBalance: 0 }, { id: 'cash' as const, openingBalance: 0 }, { id: 'savings' as const, openingBalance: 0 }];
    const salary = { id: 's', date: '2026-09-05', description: 'Salary', category: 'Income', amount: 1_500_000, accountId: 'main' as const };
    // typed 2 500 000 (salary already inside) → record the salary without changing that number
    const opening = openingFor('main', 2_500_000, [salary], []);
    const after = accountBalances(accs.map(a => (a.id === 'main' ? { ...a, openingBalance: opening } : a)), [salary], []);
    expect(opening).toBe(1_000_000);
    expect(after.main).toBe(2_500_000);
  });
});
