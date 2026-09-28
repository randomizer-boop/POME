// End-to-end checks of the finance model through the same pure function the UI uses.
import { describe, expect, it } from 'vitest';
import type { Account, Goal, Period, RecurringPayment, Transaction, Transfer } from '../shared/types';
import { summarize, type SummaryInput } from './useMonthSummary';
import { toBaseData, type RawData, type Rates } from '../data/currency';
import { SAFETY_BUFFER_RATE } from '../modules/safe-to-spend/logic';

const p: Period = { year: 2026, index: 8, current: 20, total: 30 };   // 20 Sep 2026
const accounts: Account[] = [{ id: 'cash', openingBalance: 200 }, { id: 'main', openingBalance: 1000 }, { id: 'savings', openingBalance: 5000 }];
const tx = (id: string, date: string, category: string, amount: number, accountId: Transaction['accountId'] = 'main', extra: Partial<Transaction> = {}): Transaction =>
  ({ id, date, description: id, category, amount, accountId, ...extra });
const rent: RecurringPayment = { id: 'rent', name: 'Rent', category: 'Housing', amount: 800, accountId: 'main', frequency: 'monthly', day: 25, active: true };
const salary: RecurringPayment = { id: 'sal', name: 'Salary', category: 'Income', amount: 3000, accountId: 'main', frequency: 'monthly', day: 28, active: true };

function run(over: Partial<SummaryInput> = {}) {
  const txs = over.allTransactions ?? over.transactions ?? [];
  const xs = over.allTransfers ?? over.transfers ?? [];
  return summarize({
    period: p, accounts, recurring: [], allocations: {}, goals: [],
    transactions: txs, transfers: xs, allTransactions: txs, allTransfers: xs,
    ...over,
  });
}

describe('transfers between own accounts', () => {
  const xs: Transfer[] = [
    { id: 'x1', date: '2026-09-05', from: 'main', to: 'cash', amount: 100 },
    { id: 'x2', date: '2026-09-06', from: 'main', to: 'savings', amount: 300 },
  ];
  it('are never income or expenses', () => {
    const s = run({ transfers: xs });
    expect(s.income).toBe(0);
    expect(s.expenses).toBe(0);
  });
  it('main → cash keeps the spendable balance; main → savings reduces it and counts as saved', () => {
    const s = run({ transfers: xs });
    expect(s.balances).toEqual({ cash: 300, main: 600, savings: 5300 });
    expect(s.liquidBalance).toBe(900);              // cash + main, savings excluded
    expect(s.totalBalance).toBe(6200);              // unchanged by transfers
    expect(s.saved).toBe(300);
  });
});

describe('recurring: planned vs actual', () => {
  it('an unpaid bill is planned only — not an expense, not in the budget', () => {
    const s = run({ recurring: [rent], allocations: { Housing: 1000 } });
    expect(s.expenses).toBe(0);
    expect(s.billsUpcoming).toBe(800);
    expect(s.budget[0]).toMatchObject({ spent: 0, remaining: 1000 });
    expect(s.safe.upcomingBills).toBe(800);
  });
  it('once paid it becomes an actual expense and leaves "upcoming"', () => {
    const paid = tx('p', '2026-09-20', 'Housing', -800, 'main', { recurringId: 'rent' });
    const s = run({ recurring: [rent], allocations: { Housing: 1000 }, transactions: [paid] });
    expect(s.expenses).toBe(800);
    expect(s.billsPaid).toBe(800);
    expect(s.billsUpcoming).toBe(0);
    expect(s.flexibleSpent).toBe(0);                 // a bill is not flexible spending
    expect(s.budget[0]).toMatchObject({ spent: 800, remaining: 200 });
    // counted once: balance went down by 800, nothing reserved any more
    expect(s.safe.liquidBalance).toBe(400);
    expect(s.safe.upcomingBills).toBe(0);
  });
});

describe('future income (pay cycle)', () => {
  it('salary later this month is not spent in advance: the money must last until payday', () => {
    const s = run({ recurring: [salary] });
    expect(s.expectedIncome).toBe(3000);             // month forecast still knows about it
    expect(s.income).toBe(0);                        // not actual yet
    expect(s.cycle.mode).toBe('income');
    expect(s.cycle.end).toBe('2026-09-27');          // day before the 28th
    expect(s.safe.daysLeft).toBe(8);                 // 20 … 27
    expect(s.safe.spendable).toBe(1200);             // balance only
  });
  it('is not counted twice once received (linked or added by hand)', () => {
    const today = { ...p, current: 28 };
    const linked = run({ period: today, recurring: [salary], transactions: [tx('s', '2026-09-28', 'Income', 3000, 'main', { recurringId: 'sal' })] });
    const byHand = run({ period: today, recurring: [salary], transactions: [tx('s', '2026-09-28', 'Income', 3000)] });
    for (const s of [linked, byHand]) {
      expect(s.safe.expectedIncome).toBe(0);
      expect(s.income).toBe(3000);
      expect(s.safe.spendable).toBe(4200 - 3000 * SAFETY_BUFFER_RATE);
      expect(s.cycle.end).toBe('2026-10-27');
    }
  });
  it('salary due today but not recorded yet counts as arriving today', () => {
    const s = run({ period: { ...p, current: 28 }, recurring: [salary] });
    expect(s.safe.expectedIncome).toBe(3000);
    expect(s.safe.spendable).toBe(1200 + 3000 - 3000 * SAFETY_BUFFER_RATE);
  });
  it('bills before the next payday are reserved even if they fall in the next month', () => {
    const rentOn1st = { ...rent, day: 1 };   // due Oct 1, salary Oct 28 → reserved now
    const s = run({ period: { ...p, current: 29 }, recurring: [salary, rentOn1st],
      transactions: [tx('s', '2026-09-28', 'Income', 3000, 'main', { recurringId: 'sal' }), tx('r', '2026-09-01', 'Housing', -800, 'main', { recurringId: 'rent' })] });
    expect(s.cycle.bills.map(b => b.date)).toEqual(['2026-10-01']);
    expect(s.safe.upcomingBills).toBe(800);
  });
  it('an unpaid bill from earlier this month stays reserved after payday', () => {
    const salary10 = { ...salary, day: 10 };
    const rent5 = { ...rent, day: 5 };
    const s = run({ recurring: [salary10, rent5], transactions: [tx('s', '2026-09-10', 'Income', 3000, 'main', { recurringId: 'sal' })] });
    expect(s.cycle.start).toBe('2026-09-10');
    // Sep 5 is overdue and still to pay; Oct 5 comes before the next salary (Oct 10)
    expect(s.cycle.bills.map(b => b.date)).toEqual(['2026-09-05', '2026-10-05']);
  });
  it('a bill due on payday itself is reserved too', () => {
    const rentOn28 = { ...rent, day: 28 };
    const s = run({ recurring: [salary, rentOn28] });   // today 20th, both on the 28th
    expect(s.cycle.end).toBe('2026-09-27');
    expect(s.safe.upcomingBills).toBe(800);
  });
  it('fixes the end-of-month spike: on the 29th the money lasts until the next salary, not 2 days', () => {
    const s = run({ period: { ...p, current: 29 }, recurring: [salary], transactions: [tx('s', '2026-09-28', 'Income', 3000, 'main', { recurringId: 'sal' })] });
    expect(s.safe.daysLeft).toBe(29);                // 29 Sep … 27 Oct
  });
  it('without income rules it falls back to the calendar month', () => {
    const s = run();
    expect(s.cycle.mode).toBe('month');
    expect(s.safe.daysLeft).toBe(11);
  });
  it('a fixed safety buffer replaces the automatic 5%', () => {
    const txs = [tx('i', '2026-09-01', 'Income', 4000)];
    expect(run({ transactions: txs }).safe.safetyBuffer).toBe(200);
    const custom = summarize({ period: p, accounts, recurring: [], allocations: {}, goals: [], transactions: txs, transfers: [], allTransactions: txs, allTransfers: [] }, { safetyBuffer: 50 });
    expect(custom.safe.safetyBuffer).toBe(50);
    expect(custom.safe.spendable).toBe(5200 - 50);
  });
});

describe('savings rate', () => {
  it('is money actually set aside / income, not income − expenses', () => {
    const s = run({
      transactions: [tx('i', '2026-09-01', 'Income', 4000), tx('e', '2026-09-02', 'Groceries', -1000)],
      transfers: [{ id: 'x', date: '2026-09-03', from: 'main', to: 'savings', amount: 400 }],
    });
    expect(s.savingsRate).toBe(10);                  // 400 / 4000, not (4000−1000)/4000 = 75
  });
  it('is 0 with no income', () => {
    expect(run().savingsRate).toBe(0);
  });
});

describe('edge cases', () => {
  it('0 income and no data: all zeros, no NaN', () => {
    const s = run({ accounts: accounts.map(a => ({ ...a, openingBalance: 0 })) });
    for (const v of [s.safe.spendable, s.safe.todayLimit, s.safe.dailyPace, s.expenseShare, s.forecast.projectedEndBalance]) {
      expect(Number.isFinite(v)).toBe(true);
    }
    expect(s.safe.status).toBe('ok');
  });
  it('negative balance → over, forecast negative', () => {
    const s = run({ transactions: [tx('big', '2026-09-10', 'Shopping', -1500)] });
    expect(s.liquidBalance).toBe(-300);
    expect(s.safe.status).toBe('over');
    expect(s.safe.todayLimit).toBe(0);
    expect(s.forecast.projectedEndBalance).toBeLessThan(0);
  });
  it('goal contributions: only what is still to be moved is reserved', () => {
    const goals: Goal[] = [{ id: 'g', name: 'Trip', target: 3000, saved: 0, deadline: '2027-06-30', monthlyContribution: 500 }];
    const s = run({ goals, transfers: [{ id: 'x', date: '2026-09-02', from: 'main', to: 'savings', amount: 200 }] });
    expect(s.safe.goalsLeft).toBe(300);
    expect(s.liquidBalance).toBe(1000);
    expect(s.safe.spendable).toBe(700);             // 1000 − 300 (no income → no buffer)
  });
});

describe('several currencies', () => {
  const rates: Rates = { USD: 1, KZT: 500, MNT: 3500, EUR: 0.9, CNY: 7 };
  const raw: RawData = {
    accounts: [{ id: 'cash', openingBalance: 50_000, currency: 'KZT' }, { id: 'main', openingBalance: 100, currency: 'USD' }, { id: 'savings', openingBalance: 0, currency: 'USD' }],
    transactions: [
      { id: 'a', date: '2026-09-02', description: '', category: 'Groceries', amount: -15_000, accountId: 'cash', currency: 'KZT' },
      { id: 'b', date: '2026-09-03', description: '', category: 'Dining', amount: -9, accountId: 'main', currency: 'EUR' },
    ],
    transfers: [], recurring: [], goals: [], allocations: { Groceries: 20_000 }, allocCurrency: { Groceries: 'KZT' },
  };
  it('everything is summed in the base currency and shows back exactly', () => {
    const d = toBaseData(raw, rates);
    const s = run({ accounts: d.accounts, transactions: d.transactions, allocations: d.allocations });
    expect(s.balances.cash * rates.KZT).toBeCloseTo(35_000, 6);          // 50 000 − 15 000 ₸
    expect(s.balances.main).toBeCloseTo(90, 6);                          // 100 $ − 9 € (= 10 $)
    expect(s.expenses).toBeCloseTo(40, 6);                               // 30 $ + 10 $
    expect(s.budget[0].remaining * rates.KZT).toBeCloseTo(5_000, 6);    // 20 000 − 15 000 ₸
  });
});
