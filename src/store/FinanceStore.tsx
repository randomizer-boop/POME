// ─── Finance store ────────────────────────────────────────────────────────────
// Single source of truth for the period's data + the only place that mutates it.
//
//   demo mode → sample data from data/seed.ts, read-only (actions are refused)
//   user mode → data loaded from Neon; changes are applied optimistically and
//               rolled back if the database rejects them
//
// Actions return whether the change was accepted, so forms can show the right state.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Account, Allocations, Goal, Period, RecurringPayment, Transaction, Transfer, AccountType } from '../shared/types';
import { currentPeriod, inPeriod, isoDay, monthDiff, shiftPeriod } from '../shared/config';
import * as seed from '../data/seed';
import { loadUserData, repo } from '../data/repository';
import { neon } from '../lib/neon';
import { useSession } from './Session';
import { t } from '../shared/i18n';
import { useSettings } from './Settings';
import { toBaseData, toRaw, type RawData } from '../data/currency';
import { openingFor } from '../modules/accounts/logic';

export type Notice = { kind: 'readOnly' } | { kind: 'error'; message: string };

interface FinanceState {
  /** The month being viewed */
  period: Period;
  /** The real current month (today) */
  today: Period;
  /** true when looking at the real current month (not history) */
  isCurrentMonth: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  /** −1 = previous month, +1 = next (never past the current month) */
  shiftMonth: (delta: number) => void;
  goToCurrentMonth: () => void;
  /** true in demo mode — nothing can be changed */
  readOnly: boolean;
  loading: boolean;
  loadError: string | null;
  accounts: Account[];
  /** This month only — what every page shows */
  transactions: Transaction[];
  transfers: Transfer[];
  /** Full history — needed for account balances */
  allTransactions: Transaction[];
  allTransfers: Transfer[];
  recurring: RecurringPayment[];
  allocations: Allocations;
  goals: Goal[];
  notice: Notice | null;
  dismissNotice: () => void;
  reload: () => void;
}

interface FinanceActions {
  /** In demo mode shows the "sign in to save" notice and returns true (= blocked) */
  guard: () => boolean;
  /** Adds an income/expense; returns its id, or null if refused (demo) */
  addTransaction: (tx: Omit<Transaction, 'id'>) => string | null;
  removeTransaction: (id: string) => boolean;
  addTransfer: (x: Omit<Transfer, 'id'>) => boolean;
  addRecurring: (r: Omit<RecurringPayment, 'id' | 'active'>) => boolean;
  toggleRecurring: (id: string) => boolean;
  /** Records today's payment of a recurring bill (a transaction linked to it) */
  payRecurring: (id: string) => boolean;
  addGoal: (g: Omit<Goal, 'id'>) => boolean;
  /** Adds (or, with a negative amount, takes back) money to a goal */
  /** Top up a goal. From cash/main this is a real transfer into Savings (so the money leaves
   *  the spending balance); from 'savings' the money is already set aside — only the goal changes. */
  contributeToGoal: (id: string, amount: number, from?: AccountType) => boolean;
  removeGoal: (id: string) => boolean;
  removeTransfer: (id: string) => boolean;
  /** "There is X on this account now" — stores the matching opening balance */
  setAccountBalance: (id: AccountType, current: number) => boolean;
  /** "Already paid": link an expense the user recorded earlier to a recurring payment */
  linkPayment: (recurringId: string, txId: string) => boolean;
  removeRecurring: (id: string) => boolean;
  /** Creates or changes a category's monthly limit */
  setAllocation: (category: string, planned: number) => boolean;
  removeAllocation: (category: string) => boolean;
}

const Ctx = createContext<(FinanceState & FinanceActions) | null>(null);

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;

const DEMO: RawData = {
  accounts: seed.accounts,
  transactions: seed.transactions,
  transfers: seed.transfers,
  recurring: seed.recurringPayments,
  allocations: seed.allocations,
  goals: seed.goals,
  allocCurrency: {},
};

const EMPTY: RawData = { accounts: [], transactions: [], transfers: [], recurring: [], allocations: {}, goals: [], allocCurrency: {} };

export function FinanceProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const readOnly = status !== 'user';
  // New amounts are saved in the currency they were typed in (the one selected in the sidebar)
  const { rates, currency: inputCurrency } = useSettings();

  // Real date, taken once when the app opens
  const [today] = useState<Period>(() => currentPeriod());
  const [offset, setOffset] = useState(0);            // 0 = this month, −1 = last month…
  const period = useMemo(() => shiftPeriod(today, offset), [today, offset]);
  // `data` is raw (each row in its own currency); `view` is what pages get — all in base currency
  const [data, setData] = useState<RawData>(readOnly ? DEMO : EMPTY);
  const view = useMemo(() => toBaseData(data, rates), [data, rates]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Load the right data set whenever the session changes
  useEffect(() => {
    if (status !== 'user' || !neon) { setData(DEMO); setLoading(false); setLoadError(null); return; }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    loadUserData(neon)
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [status, reloadKey]);

  /** Apply locally now, persist in the background, undo if it fails */
  const commit = useCallback((apply: (d: RawData) => RawData, persist: () => Promise<void>) => {
    let before: RawData | null = null;
    setData(d => { before = d; return apply(d); });
    persist().catch(e => {
      if (before) setData(before);
      const message = e instanceof Error ? e.message : String(e);
      // DB is older than the app: point to the migration instead of a raw SQL error
      setNotice({ kind: 'error', message: /column "?currency"?/i.test(message) ? t('errMigration') : message });
    });
  }, []);

  const refuse = useCallback(() => { setNotice({ kind: 'readOnly' }); return false; }, []);

  const guard = useCallback(() => { if (readOnly) { refuse(); return true; } return false; }, [readOnly, refuse]);

  /** Inserts a transaction whose amount is already in its own currency */
  const insertRawTransaction = useCallback((tx: Omit<Transaction, 'id'>) => {
    if (readOnly || !neon) { refuse(); return null; }
    const db = neon;
    const full: Transaction = { ...tx, id: newId() };
    commit(d => ({ ...d, transactions: [full, ...d.transactions] }), () => repo.insertTransaction(db, full));
    return full.id;
  }, [readOnly, commit, refuse]);

  /** `tx.amount` is in base currency (as all forms pass it) */
  const addTransaction = useCallback((tx: Omit<Transaction, 'id'>) =>
    insertRawTransaction({ ...tx, amount: toRaw(tx.amount, rates, inputCurrency), currency: inputCurrency }),
  [insertRawTransaction, rates, inputCurrency]);

  const removeTransaction = useCallback((id: string) => {
    if (readOnly || !neon) return refuse();
    const db = neon;
    commit(d => ({ ...d, transactions: d.transactions.filter(t => t.id !== id) }), () => repo.deleteTransaction(db, id));
    return true;
  }, [readOnly, commit, refuse]);

  const addTransfer = useCallback((x: Omit<Transfer, 'id'>) => {
    if (readOnly || !neon) return refuse();
    const db = neon;
    const full: Transfer = { ...x, id: newId(), amount: toRaw(x.amount, rates, inputCurrency), currency: inputCurrency };
    commit(d => ({ ...d, transfers: [full, ...d.transfers] }), () => repo.insertTransfer(db, full));
    return true;
  }, [readOnly, commit, refuse, rates, inputCurrency]);

  const addRecurring = useCallback((r: Omit<RecurringPayment, 'id' | 'active'>) => {
    if (readOnly || !neon) return refuse();
    const db = neon;
    const full: RecurringPayment = { ...r, id: newId(), active: true, amount: toRaw(r.amount, rates, inputCurrency), currency: inputCurrency };
    commit(d => ({ ...d, recurring: [...d.recurring, full] }), () => repo.insertRecurring(db, full));
    return true;
  }, [readOnly, commit, refuse, rates, inputCurrency]);

  const toggleRecurring = useCallback((id: string) => {
    if (readOnly || !neon) return refuse();
    const db = neon;
    const current = data.recurring.find(r => r.id === id);
    if (!current) return false;
    const active = !current.active;
    commit(d => ({ ...d, recurring: d.recurring.map(r => (r.id === id ? { ...r, active } : r)) }), () => repo.setRecurringActive(db, id, active));
    return true;
  }, [readOnly, commit, refuse, data.recurring]);

  const payRecurring = useCallback((id: string) => {
    const r = data.recurring.find(x => x.id === id);
    if (!r) return false;
    // same currency as the payment itself → exactly the same amount
    return insertRawTransaction({
      date: isoDay(period, period.current), description: r.name, category: r.category,
      // bill → money out; planned income (salary) → money in
      amount: r.category === 'Income' ? r.amount : -r.amount, accountId: r.accountId, recurringId: r.id, currency: r.currency ?? 'USD',
    }) !== null;
  }, [data.recurring, insertRawTransaction, period]);

  const addGoal = useCallback((g: Omit<Goal, 'id'>) => {
    if (readOnly || !neon) return refuse();
    const db = neon;
    const full: Goal = {
      ...g, id: newId(), currency: inputCurrency,
      target: toRaw(g.target, rates, inputCurrency), saved: toRaw(g.saved, rates, inputCurrency),
      monthlyContribution: toRaw(g.monthlyContribution, rates, inputCurrency),
    };
    commit(d => ({ ...d, goals: [...d.goals, full].sort((a, b) => a.deadline.localeCompare(b.deadline)) }), () => repo.insertGoal(db, full));
    return true;
  }, [readOnly, commit, refuse, rates, inputCurrency]);

  const contributeToGoal = useCallback((id: string, amount: number, from: AccountType = 'main') => {
    if (readOnly || !neon) return refuse();
    const db = neon;
    const goal = data.goals.find(g => g.id === id);
    if (!goal || !(amount > 0)) return false;
    const saved = Math.max(0, goal.saved + toRaw(amount, rates, goal.currency ?? 'USD'));
    const transfer: Transfer | null = from === 'savings' ? null : {
      id: newId(), date: isoDay(today, today.current), from, to: 'savings',
      amount: toRaw(amount, rates, inputCurrency), currency: inputCurrency, note: goal.name,
    };
    commit(
      d => ({
        ...d,
        goals: d.goals.map(g => (g.id === id ? { ...g, saved } : g)),
        transfers: transfer ? [transfer, ...d.transfers] : d.transfers,
      }),
      async () => {
        if (transfer) await repo.insertTransfer(db, transfer);
        try { await repo.setGoalSaved(db, id, saved); }
        catch (e) { if (transfer) await repo.deleteTransfer(db, transfer.id).catch(() => undefined); throw e; } // keep both in sync
      },
    );
    return true;
  }, [readOnly, commit, refuse, data.goals, rates, inputCurrency, today]);

  const removeGoal = useCallback((id: string) => {
    if (readOnly || !neon) return refuse();
    const db = neon;
    commit(d => ({ ...d, goals: d.goals.filter(g => g.id !== id) }), () => repo.deleteGoal(db, id));
    return true;
  }, [readOnly, commit, refuse]);

  const linkPayment = useCallback((recurringId: string, txId: string) => {
    if (readOnly || !neon) return refuse();
    const db = neon;
    commit(d => ({ ...d, transactions: d.transactions.map(tx => (tx.id === txId ? { ...tx, recurringId } : tx)) }), () => repo.linkTransaction(db, txId, recurringId));
    return true;
  }, [readOnly, commit, refuse]);

  const setAccountBalance = useCallback((id: AccountType, current: number) => {
    if (readOnly || !neon) return refuse();
    const db = neon;
    const opening = toRaw(openingFor(id, current, view.transactions, view.transfers), rates, inputCurrency);
    commit(
      d => ({ ...d, accounts: d.accounts.map(a => (a.id === id ? { ...a, openingBalance: opening, currency: inputCurrency } : a)) }),
      () => repo.setOpeningBalance(db, id, opening, inputCurrency),
    );
    return true;
  }, [readOnly, commit, refuse, view, rates, inputCurrency]);

  const removeTransfer = useCallback((id: string) => {
    if (readOnly || !neon) return refuse();
    const db = neon;
    commit(d => ({ ...d, transfers: d.transfers.filter(x => x.id !== id) }), () => repo.deleteTransfer(db, id));
    return true;
  }, [readOnly, commit, refuse]);

  const removeRecurring = useCallback((id: string) => {
    if (readOnly || !neon) return refuse();
    const db = neon;
    commit(d => ({
      ...d,
      recurring: d.recurring.filter(r => r.id !== id),
      // mirror "on delete set null": past payments stay as ordinary expenses
      transactions: d.transactions.map(tx => (tx.recurringId === id ? { ...tx, recurringId: undefined } : tx)),
    }), () => repo.deleteRecurring(db, id));
    return true;
  }, [readOnly, commit, refuse]);

  const setAllocation = useCallback((category: string, planned: number) => {
    if (readOnly || !neon) return refuse();
    const db = neon;
    const raw = toRaw(planned, rates, inputCurrency);
    commit(
      d => ({ ...d, allocations: { ...d.allocations, [category]: raw }, allocCurrency: { ...d.allocCurrency, [category]: inputCurrency } }),
      () => repo.upsertAllocation(db, category, raw, inputCurrency),
    );
    return true;
  }, [readOnly, commit, refuse, rates, inputCurrency]);

  const removeAllocation = useCallback((category: string) => {
    if (readOnly || !neon) return refuse();
    const db = neon;
    commit(d => {
      const allocations = { ...d.allocations };
      delete allocations[category];
      return { ...d, allocations };
    }, () => repo.deleteAllocation(db, category));
    return true;
  }, [readOnly, commit, refuse]);

  // History goes back to the month of the oldest transaction/transfer
  const minOffset = useMemo(() => {
    const dates = [...data.transactions.map(t => t.date), ...data.transfers.map(x => x.date)];
    if (!dates.length) return 0;
    const oldest = dates.reduce((a, b) => (a < b ? a : b));
    return Math.min(0, monthDiff(today, { year: Number(oldest.slice(0, 4)), index: Number(oldest.slice(5, 7)) - 1 }));
  }, [data.transactions, data.transfers, today]);
  const shiftMonth = useCallback((delta: number) => setOffset(o => Math.max(minOffset, Math.min(0, o + delta))), [minOffset]);
  const goToCurrentMonth = useCallback(() => setOffset(0), []);
  // leaving the account/demo → back to this month
  useEffect(() => { setOffset(0); }, [status]);

  const value = useMemo(() => ({
    period, readOnly, loading, loadError,
    today, isCurrentMonth: offset === 0, canGoBack: offset > minOffset, canGoForward: offset < 0, shiftMonth, goToCurrentMonth,
    accounts: view.accounts,
    transactions: view.transactions.filter(t => inPeriod(t.date, period)),
    transfers: view.transfers.filter(x => inPeriod(x.date, period)),
    allTransactions: view.transactions,
    allTransfers: view.transfers,
    recurring: view.recurring,
    allocations: view.allocations,
    goals: view.goals,
    notice,
    dismissNotice: () => setNotice(null),
    reload: () => setReloadKey(k => k + 1),
    guard, addTransaction, removeTransaction, addTransfer, addRecurring, toggleRecurring,
    payRecurring, addGoal, contributeToGoal, removeGoal, removeTransfer, removeRecurring, setAllocation, removeAllocation, linkPayment, setAccountBalance,
  }), [period, today, offset, minOffset, shiftMonth, goToCurrentMonth, readOnly, loading, loadError, view, notice, guard, addTransaction, removeTransaction, addTransfer, addRecurring, toggleRecurring,
    payRecurring, addGoal, contributeToGoal, removeGoal, removeTransfer, removeRecurring, setAllocation, removeAllocation, linkPayment, setAccountBalance]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFinance() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useFinance must be used inside <FinanceProvider>');
  return ctx;
}
