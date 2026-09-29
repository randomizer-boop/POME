// ─── Domain types (shared by every module) ────────────────────────────────────
// In the app every money value is in the base currency (USD) and converted only for display.
// In the database each row keeps the currency it was entered in (`currency`), so 1 500 000 ₸
// stays exactly 1 500 000 ₸ whatever the exchange rate does; see data/currency.ts.

export type View =
  | 'overview' | 'accounts' | 'transactions' | 'budget'
  | 'goals' | 'recurring' | 'analytics' | 'forecast';

export type Currency = 'KZT' | 'MNT' | 'USD' | 'EUR' | 'CNY';

/** Accounting period the app is looking at */
export interface Period {
  year: number;
  index: number;    // 0-based month (8 = September)
  current: number;  // today's day of month
  total: number;    // days in month
}

export type AccountType = 'cash' | 'main' | 'savings';

export interface Account {
  id: AccountType;
  openingBalance: number; // balance before the first recorded transaction
  currency?: Currency;
}

/** Income (+) or expense (−). Transfers are a separate entity and never count as income/spending. */
export interface Transaction {
  id: string;
  date: string;           // YYYY-MM-DD
  description: string;
  category: string;
  amount: number;
  accountId: AccountType;
  recurringId?: string;   // set when the transaction pays a recurring payment
  currency?: Currency;    // currency it was entered in (missing = USD)
}

export interface Transfer {
  id: string;
  date: string;
  from: AccountType;
  to: AccountType;
  amount: number;         // always positive
  note?: string;
  currency?: Currency;
  /** set when this transfer is a contribution to a goal (Goals → Top up) */
  goalId?: string;
}

export type Frequency = 'monthly' | 'yearly';

/** Mandatory regular payment: rent, utilities, subscriptions… */
export interface RecurringPayment {
  id: string;
  name: string;
  category: string;
  amount: number;
  accountId: AccountType;
  frequency: Frequency;
  day: number;            // day of month it's charged
  month?: number;         // 0-based month, yearly only
  active: boolean;        // paused payments are ignored everywhere
  currency?: Currency;
  /** local date the rule was added (YYYY-MM-DD); occurrences before it aren't owed */
  createdAt?: string;
}

/** Planned monthly amount per category */
export type Allocations = Record<string, number>;

export interface BudgetCategory {
  name: string;
  allocated: number;
  spent: number;
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  saved: number;
  deadline: string;       // YYYY-MM-DD
  monthlyContribution: number;
  currency?: Currency;
}
