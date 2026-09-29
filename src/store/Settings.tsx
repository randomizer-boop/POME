// ─── UI settings: display currency + language ─────────────────────────────────

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
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
  lang: Lang;
  setLang: (l: Lang) => void;
}

const Ctx = createContext<Settings | null>(null);
const LANG_KEY = 'pome.lang';
const CURRENCY_KEY = 'pome.currency';
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
  }), [currency, lang, rates]);
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
    /** "−X" for an amount taken away; plain "0" instead of "−0" */
    const minus = (v: number, opts?: { compact?: boolean; maxFrac?: number }) => {
      const s = money(Math.abs(v), opts);
      return /[1-9]/.test(s) ? `−${s}` : s;
    };
    return { money, minus, currency, rate };
  }, [currency, rate]);
}
