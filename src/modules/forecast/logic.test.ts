import { describe, expect, it } from 'vitest';
import type { Goal, Period } from '../../shared/types';
import { applyCuts, forecastReadiness, goalImpact, monthlyBaselines, projectMonthEnd } from './logic';

const p: Period = { year: 2026, index: 8, current: 20, total: 30 };

describe('forecast', () => {
  it('end balance = balance + expected income − upcoming bills − variable spending ahead', () => {
    // 1000 spent in 20 days → 50/day; 10 days ahead → 500
    const r = projectMonthEnd({ liquidBalance: 3000, expectedIncome: 800, upcomingBills: 400, flexibleSpent: 1000, period: p });
    expect(r.avgPerDay).toBe(50);
    expect(r.projectedVariable).toBe(500);
    expect(r.projectedEndBalance).toBe(2900);
  });

  it('on the last day nothing more is projected', () => {
    const r = projectMonthEnd({ liquidBalance: 100, expectedIncome: 0, upcomingBills: 0, flexibleSpent: 900, period: { ...p, current: 30 } });
    expect(r.projectedVariable).toBe(0);
    expect(r.projectedEndBalance).toBe(100);
  });

  it('in the first week it leans on last month’s pace instead of one noisy day', () => {
    const early = { ...p, current: 3 };
    const r = projectMonthEnd({ liquidBalance: 3000, expectedIncome: 0, upcomingBills: 0, flexibleSpent: 600, period: early, lastMonthDailyAvg: 40 });
    expect(r.paceSource).toBe('lastMonth');
    expect(r.projectedVariable).toBe(40 * 27);
    const noHistory = projectMonthEnd({ liquidBalance: 3000, expectedIncome: 0, upcomingBills: 0, flexibleSpent: 600, period: early });
    expect(noHistory.paceSource).toBe('current');
    expect(noHistory.avgPerDay).toBe(200);
  });

  it('can go negative', () => {
    const r = projectMonthEnd({ liquidBalance: -50, expectedIncome: 0, upcomingBills: 100, flexibleSpent: 0, period: p });
    expect(r.projectedEndBalance).toBe(-150);
  });

  it('turns category cuts into extra money per month and for the rest of this month', () => {
    const base = monthlyBaselines({ Dining: 200 }, p);          // 300 / month
    const r = applyCuts(base, { Dining: 20 }, p);
    expect(r.extraPerMonth).toBeCloseTo(60);
    expect(r.extraThisMonth).toBeCloseTo(20);                  // 10 of 30 days left
  });

  it('shows how much sooner a goal is reached', () => {
    const g: Goal = { id: 'g', name: 'G', target: 1200, saved: 0, deadline: '2027-12-01', monthlyContribution: 100 };
    const [i] = goalImpact([g], 50);
    expect(i.nowMonths).toBe(12);
    expect(i.withMonths).toBe(8);
    expect(i.soonerBy).toBe(4);
  });
});

describe('forecastReadiness', () => {
  it('needs income and at least 3 days with spending', () => {
    expect(forecastReadiness(0, [10, 10, 10]).ready).toBe(false);
    expect(forecastReadiness(1000, [10, 0, 5]).ready).toBe(false);
    expect(forecastReadiness(1000, [10, 0, 5, 7]).ready).toBe(true);
    expect(forecastReadiness(1000, [10, 0, 5]).days).toBe(2);
  });
});

describe('forecastReadiness with history', () => {
  it('a new month is ready right away when last month has data', () => {
    expect(forecastReadiness(1000, [10], true).ready).toBe(true);
    expect(forecastReadiness(1000, [10], false).ready).toBe(false);
  });
});
