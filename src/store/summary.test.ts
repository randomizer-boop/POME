// End-to-end checks of the finance model through the same pure function the UI uses.
import { describe, expect, it } from 'vitest';
import type { Account, Goal, Period, RecurringPayment, Transaction, Transfer } from '../shared/types';
import { dayLimits, summarize, type SummaryInput } from './useMonthSummary';
import { toBaseData, type RawData, type Rates } from '../data/currency';

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
      expect(s.safe.spendable).toBe(4200);            // the savings % is a target, not deducted
      expect(s.cycle.end).toBe('2026-10-27');
    }
  });
  it('salary due today but not recorded yet counts as arriving today', () => {
    const s = run({ period: { ...p, current: 28 }, recurring: [salary] });
    expect(s.safe.expectedIncome).toBe(3000);
    expect(s.safe.spendable).toBe(1200 + 3000);
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
  it('the savings % comes from settings and is a target; a real transfer to Savings lowers spendable and counts as progress', () => {
    const txs = [tx('i', '2026-09-01', 'Income', 4000)];
    const all = { period: p, accounts, recurring: [], allocations: {}, goals: [], transactions: txs, transfers: [], allTransactions: txs, allTransfers: [] };
    expect(run({ transactions: txs }).safe.savingsTarget).toBe(200);            // default 5%
    const none = summarize(all, { savingsRate: 0.1 });
    expect(none.safe.savingsTarget).toBe(400);
    expect(none.safe.spendable).toBe(5200);                                     // 1200 + 4000, target not deducted
    const moved: Transfer[] = [{ id: 'x', date: '2026-09-02', from: 'main', to: 'savings', amount: 3000 }];
    const s = summarize({ ...all, transfers: moved, allTransfers: moved }, { savingsRate: 0.1 });
    expect(s.safe.savingsDone).toBe(400);                                       // target met
    expect(s.safe.spendable).toBe(2200);                                        // 5200 − 3000 actually moved
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
  it('goal contributions: only what is still to be moved INTO THE GOAL is reserved', () => {
    const goals: Goal[] = [{ id: 'g', name: 'Trip', target: 3000, saved: 200, deadline: '2027-06-30', monthlyContribution: 500 }];
    const s = run({ goals, transfers: [{ id: 'x', date: '2026-09-02', from: 'main', to: 'savings', amount: 200, goalId: 'g' }] });
    expect(s.safe.goalsLeft).toBe(300);
    expect(s.liquidBalance).toBe(1000);
    expect(s.safe.spendable).toBe(700);             // 1000 − 300
  });
  it('a plain transfer to Savings is NOT a goal contribution', () => {
    const goals: Goal[] = [{ id: 'g', name: 'Trip', target: 3000, saved: 0, deadline: '2027-06-30', monthlyContribution: 500 }];
    const s = run({ goals, transfers: [{ id: 'x', date: '2026-09-02', from: 'main', to: 'savings', amount: 200 }] });
    expect(s.safe.goalsLeft).toBe(500);             // still the whole contribution
  });
  it('older data: a transfer noted with the goal\'s name (before goal ids) still counts for that goal', () => {
    const goals: Goal[] = [{ id: 'g', name: 'Trip', target: 3000, saved: 200, deadline: '2027-06-30', monthlyContribution: 500 }];
    const s = run({ goals, transfers: [{ id: 'x', date: '2026-09-02', from: 'main', to: 'savings', amount: 200, note: 'Trip' }] });
    expect(s.safe.goalsLeft).toBe(300);
  });
  it('overpaying one goal doesn\'t cover another', () => {
    const goals: Goal[] = [
      { id: 'a', name: 'A', target: 5000, saved: 900, deadline: '2027-06-30', monthlyContribution: 300 },
      { id: 'b', name: 'B', target: 5000, saved: 0, deadline: '2027-06-30', monthlyContribution: 200 },
    ];
    const s = run({ goals, transfers: [{ id: 'x', date: '2026-09-02', from: 'main', to: 'savings', amount: 900, goalId: 'a' }] });
    expect(s.safe.goalsLeft).toBe(200);             // B is still due
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

describe('looking at an earlier day', () => {
  const txs = [
    tx('i', '2026-09-01', 'Income', 3000),
    tx('a', '2026-09-18', 'Groceries', -100),
    tx('b', '2026-09-19', 'Dining', -60),
    tx('c', '2026-09-20', 'Dining', -40),
  ];
  it('uses only what had happened by the end of that day', () => {
    const today = run({ transactions: txs });
    const yesterday = summarize({ period: p, accounts, recurring: [], allocations: {}, goals: [], transactions: txs, transfers: [], allTransactions: txs, allTransfers: [] }, { day: 19 });
    expect(today.safe.spentToday).toBe(40);
    expect(yesterday.safe.spentToday).toBe(60);
    expect(yesterday.safe.liquidBalance).toBe(today.safe.liquidBalance + 40);  // the 20th hadn't happened yet
    expect(yesterday.safe.daysLeft).toBe(today.safe.daysLeft + 1);
    // month numbers don't change with the day
    expect(yesterday.expenses).toBe(today.expenses);
  });
  it('never looks past the end of the month', () => {
    const s = summarize({ period: p, accounts, recurring: [], allocations: {}, goals: [], transactions: txs, transfers: [], allTransactions: txs, allTransfers: [] }, { day: 40 });
    expect(s.safe.daysLeft).toBe(1);             // clamped to 30 Sep
  });
});

describe('one daily limit everywhere', () => {
  const txs = [
    tx('i', '2026-09-01', 'Income', 3000),
    tx('a', '2026-09-18', 'Groceries', -100),
    tx('b', '2026-09-19', 'Dining', -500),
    tx('c', '2026-09-20', 'Dining', -40),
  ];
  const input = { period: p, accounts, recurring: [], allocations: {}, goals: [], transactions: txs, transfers: [], allTransactions: txs, allTransfers: [] };
  it('the calendar limit for today is exactly the card limit', () => {
    const limits = dayLimits(input);
    expect(limits).toHaveLength(20);
    expect(limits[19].limit).toBe(summarize(input).safe.todayLimit);
    expect(limits[19].spent).toBe(40);
  });
  it('each past day is compared with the limit that day had (not a month average)', () => {
    const limits = dayLimits(input);
    // on the 19th: (money at the start of the day) ÷ 12 days left
    const start19 = 4200 - 100;
    expect(limits[18].limit).toBeCloseTo(start19 / 12, 6);
    expect(limits[18].spent).toBe(500);
    expect(limits[18].spent > limits[18].limit).toBe(true);    // 500 > ~329 → red
    expect(limits[17].spent > limits[17].limit).toBe(false);   // 100 on the 18th → fine
  });
});

describe('goals (calendar month) vs savings % (pay cycle) — cycle crosses the month end', () => {
  // salary on the 25th; today 3 Oct → cycle 25 Sep … 24 Oct
  const oct: Period = { year: 2026, index: 9, current: 3, total: 31 };
  const salary25: RecurringPayment = { ...salary, day: 25 };
  const goal: Goal = { id: 'g', name: 'Trip', target: 5000, saved: 500, deadline: '2027-06-01', monthlyContribution: 500 };
  const txs = [tx('s', '2026-09-25', 'Income', 3000, 'main', { recurringId: 'sal' })];
  const input = (xs: Transfer[]) => ({
    period: oct, accounts, recurring: [salary25], allocations: {}, goals: [goal],
    transactions: txs.filter(t => t.date >= '2026-10'), transfers: xs.filter(x => x.date >= '2026-10'),
    allTransactions: txs, allTransfers: xs,
  });

  it('a plain transfer in the cycle counts toward the savings %, never toward the goal', () => {
    const s = summarize(input([{ id: 'x', date: '2026-10-02', from: 'main', to: 'savings', amount: 500 }]), { savingsRate: 0.1 });
    expect(s.cycle.start).toBe('2026-09-25');
    expect(s.safe.goalsLeft).toBe(500);
    expect(s.safe.savingsMoved).toBe(500);          // 10% of 3000 = 300 → 167% of the plan
  });

  it('an October top-up to the goal pays October\'s goal and does not count toward the %', () => {
    const s = summarize(input([{ id: 'x', date: '2026-10-02', from: 'main', to: 'savings', amount: 500, goalId: 'g' }]), { savingsRate: 0.1 });
    expect(s.safe.goalsLeft).toBe(0);
    expect(s.safe.goalsDone).toBe(500);
    expect(s.safe.savingsMoved).toBe(0);
  });

  it('a September top-up (inside the cycle) doesn\'t pay October\'s goal', () => {
    const s = summarize(input([{ id: 'x', date: '2026-09-26', from: 'main', to: 'savings', amount: 500, goalId: 'g' }]), { savingsRate: 0.1 });
    expect(s.safe.goalsLeft).toBe(500);
    expect(s.safe.savingsMoved).toBe(0);
  });
});

// ─── Bills paid early / partly / by an unrelated expense (real account, 29 Sep) ──
describe('mandatory bills ↔ the transactions that pay them', () => {
  const sep29: Period = { year: 2026, index: 8, current: 29, total: 30 };
  const accs: Account[] = [{ id: 'cash', openingBalance: 200_000 }, { id: 'main', openingBalance: 1_000_000 }, { id: 'savings', openingBalance: 1_500_000 }];
  const pay: RecurringPayment = { id: 'bill', name: 'Платеж', category: 'Housing', amount: 300_000, accountId: 'main', frequency: 'monthly', day: 5, active: true, createdAt: '2026-09-29' };
  const zp: RecurringPayment = { id: 'zp', name: 'Зарплата', category: 'Income', amount: 800_000, accountId: 'main', frequency: 'monthly', day: 5, active: true, createdAt: '2026-09-29' };
  const salaryTx = tx('s', '2026-09-05', 'Income', 800_000);                       // recorded by hand, not linked
  const food = tx('f', '2026-09-29', 'Groceries', -120_000, 'cash');
  const sum = (billTx: Transaction[], period = sep29) => {
    const all = [salaryTx, food, ...billTx];
    return summarize({ period, accounts: accs, recurring: [pay, zp], allocations: {}, goals: [],
      transactions: all.filter(t => t.date.startsWith(`${period.year}-${String(period.index + 1).padStart(2, '0')}`)), transfers: [],
      allTransactions: all, allTransfers: [] }, { savingsRate: 0.25 });
  };

  it('CASE 1 (the real account): paid on 29 Sep for 5 Oct → nothing left before payday', () => {
    const s = sum([tx('b', '2026-09-29', 'Housing', -300_000, 'main', { recurringId: 'bill' })]);
    expect(s.safe.liquidBalance).toBe(1_580_000);
    expect(s.safe.upcomingBills).toBe(0);
    expect(s.safe.goalsLeft).toBe(0);
    expect(s.safe.savingsTarget).toBe(200_000);                              // 25% of 800 000 — shown, not deducted
    expect(s.safe.spendable).toBe(1_580_000);
    expect(s.cycle.nextIncome).toBe('2026-10-05');
    expect(s.unpaid).toEqual([]);                                            // no "overdue since the 5th" either
  });

  it('CASE 2: no payment → the 5 Oct bill is reserved', () => {
    const s = sum([]);
    expect(s.safe.upcomingBills).toBe(300_000);
    expect(s.cycle.bills.map(b => b.date)).toEqual(['2026-10-05']);        // not 5 Sep: the bill was added on the 29th
  });

  it('CASE 3: partial payment → only the rest is reserved', () => {
    const s = sum([tx('b', '2026-09-29', 'Housing', -200_000, 'main', { recurringId: 'bill' })]);
    expect(s.safe.upcomingBills).toBe(100_000);
  });

  it('CASE 4: an unrelated 300 000 expense (other category) does not pay the bill', () => {
    const s = sum([tx('x', '2026-09-29', 'Shopping', -300_000, 'main')]);
    expect(s.safe.upcomingBills).toBe(300_000);
  });

  it('an unlinked expense that clearly is the bill (same category, account, amount) does pay it', () => {
    const s = sum([tx('b', '2026-09-29', 'Housing', -300_000, 'main')]);
    expect(s.safe.upcomingBills).toBe(0);
  });

  it('CASE 5: paid early in September → October is paid, November still comes', () => {
    const oct3: Period = { year: 2026, index: 9, current: 3, total: 31 };
    const s = sum([tx('b', '2026-09-29', 'Housing', -300_000, 'main', { recurringId: 'bill' })], oct3);
    expect(s.unpaid).toEqual([]);                                            // 5 Oct is covered
    expect(s.cycle.bills).toEqual([]);                                       // payday 5 Oct, nothing due before it
    const nov = sum([tx('b', '2026-09-29', 'Housing', -300_000, 'main', { recurringId: 'bill' })], { year: 2026, index: 10, current: 2, total: 30 });
    expect(nov.unpaid.map(r => r.id)).toEqual(['bill']);                     // 5 Nov is owed
  });

  it('a bill that was already overdue is closed first by a late payment (FIFO)', () => {
    const old = { ...pay, createdAt: '2026-08-20' };
    const all = [salaryTx, food, tx('b', '2026-09-29', 'Housing', -300_000, 'main', { recurringId: 'bill' })];
    const s = summarize({ period: sep29, accounts: accs, recurring: [old, zp], allocations: {}, goals: [],
      transactions: all, transfers: [], allTransactions: all, allTransfers: [] });
    expect(s.cycle.bills.map(b => b.date)).toEqual(['2026-10-05']);        // 5 Sep paid late on the 29th, 5 Oct still due
  });

  it('"already paid" in the setup wizard (dated the 5th, rule added the 29th) closes September, not October', () => {
    const s = sum([tx('b', '2026-09-05', 'Housing', -300_000, 'main', { recurringId: 'bill' })]);
    expect(s.unpaid).toEqual([]);
    expect(s.safe.upcomingBills).toBe(300_000);                              // 5 Oct still due
  });
});

describe('a later day of the month (forecast)', () => {
  const txs = [tx('i', '2026-09-01', 'Income', 3000), tx('a', '2026-09-20', 'Dining', -100)];
  const input = { period: p, accounts, recurring: [], allocations: {}, goals: [], transactions: txs, transfers: [], allTransactions: txs, allTransfers: [] };
  it('tomorrow\'s limit in the calendar = the "tomorrow" line on today\'s card', () => {
    const today = summarize(input, { savingsRate: 0 });
    const tomorrow = summarize(input, { savingsRate: 0, day: 21 });
    expect(tomorrow.safe.spentToday).toBe(0);
    expect(tomorrow.safe.todayLimit).toBeCloseTo(today.safe.tomorrowLimit!, 6);
    expect(tomorrow.safe.daysLeft).toBe(today.safe.daysLeft - 1);
  });
});
