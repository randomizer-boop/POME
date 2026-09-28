import { describe, expect, it } from 'vitest';
import { fromMinor, mapRecurring, mapTransaction, toMinor, transactionToRow } from './repository';

describe('repository mappers', () => {
  it('stores money as integer minor units', () => {
    expect(toMinor(12.34)).toBe(1234);
    expect(toMinor(0.1 + 0.2)).toBe(30);   // no float drift
    expect(fromMinor(1234)).toBe(12.34);
    expect(fromMinor('-150000')).toBe(-1500);
  });

  it('round-trips a transaction', () => {
    const t = { id: 'a', date: '2026-09-27', description: 'Coffee', category: 'Dining', amount: -1500, accountId: 'cash' as const, currency: 'KZT' as const };
    const row = transactionToRow(t);
    expect(row.amount_minor).toBe(-150000);
    expect(row.currency).toBe('KZT');
    expect(mapTransaction({ ...row, date: '2026-09-27' })).toEqual(t);
  });

  it('reads rows saved before the currency column as USD', () => {
    expect(mapTransaction({ id: 'b', date: '2026-09-01', description: '', category: 'Dining', amount_minor: -450, account_id: 'cash' }).currency).toBe('USD');
  });

  it('maps a yearly recurring payment', () => {
    const r = mapRecurring({ id: 'r', name: 'Insurance', category: 'Transport', amount_minor: 48000, account_id: 'main', frequency: 'yearly', day: 5, month: 10, active: true });
    expect(r).toMatchObject({ amount: 480, month: 10, frequency: 'yearly', active: true });
  });
});
