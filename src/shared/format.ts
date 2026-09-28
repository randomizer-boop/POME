import type { Currency, Period } from './types';
import { locale } from './i18n';

// Currencies shown without decimals
const NO_DECIMALS = new Set<Currency>(['KZT', 'MNT']);

export function fmtCurrency(n: number, currency: Currency, opts?: { compact?: boolean; maxFrac?: number }) {
  const base: Intl.NumberFormatOptions = { style: 'currency', currency, currencyDisplay: 'narrowSymbol' };
  if (opts?.compact && Math.abs(n) >= 1000) {
    return new Intl.NumberFormat(locale(), { ...base, notation: 'compact', maximumFractionDigits: 1 }).format(n);
  }
  const frac = NO_DECIMALS.has(currency) ? 0 : (opts?.maxFrac ?? 2);
  return new Intl.NumberFormat(locale(), { ...base, minimumFractionDigits: frac, maximumFractionDigits: frac }).format(n);
}

export const currencySymbol = (c: Currency) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: c, currencyDisplay: 'narrowSymbol' })
    .formatToParts(0).find(p => p.type === 'currency')?.value ?? c;

/** Extra-short amount for tight spaces (calendar cells): $25.4k / 25,4к ₸ */
export function fmtTiny(n: number, currency: Currency) {
  if (Math.abs(n) < 1000) return fmtCurrency(n, currency, { maxFrac: 0 });
  const sym = currencySymbol(currency);
  const ru = locale() === 'ru-RU';
  const num = new Intl.NumberFormat(locale(), { maximumFractionDigits: n >= 100000 ? 0 : 1 }).format(n / 1000);
  return ru ? `${num}к ${sym}` : `${sym}${num}k`;
}

export const fmtDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString(locale(), { month: 'short', day: 'numeric' });

export const fmtMonthYear = (d: Date) =>
  d.toLocaleDateString(locale(), { month: 'short', year: 'numeric' });

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "September" / "Сентябрь" */
export const monthName = (p: Period) =>
  cap(new Date(p.year, p.index, 1).toLocaleDateString(locale(), { month: 'long' }));

/** Monday-first short weekday names */
export const weekdaysShort = () =>
  Array.from({ length: 7 }, (_, i) =>
    cap(new Date(2024, 0, 1 + i).toLocaleDateString(locale(), { weekday: 'short' })), // 2024-01-01 is a Monday
  );

/** Parse a user-typed amount: "1 200,50" → 1200.5 */
/** a as % of b; 0 when b is 0 (new accounts with no data yet) */
export const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);

export const parseAmount = (s: string) => parseFloat(s.replace(/\s/g, '').replace(',', '.'));

/**
 * Keeps only what can be part of an amount while typing, and groups thousands with spaces:
 * digits and one decimal separator ("," or "."), max 2 decimals (none for ₸ and ₮).
 * "1500000" → "1 500 000", "1m" → "1", "12,345" → "12,34", "1.2.3" → "1.23"
 * parseAmount() ignores the spaces, so the value round-trips.
 */
export function sanitizeAmountInput(raw: string, currency?: Currency): string {
  const maxDecimals = currency && NO_DECIMALS.has(currency) ? 0 : 2;
  const cleaned = raw.replace(/[^\d.,]/g, '');
  const group = (int: string) => int.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const sep = cleaned.search(/[.,]/);
  if (sep === -1) return group(cleaned.slice(0, 12));
  const int = cleaned.slice(0, sep).slice(0, 12);
  if (maxDecimals === 0) return group(int);
  const dec = cleaned.slice(sep + 1).replace(/[.,]/g, '').slice(0, maxDecimals);
  return `${group(int) || '0'}${cleaned[sep]}${dec}`;
}
