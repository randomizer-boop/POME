import { describe, expect, it } from 'vitest';
import { computeSafeToSpend, type SafeToSpendInput } from './logic';

const base: SafeToSpendInput = {
  liquidBalance: 3000, incomeReceived: 5000, expectedIncome: 0, upcomingBills: 400,
  goalsPlanned: 800, savedThisMonth: 300, flexibleSpent: 900, spentToday: 50,
  daysPassed: 20, daysTotal: 30, bufferRate: 0.05,
};

describe('computeSafeToSpend', () => {
  it('starts from the balance: − upcoming bills − goal money still to set aside − buffer', () => {
    const s = computeSafeToSpend(base);
    expect(s.goalsLeft).toBe(500);                 // 800 planned − 300 already moved
    expect(s.safetyBuffer).toBe(250);              // 5% of 5000
    expect(s.spendable).toBe(1850);                // 3000 − 400 − 500 − 250
    expect(s.flexibleBudget).toBe(2750);           // + 900 already spent
  });

  it('spreads it over the days left, today included', () => {
    const s = computeSafeToSpend(base);
    expect(s.daysLeft).toBe(11);
    expect(s.todayLimit).toBeCloseTo((1850 + 50) / 11, 5);
    expect(s.todayLeft).toBeCloseTo((1850 + 50) / 11 - 50, 5);
    expect(s.status).toBe('ok');
  });

  it('adds income that is still expected this month', () => {
    const s = computeSafeToSpend({ ...base, expectedIncome: 1000 });
    expect(s.safetyBuffer).toBe(300);              // buffer also covers expected income
    expect(s.spendable).toBe(1850 + 1000 - 50);
  });

  it('does not reserve goals again when more than planned was already saved', () => {
    expect(computeSafeToSpend({ ...base, savedThisMonth: 2000 }).goalsLeft).toBe(0);
  });

  it('0 income, empty account: nothing to spend, not "over"', () => {
    const s = computeSafeToSpend({ ...base, liquidBalance: 0, incomeReceived: 0, upcomingBills: 0, goalsPlanned: 0, savedThisMonth: 0, flexibleSpent: 0, spentToday: 0 });
    expect(s.spendable).toBe(0);
    expect(s.todayLimit).toBe(0);
    expect(s.status).toBe('ok');
  });

  it('negative balance → over, limit never negative', () => {
    const s = computeSafeToSpend({ ...base, liquidBalance: -200 });
    expect(s.spendable).toBeLessThan(0);
    expect(s.todayLimit).toBe(0);
    expect(s.status).toBe('over');
  });

  it('last day of the month: everything left is for today', () => {
    const s = computeSafeToSpend({ ...base, daysPassed: 30, daysTotal: 30, spentToday: 0 });
    expect(s.daysLeft).toBe(1);
    expect(s.todayLimit).toBe(s.spendable);
  });

  it('February: 28 and 29 days', () => {
    expect(computeSafeToSpend({ ...base, daysPassed: 28, daysTotal: 28 }).daysLeft).toBe(1);
    expect(computeSafeToSpend({ ...base, daysPassed: 28, daysTotal: 29 }).daysLeft).toBe(2);
  });

  it('is "tight" when today is already over the limit', () => {
    const s = computeSafeToSpend({ ...base, spentToday: 400, flexibleSpent: 1250, liquidBalance: 2650 });
    expect(s.todayLeft).toBeLessThan(0);
    expect(s.status).toBe('tight');
  });

  it('exposes ready-made percentages for the UI', () => {
    const s = computeSafeToSpend(base);
    expect(s.todayUsedPct).toBeCloseTo((50 / s.todayLimit) * 100, 5);
    expect(s.monthLeftPct).toBeCloseTo((1850 / 2750) * 100, 5);
  });
});
