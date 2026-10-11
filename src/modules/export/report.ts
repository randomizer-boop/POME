// ─── Report: the user's data → spreadsheet sheets / CSV (pure, unit-tested) ────
// Every amount is given twice where it matters: in the currency it was entered in
// (exactly what was typed) and converted to the chosen display currency, so the
// totals add up in one currency.

import type { Account, Allocations, Currency, Goal, Period, RecurringPayment, Transaction, Transfer } from '../../shared/types';
import { t, catLabel, descLabel, goalLabel, locale } from '../../shared/i18n';
import { isoDay } from '../../shared/config';
import { sum } from '../../shared/money';
import { round2 } from '../../data/currency';
import { accName } from '../accounts/labels';
import { accountBalances } from '../accounts/logic';
import { expenseTotal, incomeTotal } from '../transactions/logic';
import { spendingByCategory } from '../analytics/logic';
import type { Cell, Sheet } from './xlsx';

export type RangeKind = 'month' | 'quarter' | 'year' | 'all' | 'custom';
/** Inclusive dates, YYYY-MM-DD */
export interface ReportRange { from: string; to: string }

const ISO = /^\d{4}-\d{2}-\d{2}$/;
export const isValidRange = (r: ReportRange) => ISO.test(r.from) && ISO.test(r.to) && r.from <= r.to;

/** Dates for a preset. `viewed` = the month open in the app, `today` = the real current month. */
export function rangeFor(kind: RangeKind, viewed: Period, today: Period, earliest?: string, custom?: ReportRange): ReportRange {
  const todayIso = isoDay(today, today.current);
  switch (kind) {
    case 'month': return { from: isoDay(viewed, 1), to: isoDay(viewed, viewed.total) };
    case 'quarter': {
      const d = new Date(today.year, today.index - 2, 1);
      return { from: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`, to: todayIso };
    }
    case 'year': return { from: `${today.year}-01-01`, to: todayIso };
    case 'all': return { from: earliest && earliest < todayIso ? earliest : todayIso, to: todayIso };
    case 'custom': return custom ?? { from: todayIso, to: todayIso };
  }
}

export interface ReportInput {
  /** all data, amounts in base currency (USD) — as the store gives it */
  accounts: Account[];
  transactions: Transaction[];
  transfers: Transfer[];
  recurring: RecurringPayment[];
  goals: Goal[];
  allocations: Allocations;
  rates: Record<Currency, number>;
  /** totals are shown in this currency */
  currency: Currency;
  range: ReportRange;
  generatedAt: Date;
  ratesUpdatedAt: number;
  ratesLive: boolean;
}

const inRange = (iso: string, r: ReportRange) => iso >= r.from && iso <= r.to;
const byDate = <T extends { date: string }>(a: T, b: T) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

/** Earliest date in the data (for "All time") */
export const earliestDate = (txs: Transaction[], xs: Transfer[]) =>
  [...txs.map(x => x.date), ...xs.map(x => x.date)].reduce<string | undefined>((m, d) => (!m || d < m ? d : m), undefined);

/** Months touched by the range: ['2026-08', '2026-09', …] */
export function monthsIn(r: ReportRange): string[] {
  const out: string[] = [];
  let y = Number(r.from.slice(0, 4));
  let m = Number(r.from.slice(5, 7));
  const endKey = r.to.slice(0, 7);
  for (let guard = 0; guard < 1200; guard++) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    out.push(key);
    if (key >= endKey) break;
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}

const monthLabel = (key: string) => {
  const s = new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1).toLocaleDateString(locale(), { month: 'long', year: 'numeric' });
  return (s.charAt(0).toUpperCase() + s.slice(1)).replace(/\s*г\.$/, '');
};

export function reportFileName(r: ReportRange, ext: 'xlsx' | 'csv') {
  return `pome-report_${r.from}_${r.to}.${ext}`;
}

/** What the report will contain — shown in the dialog before downloading */
export function reportCounts(input: Pick<ReportInput, 'transactions' | 'transfers' | 'range'>) {
  return {
    transactions: input.transactions.filter(x => inRange(x.date, input.range)).length,
    transfers: input.transfers.filter(x => inRange(x.date, input.range)).length,
  };
}

// ─── Excel ────────────────────────────────────────────────────────────────────

export function buildReport(input: ReportInput): Sheet[] {
  const { range, rates, currency } = input;
  const rate = (c?: Currency) => rates[c ?? 'USD'] || 1;
  /** base → display currency */
  const disp = (base: number) => round2(base * rate(currency));
  /** base → the currency it was typed in (gives back the typed amount) */
  const orig = (base: number, c?: Currency) => round2(base * rate(c));
  const money = (v: number): Cell => ({ v, s: 'money' });
  const H = (s: string): Cell => ({ v: s, s: 'bold' });
  const inCur = t('exp.colAmountIn', { c: currency });

  const txs = input.transactions.filter(x => inRange(x.date, range)).sort(byDate);
  const xs = input.transfers.filter(x => inRange(x.date, range)).sort(byDate);
  const recurringName = new Map(input.recurring.map(r => [r.id, r.name]));
  const goalName = new Map(input.goals.map(g => [g.id, g.name]));

  // ── Summary
  const income = incomeTotal(txs);
  const expenses = expenseTotal(txs);
  const toSavings = sum(xs.filter(x => x.to === 'savings' && x.from !== 'savings').map(x => x.amount));
  const balances = accountBalances(input.accounts, input.transactions, input.transfers);
  const ratesDate = new Date(input.ratesUpdatedAt).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' });

  const summary: Cell[][] = [
    [{ v: `POME — ${t('exp.title')}`, s: 'title' }],
    [t('exp.period'), { v: range.from, s: 'date' }, { v: range.to, s: 'date' }],
    [t('exp.generated'), input.generatedAt.toLocaleString(locale())],
    [t('exp.currencyNote'), currency],
    [t('exp.rates'), t(input.ratesLive ? 'exp.ratesLive' : 'exp.ratesFixed', { d: ratesDate })],
    [],
    [H(t('exp.totals')), H(currency)],
    [t('exp.income'), money(disp(income))],
    [t('exp.expenses'), money(disp(expenses))],
    [{ v: t('exp.net'), s: 'bold' }, { v: disp(income - expenses), s: 'boldMoney' }],
    [t('exp.savedToSavings'), money(disp(toSavings))],
    [],
    [H(t('exp.byMonth')), H(t('exp.income')), H(t('exp.expenses')), H(t('exp.net'))],
  ];
  for (const key of monthsIn(range)) {
    const m = txs.filter(x => x.date.startsWith(key));
    const inc = incomeTotal(m);
    const out = expenseTotal(m);
    summary.push([monthLabel(key), money(disp(inc)), money(disp(out)), money(disp(inc - out))]);
  }

  const cats = spendingByCategory(txs);
  summary.push([], [H(t('exp.byCategory')), H(inCur), H(t('exp.share')), H(t('exp.monthlyLimit'))]);
  if (cats.length === 0) summary.push([{ v: t('exp.noData'), s: 'muted' }]);
  for (const c of cats) {
    const limit = input.allocations[c.name];
    summary.push([catLabel(c.name), money(disp(c.spent)), { v: c.share / 100, s: 'pct' }, limit ? money(disp(limit)) : null]);
  }

  summary.push([], [H(t('exp.balancesNow')), H(inCur)]);
  for (const a of input.accounts) summary.push([accName(a.id), money(disp(balances[a.id] ?? 0))]);
  summary.push([{ v: t('exp.total'), s: 'bold' }, { v: disp(sum(Object.values(balances))), s: 'boldMoney' }]);

  // ── Operations
  const ops: Cell[][] = [[
    H(t('exp.colDate')), H(t('exp.colType')), H(t('exp.colCategory')), H(t('exp.colDescription')), H(t('exp.colAccount')),
    H(t('exp.colAmount')), H(t('exp.colCurrency')), H(inCur), H(t('exp.colBill')),
  ]];
  for (const x of txs) {
    ops.push([
      { v: x.date, s: 'date' },
      t(x.amount > 0 ? 'exp.typeIncome' : 'exp.typeExpense'),
      catLabel(x.category),
      descLabel(x.description),
      accName(x.accountId),
      money(orig(x.amount, x.currency)),
      x.currency ?? 'USD',
      money(disp(x.amount)),
      x.recurringId ? descLabel(recurringName.get(x.recurringId) ?? '') : null,
    ]);
  }
  if (txs.length === 0) ops.push([{ v: t('exp.noData'), s: 'muted' }]);

  // ── Transfers
  const tr: Cell[][] = [[
    H(t('exp.colDate')), H(t('exp.colFrom')), H(t('exp.colTo')), H(t('exp.colAmount')), H(t('exp.colCurrency')), H(inCur), H(t('exp.colNote')), H(t('exp.colGoal')),
  ]];
  for (const x of xs) {
    tr.push([
      { v: x.date, s: 'date' }, accName(x.from), accName(x.to),
      money(orig(x.amount, x.currency)), x.currency ?? 'USD', money(disp(x.amount)),
      x.note ?? null, x.goalId ? goalLabel(goalName.get(x.goalId) ?? '') : null,
    ]);
  }

  // ── Recurring payments (the rules, not tied to the period)
  const rec: Cell[][] = [[
    H(t('exp.colName')), H(t('exp.colCategory')), H(t('exp.colAmount')), H(t('exp.colCurrency')), H(inCur),
    H(t('exp.colAccount')), H(t('exp.colFrequency')), H(t('exp.colDay')), H(t('exp.colStatus')),
  ]];
  for (const r of input.recurring) {
    const when = r.frequency === 'yearly' && r.month !== undefined
      ? new Date(2000, r.month, 1).toLocaleDateString(locale(), { month: 'long' })
      : '';
    rec.push([
      descLabel(r.name), catLabel(r.category), money(orig(r.amount, r.currency)), r.currency ?? 'USD', money(disp(r.amount)),
      accName(r.accountId), t(r.frequency === 'yearly' ? 'yearly' : 'monthly'), when ? `${r.day} · ${when}` : r.day,
      t(r.active ? 'exp.active' : 'exp.paused'),
    ]);
  }

  // ── Goals
  const goals: Cell[][] = [[
    H(t('exp.colName')), H(t('exp.colTarget')), H(t('exp.colSaved')), H(t('exp.colLeft')), H(t('exp.colProgress')),
    H(t('exp.colDeadline')), H(t('exp.colMonthly')), H(t('exp.colCurrency')),
  ]];
  for (const g of input.goals) {
    goals.push([
      goalLabel(g.name), money(orig(g.target, g.currency)), money(orig(g.saved, g.currency)),
      money(Math.max(0, orig(g.target - g.saved, g.currency))), { v: g.target > 0 ? Math.min(1, g.saved / g.target) : 0, s: 'pct' },
      { v: g.deadline, s: 'date' }, money(orig(g.monthlyContribution, g.currency)), g.currency ?? 'USD',
    ]);
  }

  const sheets: Sheet[] = [
    { name: t('exp.sheetSummary'), rows: summary, widths: [34, 18, 16, 18] },
    { name: t('exp.sheetOps'), rows: ops, widths: [12, 10, 18, 32, 16, 14, 9, 16, 24], freezeRows: 1 },
    { name: t('exp.sheetTransfers'), rows: tr, widths: [12, 16, 16, 14, 9, 16, 28, 22], freezeRows: 1 },
    { name: t('exp.sheetRecurring'), rows: rec, widths: [26, 18, 14, 9, 16, 16, 12, 18, 12], freezeRows: 1 },
    { name: t('exp.sheetGoals'), rows: goals, widths: [26, 14, 14, 14, 11, 12, 16, 9], freezeRows: 1 },
  ];

  const alloc = Object.entries(input.allocations).filter(([, v]) => v > 0);
  if (alloc.length) {
    const spentBy = new Map(cats.map(c => [c.name, c.spent]));
    const months = monthsIn(range).length;
    sheets.push({
      name: t('exp.sheetBudget'),
      rows: [
        [H(t('exp.colCategory')), H(t('exp.monthlyLimit')), H(t('exp.budgetForPeriod', { n: months })), H(t('exp.spentInPeriod')), H(t('exp.colLeft'))],
        ...alloc.map(([c, v]): Cell[] => {
          const plan = disp(v) * months;
          const spent = disp(spentBy.get(c) ?? 0);
          return [catLabel(c), money(disp(v)), money(round2(plan)), money(spent), money(round2(plan - spent))];
        }),
      ],
      widths: [22, 16, 20, 18, 16],
      freezeRows: 1,
    });
  }
  return sheets;
}

// ─── CSV (operations only) ────────────────────────────────────────────────────

/**
 * A text cell that starts with = + - @ (or a tab / CR) is run as a formula by Excel and
 * Google Sheets ("CSV injection"): a description like =HYPERLINK("http://evil","x") would
 * become a live link. Prefixing a quote keeps it plain text.
 */
export function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  let s = v;
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function transactionsCsv(input: ReportInput): string {
  const { range, rates, currency } = input;
  const rate = (c?: Currency) => rates[c ?? 'USD'] || 1;
  const recurringName = new Map(input.recurring.map(r => [r.id, r.name]));
  const head = [t('exp.colDate'), t('exp.colType'), t('exp.colCategory'), t('exp.colDescription'), t('exp.colAccount'),
    t('exp.colAmount'), t('exp.colCurrency'), t('exp.colAmountIn', { c: currency }), t('exp.colBill')];
  const lines = [head.map(csvCell).join(',')];
  for (const x of input.transactions.filter(x => inRange(x.date, range)).sort(byDate)) {
    lines.push([
      x.date, t(x.amount > 0 ? 'exp.typeIncome' : 'exp.typeExpense'), catLabel(x.category), descLabel(x.description), accName(x.accountId),
      round2(x.amount * rate(x.currency)), x.currency ?? 'USD', round2(x.amount * rate(currency)),
      x.recurringId ? descLabel(recurringName.get(x.recurringId) ?? '') : '',
    ].map(csvCell).join(','));
  }
  // BOM: Excel then reads Cyrillic as UTF-8 instead of mojibake
  return '﻿' + lines.join('\r\n') + '\r\n';
}
