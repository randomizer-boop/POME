// ─── Demo seed data ───────────────────────────────────────────────────────────
// Stand-in for the database until Neon is connected.

import type { Account, Allocations, Goal, RecurringPayment, Transaction, Transfer } from '../shared/types';
import { currentPeriod, dayOf, isoDay, shiftPeriod } from '../shared/config';
import { sum } from '../shared/money';

// Demo rows are written for "day N of the month" and moved into the current
// month, keeping only days that already happened — so the demo always looks live.
const NOW = currentPeriod();
const toThisMonth = <T extends { date: string }>(rows: T[]): T[] =>
  rows
    .map(r => ({ ...r, date: isoDay(NOW, Math.min(dayOf(r.date), NOW.total)) }))
    .filter(r => dayOf(r.date) <= NOW.current);

// Part of the previous month too, so the demo shows the month switcher at work
const PREV = shiftPeriod(NOW, -1);
const toPrevMonth = <T extends { date: string }>(rows: T[]): T[] =>
  rows.map(r => ({ ...r, date: isoDay(PREV, Math.min(dayOf(r.date), PREV.total)) }));

/** Balances at the start of this month; openings are moved back by last month's flows (below) */
const START_OF_MONTH: Account[] = [
  { id: 'cash',    openingBalance: 220 },
  { id: 'main',    openingBalance: 2900 },
  { id: 'savings', openingBalance: 8950 },
];

export const recurringPayments: RecurringPayment[] = [
  { id: 'r-salary',    name: 'Salary',           category: 'Income',        amount: 4800, accountId: 'main', frequency: 'monthly', day: 1,  active: true },
  { id: 'r-rent',      name: 'Rent',             category: 'Housing',       amount: 1400, accountId: 'main', frequency: 'monthly', day: 1,  active: true },
  { id: 'r-adobe',     name: 'Adobe CC',         category: 'Subscriptions', amount: 55,   accountId: 'main', frequency: 'monthly', day: 2,  active: true },
  { id: 'r-icloud',    name: 'iCloud',           category: 'Subscriptions', amount: 3,    accountId: 'main', frequency: 'monthly', day: 3,  active: true },
  { id: 'r-netflix',   name: 'Netflix',          category: 'Subscriptions', amount: 15.5, accountId: 'main', frequency: 'monthly', day: 4,  active: true },
  { id: 'r-spotify',   name: 'Spotify',          category: 'Subscriptions', amount: 11,   accountId: 'main', frequency: 'monthly', day: 5,  active: true },
  { id: 'r-gym',       name: 'Gym membership',   category: 'Health',        amount: 38,   accountId: 'main', frequency: 'monthly', day: 7,  active: true },
  { id: 'r-internet',  name: 'Internet',         category: 'Utilities',     amount: 66,   accountId: 'main', frequency: 'monthly', day: 8,  active: true },
  { id: 'r-electric',  name: 'Electricity bill', category: 'Utilities',     amount: 86,   accountId: 'main', frequency: 'monthly', day: 15, active: true },
  { id: 'r-notion',     name: 'Notion',            category: 'Work & Tools',  amount: 15,   accountId: 'main', frequency: 'monthly', day: 18, active: true },
  { id: 'r-mobile',    name: 'Mobile plan',      category: 'Utilities',     amount: 25,   accountId: 'main', frequency: 'monthly', day: 25, active: true },
  { id: 'r-water',     name: 'Water & heating',  category: 'Utilities',     amount: 42,   accountId: 'main', frequency: 'monthly', day: 27, active: true },
  { id: 'r-insurance', name: 'Health insurance', category: 'Health',        amount: 90,   accountId: 'main', frequency: 'monthly', day: 28, active: true },
  { id: 'r-car',       name: 'Car insurance',    category: 'Transport',     amount: 480,  accountId: 'main', frequency: 'yearly',  day: 5,  month: 10, active: true },
  { id: 'r-prime',     name: 'Amazon Prime',     category: 'Subscriptions', amount: 139,  accountId: 'main', frequency: 'yearly',  day: 14, month: 2,  active: true },
];

const demoTransactions: Transaction[] = [
  { id: 't30', date: '2026-09-20', description: 'Whole Foods Market', category: 'Groceries',     amount: -64.3,  accountId: 'main' },
  { id: 't29', date: '2026-09-20', description: 'Uber',               category: 'Transport',     amount: -14.8,  accountId: 'main' },
  { id: 't28', date: '2026-09-19', description: 'Zara',               category: 'Shopping',      amount: -129.0, accountId: 'main' },
  { id: 't27', date: '2026-09-19', description: 'Sushi Bar',          category: 'Dining',        amount: -48.5,  accountId: 'main' },
  { id: 't26', date: '2026-09-18', description: 'Notion',              category: 'Work & Tools',  amount: -15.0,  accountId: 'main', recurringId: 'r-notion' },
  { id: 't25', date: '2026-09-17', description: 'Pharmacy',           category: 'Health',        amount: -22.4,  accountId: 'main' },
  { id: 't24', date: '2026-09-16', description: 'Trader Joe’s',       category: 'Groceries',     amount: -58.9,  accountId: 'main' },
  { id: 't23', date: '2026-09-15', description: 'Freelance project',  category: 'Income',        amount: 600,    accountId: 'main' },
  { id: 't22', date: '2026-09-15', description: 'Electricity bill',   category: 'Utilities',     amount: -86.0,  accountId: 'main', recurringId: 'r-electric' },
  { id: 't21', date: '2026-09-14', description: 'Coffee Lab',         category: 'Dining',        amount: -12.6,  accountId: 'cash' },
  { id: 't20', date: '2026-09-13', description: 'Hair salon',         category: 'Personal Care', amount: -45.0,  accountId: 'cash' },
  { id: 't19', date: '2026-09-12', description: 'Amazon',             category: 'Shopping',      amount: -84.0,  accountId: 'main' },
  { id: 't18', date: '2026-09-11', description: 'Metro card',         category: 'Transport',     amount: -40.0,  accountId: 'main' },
  { id: 't17', date: '2026-09-10', description: 'Whole Foods Market', category: 'Groceries',     amount: -92.1,  accountId: 'main' },
  { id: 't16', date: '2026-09-09', description: 'Italian Bistro',     category: 'Dining',        amount: -76.0,  accountId: 'main' },
  { id: 't15', date: '2026-09-08', description: 'Internet',           category: 'Utilities',     amount: -66.0,  accountId: 'main', recurringId: 'r-internet' },
  { id: 't14', date: '2026-09-07', description: 'Gym membership',     category: 'Health',        amount: -38.0,  accountId: 'main', recurringId: 'r-gym' },
  { id: 't13', date: '2026-09-06', description: 'H&M',                category: 'Shopping',      amount: -67.0,  accountId: 'main' },
  { id: 't12', date: '2026-09-05', description: 'Farmers market',     category: 'Groceries',     amount: -41.5,  accountId: 'cash' },
  { id: 't11', date: '2026-09-05', description: 'Spotify',            category: 'Subscriptions', amount: -11.0,  accountId: 'main', recurringId: 'r-spotify' },
  { id: 't10', date: '2026-09-04', description: 'Netflix',            category: 'Subscriptions', amount: -15.5,  accountId: 'main', recurringId: 'r-netflix' },
  { id: 't09', date: '2026-09-04', description: 'Taxi',               category: 'Transport',     amount: -23.2,  accountId: 'cash' },
  { id: 't08', date: '2026-09-03', description: 'Brunch',             category: 'Dining',        amount: -54.0,  accountId: 'cash' },
  { id: 't07', date: '2026-09-03', description: 'iCloud',             category: 'Subscriptions', amount: -3.0,   accountId: 'main', recurringId: 'r-icloud' },
  { id: 't06', date: '2026-09-02', description: 'Costco',             category: 'Groceries',     amount: -115.2, accountId: 'main' },
  { id: 't05', date: '2026-09-02', description: 'Adobe CC',           category: 'Subscriptions', amount: -55.0,  accountId: 'main', recurringId: 'r-adobe' },
  { id: 't04', date: '2026-09-01', description: 'Rent',               category: 'Housing',       amount: -1400,  accountId: 'main', recurringId: 'r-rent' },
  { id: 't03', date: '2026-09-01', description: 'Salary',             category: 'Income',        amount: 4800,   accountId: 'main', recurringId: 'r-salary' },
  { id: 't02', date: '2026-09-01', description: 'Gas station',        category: 'Transport',     amount: -30.0,  accountId: 'main' },
  { id: 't01', date: '2026-09-01', description: 'Pilates class',      category: 'Health',        amount: -25.0,  accountId: 'main' },
];

// previous month: everyday spending from the 15th, salary and fixed payments from the 1st
// (dates are "day N" and moved into last month)
const prevTransactions: Transaction[] = [
  { id: 'p22', date: '2026-08-31', description: 'Whole Foods Market', category: 'Groceries',     amount: -71.4,  accountId: 'main' },
  { id: 'p21', date: '2026-08-30', description: 'Cinema',             category: 'Other',         amount: -28.0,  accountId: 'cash' },
  { id: 'p20', date: '2026-08-29', description: 'Uber',               category: 'Transport',     amount: -18.6,  accountId: 'main' },
  { id: 'p19', date: '2026-08-28', description: 'Health insurance',   category: 'Health',        amount: -90.0,  accountId: 'main', recurringId: 'r-insurance' },
  { id: 'p18', date: '2026-08-27', description: 'Water & heating',    category: 'Utilities',     amount: -42.0,  accountId: 'main', recurringId: 'r-water' },
  { id: 'p17', date: '2026-08-26', description: 'Italian Bistro',     category: 'Dining',        amount: -64.0,  accountId: 'main' },
  { id: 'p16', date: '2026-08-25', description: 'Mobile plan',        category: 'Utilities',     amount: -25.0,  accountId: 'main', recurringId: 'r-mobile' },
  { id: 'p15', date: '2026-08-24', description: 'Trader Joe’s',       category: 'Groceries',     amount: -63.2,  accountId: 'main' },
  { id: 'p14', date: '2026-08-23', description: 'Birthday gift',      category: 'Family & Gifts', amount: -75.0, accountId: 'main' },
  { id: 'p13', date: '2026-08-22', description: 'Coffee Lab',         category: 'Dining',        amount: -9.8,   accountId: 'cash' },
  { id: 'p12', date: '2026-08-21', description: 'Uniqlo',             category: 'Shopping',      amount: -96.0,  accountId: 'main' },
  { id: 'p11', date: '2026-08-20', description: 'Farmers market',     category: 'Groceries',     amount: -38.5,  accountId: 'cash' },
  { id: 'p10', date: '2026-08-19', description: 'Metro card',         category: 'Transport',     amount: -40.0,  accountId: 'main' },
  { id: 'p09', date: '2026-08-18', description: 'Notion',             category: 'Work & Tools',  amount: -15.0,  accountId: 'main', recurringId: 'r-notion' },
  { id: 'p08', date: '2026-08-18', description: 'Brunch',             category: 'Dining',        amount: -46.0,  accountId: 'cash' },
  { id: 'p07', date: '2026-08-17', description: 'Costco',             category: 'Groceries',     amount: -104.7, accountId: 'main' },
  { id: 'p06', date: '2026-08-16', description: 'Pharmacy',           category: 'Health',        amount: -17.9,  accountId: 'main' },
  { id: 'p05', date: '2026-08-16', description: 'Taxi',               category: 'Transport',     amount: -21.0,  accountId: 'cash' },
  { id: 'p04', date: '2026-08-15', description: 'Freelance project',  category: 'Income',        amount: 450,    accountId: 'main' },
  { id: 'p03', date: '2026-08-15', description: 'Electricity bill',   category: 'Utilities',     amount: -79.0,  accountId: 'main', recurringId: 'r-electric' },
  { id: 'p02', date: '2026-08-15', description: 'Pilates class',      category: 'Health',        amount: -25.0,  accountId: 'main' },
  // salary and fixed payments at the start of that month — without them the month would look like a loss
  { id: 'p01h', date: '2026-08-08', description: 'Internet',          category: 'Utilities',     amount: -66.0,  accountId: 'main', recurringId: 'r-internet' },
  { id: 'p01g', date: '2026-08-07', description: 'Gym membership',    category: 'Health',        amount: -38.0,  accountId: 'main', recurringId: 'r-gym' },
  { id: 'p01f', date: '2026-08-05', description: 'Spotify',           category: 'Subscriptions', amount: -11.0,  accountId: 'main', recurringId: 'r-spotify' },
  { id: 'p01e', date: '2026-08-04', description: 'Netflix',           category: 'Subscriptions', amount: -15.5,  accountId: 'main', recurringId: 'r-netflix' },
  { id: 'p01d', date: '2026-08-03', description: 'iCloud',            category: 'Subscriptions', amount: -3.0,   accountId: 'main', recurringId: 'r-icloud' },
  { id: 'p01c', date: '2026-08-02', description: 'Adobe CC',          category: 'Subscriptions', amount: -55.0,  accountId: 'main', recurringId: 'r-adobe' },
  { id: 'p01b', date: '2026-08-01', description: 'Rent',              category: 'Housing',       amount: -1400,  accountId: 'main', recurringId: 'r-rent' },
  { id: 'p01a', date: '2026-08-01', description: 'Salary',            category: 'Income',        amount: 4800,   accountId: 'main', recurringId: 'r-salary' },
];

const prevTransfers: Transfer[] = [
  { id: 'px2', date: '2026-08-20', from: 'main', to: 'cash',    amount: 150 },
  { id: 'px1', date: '2026-08-02', from: 'main', to: 'savings', amount: 450, note: 'Emergency fund', goalId: 'g1' },
];

const demoTransfers: Transfer[] = [
  { id: 'x02', date: '2026-09-03', from: 'main', to: 'cash',    amount: 200 },
  { id: 'x01', date: '2026-09-02', from: 'main', to: 'savings', amount: 450, note: 'Emergency fund', goalId: 'g1' },
];

export const allocations: Allocations = {
  Housing:         1400,
  Groceries:        450,
  Dining:           220,
  Transport:        180,
  Subscriptions:     90,
  Health:           180,
  Shopping:         250,
  'Personal Care':   80,
  Utilities:        230,
  'Work & Tools':    40,
};

export const goals: Goal[] = [
  { id: 'g1', name: 'Emergency fund', target: 10000, saved: 6400, deadline: '2027-06-01', monthlyContribution: 450 },
  { id: 'g2', name: 'Summer trip',    target: 3000,  saved: 2100, deadline: '2027-05-01', monthlyContribution: 100 },
  { id: 'g3', name: 'New laptop',     target: 2400,  saved: 900,  deadline: '2027-01-01', monthlyContribution: 300 },
];

export const transactions = [...toThisMonth(demoTransactions), ...toPrevMonth(prevTransactions)];
export const transfers = [...toThisMonth(demoTransfers), ...toPrevMonth(prevTransfers)];

// Openings = start-of-this-month balance − last month's flows, so balances today stay the same
const prevFlow = (id: Account['id']) => sum([
  ...prevTransactions.filter(t => t.accountId === id).map(t => t.amount),
  ...prevTransfers.map(x => (x.to === id ? x.amount : 0) - (x.from === id ? x.amount : 0)),
]);
export const accounts: Account[] = START_OF_MONTH.map(a => ({ ...a, openingBalance: Math.round((a.openingBalance - prevFlow(a.id)) * 100) / 100 }));
