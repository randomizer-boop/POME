import { describe, expect, it } from 'vitest';
import type { RecurringPayment } from '../../shared/types';
import { addDays, daysInclusive, occurrences, payCycle } from './cycle';

const rule = (over: Partial<RecurringPayment>): RecurringPayment =>
  ({ id: 'r', name: 'R', category: 'Housing', amount: 100, accountId: 'main', frequency: 'monthly', day: 1, active: true, ...over });

describe('pay cycle helpers', () => {
  it('lists due dates, clamping the day to short months (February)', () => {
    expect(occurrences(rule({ day: 31 }), '2027-01-15', '2027-03-31')).toEqual(['2027-01-31', '2027-02-28', '2027-03-31']);
    expect(occurrences(rule({ day: 30 }), '2028-02-01', '2028-02-29')).toEqual(['2028-02-29']);   // leap year
    expect(occurrences(rule({ frequency: 'yearly', month: 10, day: 5 }), '2026-09-01', '2027-12-31')).toEqual(['2026-11-05', '2027-11-05']);
  });
  it('counts days inclusively across months', () => {
    expect(daysInclusive('2026-09-29', '2026-10-27')).toBe(29);
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });
  it('February payday: cycle ends the day before the clamped salary date', () => {
    const salary = rule({ id: 's', category: 'Income', day: 30, amount: 1000 });
    const c = payCycle([salary], [], { year: 2026, index: 1, current: 10, total: 28 });
    expect(c.nextIncome).toBe('2026-02-28');
    expect(c.end).toBe('2026-02-27');
    expect(c.daysLeft).toBe(18);
  });
  it('a paused salary is ignored → month mode', () => {
    const c = payCycle([rule({ category: 'Income', day: 25, active: false })], [], { year: 2026, index: 8, current: 10, total: 30 });
    expect(c.mode).toBe('month');
    expect(c.end).toBe('2026-09-30');
  });
});
