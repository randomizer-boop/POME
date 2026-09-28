// ─── Row currency ⇄ base currency ─────────────────────────────────────────────
// Stored data ("raw") keeps every amount in the currency it was entered in.
// The app computes in the base currency (USD) — converted with today's rates.
// Displaying a value in its own currency gives back exactly what was typed:
//   raw 1 500 000 KZT → base 1 500 000 / 445.1 → shown in KZT: × 445.1 = 1 500 000

import type { Currency, Goal, RecurringPayment, Transaction, Transfer } from '../shared/types';
import type { UserData } from './repository';

export type Rates = Record<Currency, number>;

/** Allocations also remember their currency (category → currency) */
export interface RawData extends UserData {
  allocCurrency: Record<string, Currency>;
}

const rate = (rates: Rates, c?: Currency) => rates[c ?? 'USD'] || 1;
export const round2 = (v: number) => Math.round(v * 100) / 100;

/** Base amount → amount in currency `c`, rounded to cents (what gets stored) */
export const toRaw = (base: number, rates: Rates, c: Currency) => round2(base * rate(rates, c));

export const txToBase = (t: Transaction, rates: Rates): Transaction => ({ ...t, amount: t.amount / rate(rates, t.currency) });
export const transferToBase = (x: Transfer, rates: Rates): Transfer => ({ ...x, amount: x.amount / rate(rates, x.currency) });
export const recurringToBase = (r: RecurringPayment, rates: Rates): RecurringPayment => ({ ...r, amount: r.amount / rate(rates, r.currency) });
export const goalToBase = (g: Goal, rates: Rates): Goal => {
  const k = rate(rates, g.currency);
  return { ...g, target: g.target / k, saved: g.saved / k, monthlyContribution: g.monthlyContribution / k };
};

/** Everything the pages read, in base currency */
export function toBaseData(raw: RawData, rates: Rates): UserData {
  return {
    accounts: raw.accounts.map(a => ({ ...a, openingBalance: a.openingBalance / rate(rates, a.currency) })),
    transactions: raw.transactions.map(t => txToBase(t, rates)),
    transfers: raw.transfers.map(x => transferToBase(x, rates)),
    recurring: raw.recurring.map(r => recurringToBase(r, rates)),
    allocations: Object.fromEntries(Object.entries(raw.allocations).map(([c, v]) => [c, v / rate(rates, raw.allocCurrency[c])])),
    goals: raw.goals.map(g => goalToBase(g, rates)),
  };
}
