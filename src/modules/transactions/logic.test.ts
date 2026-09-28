import { describe, expect, it } from 'vitest';
import type { Period, Transaction } from '../../shared/types';
import { flexibleTotal, billsPaidTotal, incomeTotal, validateTransactionDraft } from './logic';

const p: Period = { year: 2026, index: 8, current: 20, total: 30 };
const txs: Transaction[] = [
  { id: '1', date: '2026-09-01', description: 'Salary', category: 'Income', amount: 1000, accountId: 'main' },
  { id: '2', date: '2026-09-01', description: 'Rent', category: 'Housing', amount: -400, accountId: 'main', recurringId: 'r' },
  { id: '3', date: '2026-09-02', description: 'Cafe', category: 'Dining', amount: -25, accountId: 'cash' },
];

describe('transactions', () => {
  it('splits spending into bills and flexible', () => {
    expect(incomeTotal(txs)).toBe(1000);
    expect(billsPaidTotal(txs)).toBe(400);
    expect(flexibleTotal(txs)).toBe(25);
  });

  it('validates a quick-add draft', () => {
    expect(validateTransactionDraft(0, '2026-09-05', p)).toBe('amount');
    expect(validateTransactionDraft(NaN, '2026-09-05', p)).toBe('amount');
    expect(validateTransactionDraft(10, '2026-09-21', p)).toBe('date');   // tomorrow
    expect(validateTransactionDraft(10, '', p)).toBe('date');
    expect(validateTransactionDraft(10, '2026-09-20', p)).toBeNull();     // today
    expect(validateTransactionDraft(10, '2026-08-12', p)).toBeNull();     // last month — allowed
  });
});
