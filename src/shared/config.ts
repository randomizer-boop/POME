import type { Currency, Period } from './types';

export const CURRENCIES: Currency[] = ['KZT', 'MNT', 'USD', 'EUR', 'CNY'];

// Base currency is USD. Live rates come from shared/rates.ts (open.er-api.com, cached 12 h);
// these built-in ones (24 Sep 2026) are only the offline fallback.
export const EXCHANGE_RATES: Record<Currency, number> = {
  KZT: 444.88,
  MNT: 3591.61,
  USD: 1,
  EUR: 0.8774,
  CNY: 6.7227,
};

/** The month we're in, based on the real current date */
export function currentPeriod(now: Date = new Date()): Period {
  const year = now.getFullYear();
  const index = now.getMonth();
  return { year, index, current: now.getDate(), total: new Date(year, index + 1, 0).getDate() };
}

/**
 * A month `offset` months away from today's period (0 = this month, -1 = last month).
 * Past months count as fully passed (current = last day).
 */
export function shiftPeriod(today: Period, offset: number): Period {
  if (offset === 0) return today;
  const d = new Date(today.year, today.index + offset, 1);
  const total = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return { year: d.getFullYear(), index: d.getMonth(), current: offset < 0 ? total : 1, total };
}

/** Months between two periods (b − a) */
export const monthDiff = (a: { year: number; index: number }, b: { year: number; index: number }) =>
  (b.year - a.year) * 12 + (b.index - a.index);

/** "YYYY-MM" of a period — prefix of every ISO date inside it */
export const periodKey = (p: Period) => `${p.year}-${String(p.index + 1).padStart(2, '0')}`;
export const inPeriod = (iso: string, p: Period) => iso.startsWith(periodKey(p));

/** YYYY-MM-DD for a day in the given period */
export const isoDay = (p: Period, day: number) =>
  `${p.year}-${String(p.index + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

/** Transactions store dates as YYYY-MM-DD → day of month */
export const dayOf = (iso: string) => Number(iso.slice(8, 10));
