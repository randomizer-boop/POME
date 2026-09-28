// ─── UI settings: display currency + language ─────────────────────────────────

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Currency } from '../shared/types';
import { CURRENCIES } from '../shared/config';
import { FALLBACK, fetchRates, isFresh, readCachedRates, type RatesState } from '../shared/rates';
import { type Lang, setLanguage, t } from '../shared/i18n';
import { fmtCurrency } from '../shared/format';

interface Settings {
  currency: Currency;
  rate: number;              // base → display currency
  setCurrency: (c: Currency) => void;
  /** When the rates were last updated and whether they came from the live API */
  ratesUpdatedAt: number;
  ratesLive: boolean;
  rates: Record<Currency, number>;
  /** Safety buffer chosen by the user, in base currency; null = automatic (5% of income) */
  safetyBuffer: number | null;
  /** amount in base currency, or null to go back to automatic */
  setSafetyBuffer: (base: number | null) => void;
  lang: Lang;
  setLang: (l: Lang) => void;
}

const Ctx = createContext<Settings | null>(null);
const LANG_KEY = 'pome.lang';
const CURRENCY_KEY = 'pome.currency';
const BUFFER_KEY = 'pome.buffer.v1';
type StoredBuffer = { amount: number; currency: Currency } | null;

function readBuffer(): StoredBuffer {
  try {
    const v = JSON.parse(localStorage.getItem(BUFFER_KEY) ?? 'null');
    return v && typeof v.amount === 'number' && CURRENCIES.includes(v.currency) ? v : null;
  } catch { return null; }
}

function initialCurrency(): Currency {
  try {
    const saved = localStorage.getItem(CURRENCY_KEY) as Currency | null;
    if (saved && CURRENCIES.includes(saved)) return saved;
  } catch { /* storage unavailable */ }
  return 'USD';
}

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'en' || saved === 'ru') return saved;
  } catch { /* storage unavailable */ }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<Currency>(initialCurrency);
  const [rates, setRates] = useState<RatesState>(() => readCachedRates() ?? FALLBACK);

  // Refresh rates once per 12 h; on failure keep what we have
  useEffect(() => {
    if (isFresh(readCachedRates())) return;
    let cancelled = false;
    fetchRates().then(r => { if (r && !cancelled) setRates(r); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    try { localStorage.setItem(CURRENCY_KEY, currency); } catch { /* storage unavailable */ }
  }, [currency]);

  // kept in the currency it was typed in, so the amount stays exact whatever the rate
  const [buffer, setBuffer] = useState<StoredBuffer>(readBuffer);
  const setSafetyBuffer = useCallback((base: number | null) => {
    const next: StoredBuffer = base === null ? null : { amount: Math.round(base * rates.rates[currency] * 100) / 100, currency };
    setBuffer(next);
    try { if (next) localStorage.setItem(BUFFER_KEY, JSON.stringify(next)); else localStorage.removeItem(BUFFER_KEY); } catch { /* ignore */ }
  }, [rates, currency]);
  const [lang, setLang] = useState<Lang>(initialLang);

  // Must run before children render so every t()/format call uses the right language
  setLanguage(lang);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = `POME — ${t('appTagline')}`;
    try { localStorage.setItem(LANG_KEY, lang); } catch { /* storage unavailable */ }
  }, [lang]);

  const value = useMemo(() => ({
    currency, rate: rates.rates[currency], setCurrency, lang, setLang,
    ratesUpdatedAt: rates.updatedAt, ratesLive: rates.live, rates: rates.rates,
    safetyBuffer: buffer ? buffer.amount / (rates.rates[buffer.currency] || 1) : null, setSafetyBuffer,
  }), [currency, lang, rates, buffer, setSafetyBuffer]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}


/** Formats a base-currency (USD) amount in the selected display currency */
export function useMoney() {
  const { currency, rate } = useSettings();
  return useMemo(() => {
    const money = (v: number, opts?: { compact?: boolean; maxFrac?: number }) => fmtCurrency(v * rate, currency, opts);
    return { money, currency, rate };
  }, [currency, rate]);
}
