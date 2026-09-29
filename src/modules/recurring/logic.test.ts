import { describe, expect, it } from 'vitest';
import type { Period, RecurringPayment, Transaction } from '../../shared/types';
import { likelyPayment, nextChargeDate, paymentCandidates, recurringStatus, unpaidThisPeriod, validateRecurring } from './logic';

const p: Period = { year: 2026, index: 8, current: 20, total: 30 };
const rule = (over: Partial<RecurringPayment>): RecurringPayment => ({
  id: 'r1', name: 'X', category: 'Utilities', amount: 10, accountId: 'main', frequency: 'monthly', day: 25, active: true, ...over,
});
const paid: Transaction = { id: 't', date: '2026-09-05', description: 'X', category: 'Utilities', amount: -10, accountId: 'main', recurringId: 'r1' };

describe('recurring', () => {
  it('upcoming monthly payment is charged this month', () => {
    expect(nextChargeDate(rule({}), [], p)).toEqual(new Date(2026, 8, 25));
    expect(recurringStatus(rule({}), [], p)).toBe('upcoming');
  });

  it('paid monthly payment moves to next month', () => {
    expect(nextChargeDate(rule({ day: 5 }), [paid], p)).toEqual(new Date(2026, 9, 5));
    expect(recurringStatus(rule({ day: 5 }), [paid], p)).toBe('paid');
  });

  it('unpaid payment with a past day is overdue', () => {
    expect(recurringStatus(rule({ day: 3 }), [], p)).toBe('overdue');
  });

  it('clamps day 31 to the month length', () => {
    expect(nextChargeDate(rule({ day: 31 }), [], p)).toEqual(new Date(2026, 8, 30));
  });

  it('yearly payment in an earlier month rolls to next year', () => {
    expect(nextChargeDate(rule({ frequency: 'yearly', month: 2, day: 14 }), [], p)).toEqual(new Date(2027, 2, 14));
  });

  it('paused and other-month yearly payments are not due this period', () => {
    const list = [rule({ id: 'a' }), rule({ id: 'b', active: false }), rule({ id: 'c', frequency: 'yearly', month: 10 })];
    expect(unpaidThisPeriod(list, [], p).map(r => r.id)).toEqual(['a']);
  });

  it('validates drafts', () => {
    expect(validateRecurring('', 10, 1)).toBe('name');
    expect(validateRecurring('A', 0, 1)).toBe('amount');
    expect(validateRecurring('A', 10, 32)).toBe('day');
    expect(validateRecurring('A', 10, 31)).toBeNull();
  });
});

describe('already paid: matching recurring payments to expenses', () => {
  const rent = { id: 'r', name: 'Аренда', category: 'Housing', amount: 5000, accountId: 'main' as const, frequency: 'monthly' as const, day: 1, active: true };
  const tx = (id: string, description: string, category: string, amount: number, recurringId?: string) =>
    ({ id, date: '2026-09-01', description, category, amount, accountId: 'main' as const, ...(recurringId ? { recurringId } : {}) });

  it('finds the rent the user already recorded as a normal expense', () => {
    const txs = [tx('a', 'Кофе', 'Dining', -5), tx('b', 'аренда квартиры', 'Housing', -5000), tx('c', 'Salary', 'Income', 9000)];
    expect(paymentCandidates(rent, txs).map(t => t.id)[0]).toBe('b');
    expect(likelyPayment(rent, txs)?.id).toBe('b');
  });

  it('ignores income and expenses already linked to a payment', () => {
    const txs = [tx('b', 'Аренда', 'Housing', -5000, 'other'), tx('c', 'Аренда', 'Income', 5000)];
    expect(paymentCandidates(rent, txs)).toEqual([]);
    expect(likelyPayment(rent, txs)).toBeNull();
  });

  it('suggests but does not auto-match a different amount', () => {
    const txs = [tx('d', 'Rent', 'Housing', -4800)];
    expect(paymentCandidates(rent, txs).length).toBe(1);
    expect(likelyPayment(rent, txs)).toBeNull();
  });
});

describe('status on the Recurring page (salary / bill added after its day)', () => {
  const sep29: Period = { year: 2026, index: 8, current: 29, total: 30 };
  const zp: RecurringPayment = { id: 'zp', name: 'Зарплата', category: 'Income', amount: 800_000, accountId: 'main', frequency: 'monthly', day: 5, active: true, createdAt: '2026-09-29' };
  const bill: RecurringPayment = { ...zp, id: 'b', name: 'Платеж', category: 'Housing', amount: 300_000 };

  it('a salary added on the 29th with no income recorded is not "overdue since the 5th"', () => {
    expect(recurringStatus(zp, [], sep29)).toBe('upcoming');
    expect(nextChargeDate(zp, [], sep29)).toEqual(new Date(2026, 9, 5));
  });

  it('the September salary recorded by hand is recognised as received', () => {
    const got: Transaction = { id: 's', date: '2026-09-05', description: 'ЗП', category: 'Income', amount: 800_000, accountId: 'main' };
    expect(recurringStatus(zp, [got], sep29)).toBe('paid');
  });

  it('a bill paid early shows as paid, next charge is the month after', () => {
    const early: Transaction = { id: 'p', date: '2026-09-29', description: 'Платеж', category: 'Housing', amount: -300_000, accountId: 'main', recurringId: 'b' };
    expect(recurringStatus(bill, [early], sep29)).toBe('paid');
    expect(nextChargeDate(bill, [early], sep29)).toEqual(new Date(2026, 10, 5));
  });
});
