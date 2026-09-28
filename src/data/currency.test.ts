import { describe, expect, it } from 'vitest';
import { fmtCurrency } from '../shared/format';
import { toBaseData, toRaw, txToBase, type RawData, type Rates } from './currency';

const rates: Rates = { USD: 1, KZT: 444.88, MNT: 3591.61, EUR: 0.8774, CNY: 6.7227 };

describe('row currency', () => {
  it('1 500 000 ₸ stays 1 500 000 ₸ (no lost tenge)', () => {
    const typed = 1_500_000;
    const base = typed / rates.KZT;                 // what the form passes to the store
    const stored = toRaw(-base, rates, 'KZT');       // what goes to the DB
    expect(stored).toBe(-1_500_000);
    const shown = txToBase({ id: 't', date: '2026-09-29', description: '', category: 'Groceries', amount: stored, accountId: 'main', currency: 'KZT' }, rates).amount * rates.KZT;
    expect(fmtCurrency(shown, 'KZT')).toBe(fmtCurrency(-1_500_000, 'KZT'));
  });

  it('keeps the typed amount when the exchange rate changes', () => {
    const raw: RawData = {
      accounts: [], transfers: [], recurring: [], goals: [],
      transactions: [{ id: 't', date: '2026-09-29', description: '', category: 'Groceries', amount: -1_500_000, accountId: 'main', currency: 'KZT' }],
      allocations: { Groceries: 200_000 }, allocCurrency: { Groceries: 'KZT' },
    };
    const newRates = { ...rates, KZT: 470 };
    const d = toBaseData(raw, newRates);
    expect(d.transactions[0].amount * newRates.KZT).toBeCloseTo(-1_500_000, 6);
    expect(d.allocations.Groceries * newRates.KZT).toBeCloseTo(200_000, 6);
  });

  it('treats rows without a currency as USD (older data)', () => {
    const t = txToBase({ id: 't', date: '2026-09-29', description: '', category: 'Groceries', amount: -10, accountId: 'main' }, rates);
    expect(t.amount).toBe(-10);
  });
});
