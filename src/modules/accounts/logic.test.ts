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
