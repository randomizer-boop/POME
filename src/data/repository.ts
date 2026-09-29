// ─── Repository: the only place that knows the database shape ────────────────
// Maps DB rows (snake_case, money in minor units) ⇄ domain objects (camelCase,
// money in major units). Everything is scoped to the signed-in user by RLS,
// so queries never need a user_id filter.

import { toIso } from '../shared/dates';
import type { Account, AccountType, Allocations, Currency, Goal, RecurringPayment, Transaction, Transfer } from '../shared/types';
import type { NeonClient } from '../lib/neon';

// ─── Money ────────────────────────────────────────────────────────────────────

export const toMinor = (major: number) => Math.round(major * 100);
export const fromMinor = (minor: number | string) => Number(minor) / 100;

// ─── Row ⇄ domain mappers (pure, unit-tested) ─────────────────────────────────

type Row = Record<string, unknown>;

/** Amounts in a row are in this currency (rows from before the column existed are USD) */
const cur = (r: Row) => ((r.currency as Currency | null) ?? 'USD');

export const mapAccount = (r: Row): Account => ({
  id: r.id as AccountType,
  openingBalance: fromMinor(r.opening_balance_minor as number),
  currency: cur(r),
});

export const mapTransaction = (r: Row): Transaction => ({
  id: r.id as string,
  date: String(r.date).slice(0, 10),
  description: (r.description as string) ?? '',
  category: r.category as string,
  amount: fromMinor(r.amount_minor as number),
  accountId: r.account_id as AccountType,
  ...(r.recurring_id ? { recurringId: r.recurring_id as string } : {}),
  currency: cur(r),
});

export const transactionToRow = (t: Transaction) => ({
  id: t.id,
  date: t.date,
  description: t.description,
  category: t.category,
  amount_minor: toMinor(t.amount),
  account_id: t.accountId,
  recurring_id: t.recurringId ?? null,
  currency: t.currency ?? 'USD',
});

export const mapTransfer = (r: Row): Transfer => ({
  id: r.id as string,
  date: String(r.date).slice(0, 10),
  from: r.from_account as AccountType,
  to: r.to_account as AccountType,
  amount: fromMinor(r.amount_minor as number),
  ...(r.note ? { note: r.note as string } : {}),
  currency: cur(r),
  ...(r.goal_id ? { goalId: r.goal_id as string } : {}),
});

export const transferToRow = (x: Transfer) => ({
  id: x.id, date: x.date, from_account: x.from, to_account: x.to, amount_minor: toMinor(x.amount), note: x.note ?? null, currency: x.currency ?? 'USD',
  // only sent for goal contributions, so plain transfers keep working before migration 005
  ...(x.goalId ? { goal_id: x.goalId } : {}),
});

export const mapRecurring = (r: Row): RecurringPayment => ({
  id: r.id as string,
  name: r.name as string,
  category: r.category as string,
  amount: fromMinor(r.amount_minor as number),
  accountId: r.account_id as AccountType,
  frequency: r.frequency as RecurringPayment['frequency'],
  day: Number(r.day),
  ...(r.month !== null && r.month !== undefined ? { month: Number(r.month) } : {}),
  active: Boolean(r.active),
  currency: cur(r),
  ...(r.created_at ? { createdAt: localDate(String(r.created_at)) } : {}),
});

/** timestamptz → the user's local calendar date */
const localDate = (ts: string) => { const d = new Date(ts); return Number.isNaN(d.getTime()) ? ts.slice(0, 10) : toIso(d); };

export const recurringToRow = (r: RecurringPayment) => ({
  id: r.id, name: r.name, category: r.category, amount_minor: toMinor(r.amount), account_id: r.accountId,
  frequency: r.frequency, day: r.day, month: r.month ?? null, active: r.active, currency: r.currency ?? 'USD',
});

export const mapGoal = (r: Row): Goal => ({
  id: r.id as string,
  name: r.name as string,
  target: fromMinor(r.target_minor as number),
  saved: fromMinor(r.saved_minor as number),
  deadline: String(r.deadline).slice(0, 10),
  monthlyContribution: fromMinor(r.monthly_contribution_minor as number),
  currency: cur(r),
});

export const goalToRow = (g: Goal) => ({
  id: g.id, name: g.name, target_minor: toMinor(g.target), saved_minor: toMinor(g.saved),
  deadline: g.deadline, monthly_contribution_minor: toMinor(g.monthlyContribution), currency: g.currency ?? 'USD',
});

// ─── Queries ──────────────────────────────────────────────────────────────────

export interface UserData {
  accounts: Account[];
  transactions: Transaction[];
  transfers: Transfer[];
  recurring: RecurringPayment[];
  allocations: Allocations;
  goals: Goal[];
}

async function rows(q: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<Row[]> {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data as Row[] | null) ?? [];
}

const DEFAULT_ACCOUNTS: AccountType[] = ['cash', 'main', 'savings'];

/** Loads everything the app needs; creates the 3 default accounts on first sign-in */
export async function loadUserData(db: NeonClient): Promise<UserData & { allocCurrency: Record<string, Currency> }> {
  let accountRows = await rows(db.from('accounts').select('*'));
  if (accountRows.length === 0) {
    accountRows = await rows(db.from('accounts').insert(DEFAULT_ACCOUNTS.map(id => ({ id, opening_balance_minor: 0 }))).select());
  }
  const [tx, xs, rec, alloc, goals] = await Promise.all([
    rows(db.from('transactions').select('*').order('date', { ascending: false }).order('created_at', { ascending: false })),
    rows(db.from('transfers').select('*').order('date', { ascending: false })),
    rows(db.from('recurring_payments').select('*').order('day')),
    rows(db.from('budget_allocations').select('*')),
    rows(db.from('goals').select('*').order('deadline')),
  ]);
  return {
    accounts: DEFAULT_ACCOUNTS.map(id => accountRows.map(mapAccount).find(a => a.id === id) ?? { id, openingBalance: 0 }),
    transactions: tx.map(mapTransaction),
    transfers: xs.map(mapTransfer),
    recurring: rec.map(mapRecurring),
    allocations: Object.fromEntries(alloc.map(r => [r.category as string, fromMinor(r.planned_minor as number)])),
    allocCurrency: Object.fromEntries(alloc.map(r => [r.category as string, cur(r)])),
    goals: goals.map(mapGoal),
  };
}

/** The account's savings % (null = never chosen). Throws if migration 004 hasn't been run. */
export async function loadUserSettings(db: NeonClient): Promise<{ savingsRate: number | null }> {
  const r = await rows(db.from('user_settings').select('savings_rate'));
  const v = r[0] ? Number(r[0].savings_rate) : NaN;
  return { savingsRate: Number.isFinite(v) ? v : null };
}

// ─── Mutations ────────────────────────────────────────────────────────────────

const check = async (q: PromiseLike<{ error: { message: string } | null }>) => {
  const { error } = await q;
  if (error) throw new Error(error.message);
};

export const repo = {
  saveSavingsRate: (db: NeonClient, rate: number) =>
    check(db.from('user_settings').upsert({ savings_rate: Math.round(rate * 1000) / 1000, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })),
  insertTransaction: (db: NeonClient, t: Transaction) => check(db.from('transactions').insert(transactionToRow(t))),
  deleteTransaction: (db: NeonClient, id: string) => check(db.from('transactions').delete().eq('id', id)),
  insertTransfer: (db: NeonClient, x: Transfer) => check(db.from('transfers').insert(transferToRow(x))),
  insertRecurring: (db: NeonClient, r: RecurringPayment) => check(db.from('recurring_payments').insert(recurringToRow(r))),
  setRecurringActive: (db: NeonClient, id: string, active: boolean) =>
    check(db.from('recurring_payments').update({ active }).eq('id', id)),
  insertGoal: (db: NeonClient, g: Goal) => check(db.from('goals').insert(goalToRow(g))),
  setGoalSaved: (db: NeonClient, id: string, saved: number) =>
    check(db.from('goals').update({ saved_minor: toMinor(saved) }).eq('id', id)),
  deleteGoal: (db: NeonClient, id: string) => check(db.from('goals').delete().eq('id', id)),
  setOpeningBalance: (db: NeonClient, id: AccountType, opening: number, currency: Currency) =>
    check(db.from('accounts').update({ opening_balance_minor: toMinor(opening), currency }).eq('id', id)),
  /** Mark an existing expense as the payment of a recurring bill */
  linkTransaction: (db: NeonClient, txId: string, recurringId: string) =>
    check(db.from('transactions').update({ recurring_id: recurringId }).eq('id', txId)),
  deleteTransfer: (db: NeonClient, id: string) => check(db.from('transfers').delete().eq('id', id)),
  /** Linked transactions keep existing (their recurring_id becomes null) */
  deleteRecurring: (db: NeonClient, id: string) => check(db.from('recurring_payments').delete().eq('id', id)),
  upsertAllocation: (db: NeonClient, category: string, planned: number, currency: Currency) =>
    check(db.from('budget_allocations').upsert({ category, planned_minor: toMinor(planned), currency }, { onConflict: 'user_id,category' })),
  deleteAllocation: (db: NeonClient, category: string) => check(db.from('budget_allocations').delete().eq('category', category)),
};
