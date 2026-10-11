import { describe, expect, it } from 'vitest';
import { buildXlsx, colName, crc32, excelDate, safeSheetName, xmlText } from './xlsx';
import { buildReport, csvCell, isValidRange, monthsIn, rangeFor, reportCounts, transactionsCsv, type ReportInput } from './report';
import { EXCHANGE_RATES } from '../../shared/config';
import type { Period } from '../../shared/types';

describe('xlsx helpers', () => {
  it('crc32 matches the reference value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
  it('column names', () => {
    expect([0, 25, 26, 27, 701, 702].map(colName)).toEqual(['A', 'Z', 'AA', 'AB', 'ZZ', 'AAA']);
  });
  it('excel dates (1900 system)', () => {
    expect(excelDate('1970-01-01')).toBe(25569);
    expect(excelDate('2026-10-11')).toBe(46306);
    expect(excelDate('bad')).toBeNull();
  });
  it('escapes XML and drops control characters', () => {
    expect(xmlText('a<b>&"c"\u0001')).toBe('a&lt;b&gt;&amp;&quot;c&quot;');
  });
  it('sheet names are valid and unique', () => {
    const taken = new Set<string>();
    expect(safeSheetName('a/b:c', taken)).toBe('a b c');
    expect(safeSheetName('A B C', taken)).toBe('A B C (2)');
    expect(safeSheetName('x'.repeat(40), taken)).toHaveLength(31);
  });
  it('produces a zip with the workbook parts', () => {
    const bytes = buildXlsx([{ name: 'S', rows: [['=1+1', 5, { v: '2026-01-02', s: 'date' }]] }]);
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain('xl/workbook.xml');
    // formula-looking text is stored as a plain string, never as <f>
    expect(text).toContain('<is><t xml:space="preserve">=1+1</t></is>');
    expect(text).not.toContain('<f>');
  });
});

describe('csv', () => {
  it('neutralises formula injection and quotes when needed', () => {
    expect(csvCell('=HYPERLINK("http://x","y")')).toBe(`"'=HYPERLINK(""http://x"",""y"")"`);
    expect(csvCell('+7 701')).toBe("'+7 701");
    expect(csvCell('-coffee')).toBe("'-coffee");
    expect(csvCell('@me')).toBe("'@me");
    expect(csvCell(-12.5)).toBe('-12.5');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell(null)).toBe('');
  });
});

const sep: Period = { year: 2026, index: 8, current: 30, total: 30 };
const oct: Period = { year: 2026, index: 9, current: 11, total: 31 };

describe('ranges', () => {
  it('presets', () => {
    expect(rangeFor('month', sep, oct)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(rangeFor('quarter', oct, oct)).toEqual({ from: '2026-08-01', to: '2026-10-11' });
    expect(rangeFor('quarter', { year: 2026, index: 0, current: 5, total: 31 }, { year: 2026, index: 0, current: 5, total: 31 }))
      .toEqual({ from: '2025-11-01', to: '2026-01-05' });
    expect(rangeFor('year', oct, oct)).toEqual({ from: '2026-01-01', to: '2026-10-11' });
    expect(rangeFor('all', oct, oct, '2025-03-04')).toEqual({ from: '2025-03-04', to: '2026-10-11' });
    expect(rangeFor('all', oct, oct)).toEqual({ from: '2026-10-11', to: '2026-10-11' });
  });
  it('validation and months', () => {
    expect(isValidRange({ from: '2026-10-02', to: '2026-10-01' })).toBe(false);
    expect(isValidRange({ from: '', to: '2026-10-01' })).toBe(false);
    expect(monthsIn({ from: '2025-11-15', to: '2026-02-01' })).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });
});

// Base currency is USD: 100 000 ₸ is stored in the app as 100000 / KZT rate
const kzt = EXCHANGE_RATES.KZT;
const input = (): ReportInput => ({
  accounts: [{ id: 'cash', openingBalance: 0 }, { id: 'main', openingBalance: 1000 }, { id: 'savings', openingBalance: 0 }],
  transactions: [
    { id: '1', date: '2026-09-05', description: 'Salary', category: 'Income', amount: 2000, accountId: 'main', currency: 'USD' },
    { id: '2', date: '2026-09-10', description: 'Rent', category: 'Housing', amount: -100000 / kzt, accountId: 'main', currency: 'KZT', recurringId: 'r1' },
    { id: '3', date: '2026-09-12', description: '=cmd', category: 'Dining', amount: -50, accountId: 'cash', currency: 'USD' },
    { id: '4', date: '2026-10-01', description: 'Taxi', category: 'Transport', amount: -10, accountId: 'cash', currency: 'USD' },
  ],
  transfers: [{ id: 'x', date: '2026-09-20', from: 'main', to: 'savings', amount: 300, currency: 'USD', goalId: 'g1' }],
  recurring: [{ id: 'r1', name: 'Rent', category: 'Housing', amount: 100000 / kzt, accountId: 'main', frequency: 'monthly', day: 10, active: true, currency: 'KZT' }],
  goals: [{ id: 'g1', name: 'Trip', target: 1000, saved: 300, deadline: '2027-06-01', monthlyContribution: 100, currency: 'USD' }],
  allocations: { Dining: 200 },
  rates: EXCHANGE_RATES,
  currency: 'USD',
  range: { from: '2026-09-01', to: '2026-09-30' },
  generatedAt: new Date(2026, 9, 11, 12, 0),
  ratesUpdatedAt: Date.UTC(2026, 8, 24),
  ratesLive: false,
});

describe('report', () => {
  it('counts only what is inside the period', () => {
    expect(reportCounts(input())).toEqual({ transactions: 3, transfers: 1 });
  });

  it('builds the sheets with totals in the display currency and amounts as typed', () => {
    const sheets = buildReport(input());
    expect(sheets.map(s => s.name)).toEqual(['Summary', 'Operations', 'Transfers', 'Recurring', 'Goals', 'Budget']);
    const flat = (i: number) => sheets[i].rows.map(r => r.map(c => (c && typeof c === 'object' ? c.v : c)));

    const summary = flat(0);
    const row = (label: string) => summary.find(r => r[0] === label);
    expect(row('Income')?.[1]).toBe(2000);
    expect(row('Expenses')?.[1]).toBe(Math.round((100000 / kzt + 50) * 100) / 100);

    const ops = flat(1);
    expect(ops).toHaveLength(4); // header + 3
    const rent = ops.find(r => r[3] === 'Rent')!;
    expect(rent[5]).toBe(-100000);   // exactly what was typed, in tenge
    expect(rent[6]).toBe('KZT');
    expect(rent[8]).toBe('Rent');    // linked recurring payment

    expect(flat(2)[1][7]).toBe('Trip');
    expect(flat(4)[1][4]).toBe(0.3);
  });

  it('csv: BOM, header, period filter, injection-safe', () => {
    const csv = transactionsCsv(input());
    expect(csv.startsWith('﻿Date,Type,Category')).toBe(true);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(4);
    expect(csv).toContain(",'=cmd,");
    expect(csv).not.toContain('Taxi');
  });
});
