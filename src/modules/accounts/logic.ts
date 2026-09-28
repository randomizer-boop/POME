import type { Account, AccountType, Transaction, Transfer } from '../../shared/types';
import { add, sub, sum } from '../../shared/money';

export type Balances = Record<AccountType, number>;

/** Accounts whose money can be spent day to day. Savings is money already set aside. */
export const LIQUID_ACCOUNTS: AccountType[] = ['cash', 'main'];

/** Signed movement of one account: its transactions + transfers in − transfers out */
function netFlow(id: AccountType, txs: Transaction[], transfers: Transfer[]): number {
  return sum([
    ...txs.filter(t => t.accountId === id).map(t => t.amount),
    ...transfers.filter(x => x.to === id).map(x => x.amount),
    ...transfers.filter(x => x.from === id).map(x => -x.amount),
  ]);
}

/** Current balance of every account = opening balance + all its history */
export function accountBalances(accs: Account[], txs: Transaction[], transfers: Transfer[]): Balances {
  return Object.fromEntries(accs.map(a => [a.id, add(a.openingBalance, netFlow(a.id, txs, transfers))])) as Balances;
}

/** Sum of balances (all accounts, or only `ids`) */
export const totalBalance = (b: Balances, ids: AccountType[] = Object.keys(b) as AccountType[]) => sum(ids.map(id => b[id] ?? 0));

/** Money in / out of one account this period (transfers included — they move money between accounts) */
export function accountFlow(id: AccountType, txs: Transaction[], transfers: Transfer[]) {
  const inc = sum([...txs.filter(t => t.accountId === id && t.amount > 0).map(t => t.amount), ...transfers.filter(x => x.to === id).map(x => x.amount)]);
  const out = sum([...txs.filter(t => t.accountId === id && t.amount < 0).map(t => -t.amount), ...transfers.filter(x => x.from === id).map(x => x.amount)]);
  return { inc, out };
}

/** Opening balance that makes the account show `current` right now, given all its history */
export const openingFor = (id: AccountType, current: number, txs: Transaction[], transfers: Transfer[]) =>
  sub(current, netFlow(id, txs, transfers));

/** Net amount moved into Savings this period — intentional saving (transfers are never income/expense) */
export const savedThisPeriod = (transfers: Transfer[]) =>
  sum(transfers.map(x => (x.to === 'savings' ? x.amount : 0) - (x.from === 'savings' ? x.amount : 0)));

/** Savings rate = money intentionally set aside / income (not "income − expenses") */
export const savingsRate = (saved: number, income: number) => (income > 0 ? Math.round((Math.max(0, saved) / income) * 100) : 0);

export type TransferError = 'amount' | 'same' | 'insufficient' | null;

export function validateTransfer(from: AccountType, to: AccountType, amount: number, balances: Balances): TransferError {
  if (!Number.isFinite(amount) || amount <= 0) return 'amount';
  if (from === to) return 'same';
  if (amount > balances[from] + 1e-9) return 'insufficient';
  return null;
}

// ─── Reconciliation ───────────────────────────────────────────────────────────
// The whole model stands on balances being right; if some spending isn't recorded
// they drift. Every week we ask to compare with the bank (✎ "set current balance").

export const RECONCILE_EVERY_DAYS = 7;

/** `last` / `today` are YYYY-MM-DD; no `last` yet → start counting from today */
export function needsReconcile(last: string | null, today: string, hasTransactions: boolean): boolean {
  if (!hasTransactions || !last) return false;
  const days = Math.round((Date.parse(today) - Date.parse(last)) / 86_400_000);
  return days >= RECONCILE_EVERY_DAYS;
}
