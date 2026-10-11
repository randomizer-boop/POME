import { describe, expect, it } from 'vitest';
import { parseRates, saneRate } from './rates';

describe('parseRates', () => {
  it('keeps only our currencies', () => {
    const r = parseRates({ result: 'success', time_last_update_unix: 1790000000, rates: { USD: 1, KZT: 480, MNT: 3500, EUR: 0.9, CNY: 7.1, GBP: 0.8 } });
    expect(r?.rates).toEqual({ KZT: 480, MNT: 3500, USD: 1, EUR: 0.9, CNY: 7.1 });
    expect(r?.live).toBe(true);
  });
  it('rejects incomplete or failed responses', () => {
    expect(parseRates({ result: 'error' })).toBeNull();
    expect(parseRates({ result: 'success', rates: { KZT: 480 } })).toBeNull();
  });
});

describe('saneRate', () => {
  it('rejects values that would corrupt amounts', () => {
    expect([1, 444.88, 3591.6].every(saneRate)).toBe(true);
    expect([0, -1, NaN, Infinity, 1e9, '5', null].some(v => saneRate(v))).toBe(false);
  });
});
