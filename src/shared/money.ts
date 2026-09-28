// ─── Money arithmetic without floating-point drift ───────────────────────────
// The DB stores integer minor units (cents/tiyn). In the app, base-currency values
// are floats because of currency conversion (1 500 000 ₸ / 444.88 = 3371.7048…),
// so every sum/difference goes through integer micro-units (1e-6 of the base
// currency): exact for adding/subtracting, and far finer than any displayed digit.
//   0.1 + 0.2 → 0.30000000000000004   |   add(0.1, 0.2) → 0.3

const SCALE = 1_000_000;
const toUnits = (v: number) => Math.round(v * SCALE);
const fromUnits = (u: number) => u / SCALE;

/** Sum of amounts (empty → 0) */
export function sum(values: Iterable<number>): number {
  let u = 0;
  for (const v of values) u += toUnits(v);
  return fromUnits(u);
}

/** a + b + … */
export const add = (...values: number[]) => sum(values);

/** a − b − c … */
export const sub = (a: number, ...rest: number[]) => fromUnits(toUnits(a) - toUnits(sum(rest)));

/** Sum of `pick(item)` over items */
export const sumBy = <T>(items: readonly T[], pick: (x: T) => number) => sum(items.map(pick));

/** Money split across `n` parts (e.g. per day); n ≤ 0 → 0 */
export const divide = (amount: number, n: number) => (n > 0 ? fromUnits(Math.round(toUnits(amount) / n)) : 0);

/** amount × share (percentages, rates) rounded to micro-units */
export const scale = (amount: number, k: number) => fromUnits(Math.round(toUnits(amount) * k));

/** part / whole as a percentage, 0 when whole is 0 */
export const percent = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);
