import { describe, expect, it } from 'vitest';
import { goalProgress, goalsPlannedTotal, monthToDeadline, monthsUntil, validateGoal } from './logic';

const p = { year: 2026, index: 8, current: 28, total: 30 }; // 28 Sep 2026

describe('goals', () => {
  it('validates a new goal', () => {
    expect(validateGoal('Trip', 1000, 0, '2027-03', p)).toBeNull();
    expect(validateGoal(' ', 1000, 0, '2027-03', p)).toBe('name');
    expect(validateGoal('Trip', 0, 0, '2027-03', p)).toBe('target');
    expect(validateGoal('Trip', 1000, 1200, '2027-03', p)).toBe('saved');
    expect(validateGoal('Trip', 1000, 0, '2026-08', p)).toBe('deadline');
    expect(validateGoal('Trip', 1000, 0, '2026-09', p)).toBeNull();
  });

  it('turns a month into its last day', () => {
    expect(monthToDeadline('2027-02')).toBe('2027-02-28');
    expect(monthToDeadline('2026-12')).toBe('2026-12-31');
  });

  it('computes what is needed per month', () => {
    const g = goalProgress({ id: 'g', name: 'Trip', target: 1200, saved: 200, deadline: '2027-03-31', monthlyContribution: 100 }, p);
    expect(g.remaining).toBe(1000);
    expect(g.pct).toBeCloseTo(16.67, 1);
    expect(g.onTrack).toBe(false);
  });

  it('counts calendar months to the deadline, this month included', () => {
    expect(monthsUntil('2027-03-31', p)).toBe(7);      // Sep … Mar
    expect(monthsUntil('2026-09-30', p)).toBe(1);
    expect(monthsUntil('2026-08-31', p)).toBe(0);      // passed
  });

  it('remaining = target − saved; monthly need until the deadline', () => {
    const g = goalProgress({ id: 'g', name: 'Laptop', target: 2400, saved: 300, deadline: '2027-02-28', monthlyContribution: 400 }, p);
    expect(g.remaining).toBe(2100);
    expect(g.months).toBe(6);
    expect(g.neededPerMonth).toBe(350);
    expect(g.onTrack).toBe(true);
  });

  it('an overdue goal needs everything that is left, now', () => {
    const g = goalProgress({ id: 'g', name: 'Trip', target: 1000, saved: 400, deadline: '2026-07-31', monthlyContribution: 100 }, p);
    expect(g.overdue).toBe(true);
    expect(g.neededPerMonth).toBe(600);
    expect(g.onTrack).toBe(false);
  });

  it('a reached goal needs nothing and reserves nothing', () => {
    const done = { id: 'g', name: 'Done', target: 500, saved: 500, deadline: '2026-07-31', monthlyContribution: 100 };
    expect(goalProgress(done, p)).toMatchObject({ reached: true, overdue: false, neededPerMonth: 0, onTrack: true });
    const almost = { ...done, saved: 450 };
    expect(goalsPlannedTotal([done, almost])).toBe(50);   // capped by what's left
  });
});
