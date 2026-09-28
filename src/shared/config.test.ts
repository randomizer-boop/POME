import { describe, expect, it } from 'vitest';
import { currentPeriod, inPeriod, monthDiff, shiftPeriod } from './config';

describe('currentPeriod', () => {
  it('uses the real date and month length', () => {
    expect(currentPeriod(new Date(2026, 8, 27))).toEqual({ year: 2026, index: 8, current: 27, total: 30 });
    expect(currentPeriod(new Date(2028, 1, 10)).total).toBe(29); // leap February
  });
  it('checks whether a date belongs to the period', () => {
    const p = currentPeriod(new Date(2026, 9, 3));
    expect(inPeriod('2026-10-01', p)).toBe(true);
    expect(inPeriod('2026-09-30', p)).toBe(false);
  });
});

describe('month navigation', () => {
  const today = { year: 2026, index: 0, current: 15, total: 31 }; // 15 Jan 2026
  it('goes back across a year boundary; past months are fully passed', () => {
    expect(shiftPeriod(today, -1)).toEqual({ year: 2025, index: 11, current: 31, total: 31 });
    expect(shiftPeriod(today, -11)).toEqual({ year: 2025, index: 1, current: 28, total: 28 });
    expect(shiftPeriod(today, 0)).toBe(today);
  });
  it('counts months between periods', () => {
    expect(monthDiff({ year: 2025, index: 10 }, { year: 2026, index: 1 })).toBe(3);
  });
});
