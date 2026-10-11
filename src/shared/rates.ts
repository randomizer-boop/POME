// ─── Live exchange rates ──────────────────────────────────────────────────────
// Free, no key, CORS-enabled: https://www.exchangerate-api.com/docs/free
// Cached in localStorage for 12 h; if the request fails we keep the last cached
// rates, or the built-in EXCHANGE_RATES as a final fallback.

import type { Currency } from './types';
import { CURRENCIES, EXCHANGE_RATES } from './config';

export interface RatesState {
  rates: Record<Currency, number>;
  /** When the provider last updated the rates (ms) */
  updatedAt: number;
  live: boolean;
}

const KEY = 'pome.rates.v1';
const MAX_AGE = 12 * 60 * 60 * 1000;
export const FALLBACK: RatesState = { rates: EXCHANGE_RATES, updatedAt: Date.UTC(2026, 8, 24), live: false };

interface Cached extends RatesState { fetchedAt: number }

/** A rate we can trust to multiply money by: a finite positive number of sane size (USD → X) */
export const saneRate = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 1_000_000;

export function readCachedRates(): Cached | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Cached;
    return CURRENCIES.every(k => saneRate(c.rates?.[k])) && Number.isFinite(c.fetchedAt) && Number.isFinite(c.updatedAt) ? { ...c, live: !!c.live } : null;
  } catch { return null; }
}

export const isFresh = (c: Cached | null) => !!c && Date.now() - c.fetchedAt < MAX_AGE;

/** Picks our currencies out of a provider response; null if anything is missing */
export function parseRates(json: unknown): RatesState | null {
  const j = json as { result?: string; rates?: Record<string, number>; time_last_update_unix?: number };
  if (j?.result !== 'success' || !j.rates) return null;
  const rates = {} as Record<Currency, number>;
  for (const c of CURRENCIES) {
    const v = c === 'USD' ? 1 : j.rates[c];
    if (!saneRate(v)) return null;
    rates[c] = v;
  }
  return { rates, updatedAt: (j.time_last_update_unix ?? Date.now() / 1000) * 1000, live: true };
}

export async function fetchRates(): Promise<RatesState | null> {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!res.ok) return null;
    const parsed = parseRates(await res.json());
    if (parsed) {
      try { localStorage.setItem(KEY, JSON.stringify({ ...parsed, fetchedAt: Date.now() })); } catch { /* storage unavailable */ }
    }
    return parsed;
  } catch { return null; }
}
