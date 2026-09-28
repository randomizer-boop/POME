import { describe, expect, it } from 'vitest';
import { add, divide, percent, scale, sub, sum, sumBy } from './money';

describe('money arithmetic', () => {
  it('has no floating-point drift', () => {
    expect(add(0.1, 0.2)).toBe(0.3);
    expect(sub(1, 0.9)).toBe(0.1);
    expect(sum([19.99, 0.01, 5.5])).toBe(25.5);
    expect(sum(Array(10).fill(0.1))).toBe(1);
  });
  it('keeps converted amounts exact enough to round-trip to ₸', () => {
    const kzt = 444.88;
    const parts = [1_500_000 / kzt, 250_000 / kzt, -750_000 / kzt];
    expect(Math.round(sum(parts) * kzt)).toBe(1_000_000);
  });
  it('divides, scales and handles empty input', () => {
    expect(sum([])).toBe(0);
    expect(divide(100, 3)).toBeCloseTo(33.333333, 6);
    expect(divide(100, 0)).toBe(0);
    expect(scale(200, 0.05)).toBe(10);
    expect(percent(25, 0)).toBe(0);
    expect(sumBy([{ a: 1.1 }, { a: 2.2 }], x => x.a)).toBe(3.3);
  });
});
