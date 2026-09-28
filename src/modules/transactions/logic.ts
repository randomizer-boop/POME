// Transactions are the only source of *actual* money movement.
// Transfers between own accounts are a separate entity and are never income or spending.
// Planned recurring payments are not transactions — they count only once paid (see recurring/logic).
import { dayOf, isoDay } from '../../shared/config';
import type { Period, Transaction } from '../../shared/types';
import { sum, sumBy } from '../../shared/money';

export const isIncome = (t: Transaction) => t.amount > 0;
export const isExpense = (t: Transaction) => t.amount < 0;
/** Payment of a recurring (mandatory) payment */
export const isBillPayment = (t: Transaction) => t.amount < 0 && !!t.recurringId;
/** Everything else that was spent — the part you can actually control */
export const isFlexibleExpense = (t: Transaction) => t.amount < 0 && !t.recurringId;

const sumAbs = (txs: Transaction[]) => sumBy(txs, t => Math.abs(t.amount));

/** Signed total (income − expenses) — e.g. a day's net in the list */
export const netTotal = (txs: Transaction[]) => sumBy(txs, t => t.amount);

export const incomeTotal = (txs: Transaction[]) => sumAbs(txs.filter(isIncome));
export const expenseTotal = (txs: Transaction[]) => sumAbs(txs.filter(isExpense));
export const billsPaidTotal = (txs: Transaction[]) => sumAbs(txs.filter(isBillPayment));
export const flexibleTotal = (txs: Transaction[]) => sumAbs(txs.filter(isFlexibleExpense));

/** Flexible spend for each day of the period (index 0 = day 1) */
export function flexibleByDay(txs: Transaction[], p: Period): number[] {
  const byDay: number[][] = Array.from({ length: p.total }, () => []);
  for (const t of txs) if (isFlexibleExpense(t)) byDay[dayOf(t.date) - 1]?.push(Math.abs(t.amount));
  return byDay.map(v => sum(v));
}

/** Flexible spend per category (only categories that have flexible spending) */
export function flexibleByCategory(txs: Transaction[]): Record<string, number> {
  const groups: Record<string, number[]> = {};
  for (const t of txs) if (isFlexibleExpense(t)) (groups[t.category] ??= []).push(Math.abs(t.amount));
  return Object.fromEntries(Object.entries(groups).map(([c, v]) => [c, sum(v)]));
}

/** Running total of all expenses, day 1 … today */
export function cumulativeExpenses(txs: Transaction[], p: Period): number[] {
  const perDay: number[][] = Array.from({ length: p.current }, () => []);
  for (const t of txs) {
    const d = dayOf(t.date);
    if (isExpense(t) && d <= p.current) perDay[d - 1].push(Math.abs(t.amount));
  }
  let run = 0;
  return perDay.map(v => (run = sum([run, ...v])));
}

// ─── Quick add ────────────────────────────────────────────────────────────────

export type TxDraftError = 'amount' | 'date' | null;

/** `date` is YYYY-MM-DD; any past day is fine (to add forgotten ones), the future is not */
export function validateTransactionDraft(amount: number, date: string, today: Period): TxDraftError {
  if (!Number.isFinite(amount) || amount <= 0) return 'amount';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) return 'date';
  if (date > isoDay(today, today.current) || date < '2000-01-01') return 'date';
  return null;
}
