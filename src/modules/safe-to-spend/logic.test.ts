import { describe, expect, it } from 'vitest';
import { computeSafeToSpend, type SafeToSpendInput } from './logic';

const base: SafeToSpendInput = {
  liquidBalance: 3000, incomeReceived: 5000, expectedIncome: 0, upcomingBills: 400,
  goalsPlanned: 800, goalsPaid: 300, savedInCycle: 0, flexibleSpent: 900, spentToday: 50,
  daysPassed: 20, daysTotal: 30, savingsRate: 0.05,
};

describe('computeSafeToSpend', () => {
  it('starts from the balance: − upcoming bills − goal money still to set aside (the savings % is not deducted)', () => {
    const s = computeSafeToSpend(base);
    expect(s.goalsLeft).toBe(500);                 // 800 planned − 300 already moved
    expect(s.savingsTarget).toBe(250);             // 5% of 5000 — a target, shown as progress
    expect(s.spendable).toBe(2100);                // 3000 − 400 − 500
    expect(s.flexibleBudget).toBe(3000);           // + 900 already spent
  });

  it('spreads it over the days left, today included', () => {
    const s = computeSafeToSpend(base);
    expect(s.daysLeft).toBe(11);
    expect(s.todayLimit).toBeCloseTo((2100 + 50) / 11, 5);
    expect(s.todayLeft).toBeCloseTo((2100 + 50) / 11 - 50, 5);
    expect(s.status).toBe('ok');
  });

  it('adds income that is still expected this month (target grows with it)', () => {
    const s = computeSafeToSpend({ ...base, expectedIncome: 1000 });
    expect(s.savingsTarget).toBe(300);
    expect(s.spendable).toBe(2100 + 1000);
  });

  it('does not reserve goals again when more than planned was already saved', () => {
    expect(computeSafeToSpend({ ...base, goalsPaid: 2000 }).goalsLeft).toBe(0);
  });

  it('0 income, empty account: nothing to spend, not "over"', () => {
    const s = computeSafeToSpend({ ...base, liquidBalance: 0, incomeReceived: 0, upcomingBills: 0, goalsPlanned: 0, goalsPaid: 0, savedInCycle: 0, flexibleSpent: 0, spentToday: 0 });
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
    expect(s.monthLeftPct).toBeCloseTo((2100 / 3000) * 100, 5);
  });

  it('bills that are not covered do give "over" with the missing amount', () => {
    const s = computeSafeToSpend({ ...base, liquidBalance: 300, upcomingBills: 400, goalsPlanned: 0 });
    expect(s.spendable).toBe(-100);
    expect(s.shortfall).toBe(100);
    expect(s.status).toBe('over');
    expect(s.flexibleBudget).toBeGreaterThanOrEqual(0);   // ring never shows "0 of −X"
  });

  it('goal top-ups pay goals, other transfers to Savings count toward the % — never mixed', () => {
    const s = computeSafeToSpend({ ...base, goalsPlanned: 800, goalsPaid: 800, savedInCycle: 100 });
    expect(s.goalsLeft).toBe(0);
    expect(s.goalsDone).toBe(800);
    expect(s.savingsDone).toBe(100);
    expect(s.savingsLeft).toBe(150);
  });

  it('the rate is clamped to 0…90%', () => {
    expect(computeSafeToSpend({ ...base, savingsRate: 5 }).savingsRate).toBe(0.9);
    expect(computeSafeToSpend({ ...base, savingsRate: -1 }).savingsRate).toBe(0);
  });
});

// ─── Savings % = target, not a reserve (only real transfers to Savings reduce spendable) ──
describe('savings target vs actual transfers', () => {
  // balance 6 400 on cash+main, bill 800 before payday, income 50 000, rate 30% → target 15 000
  const c: SafeToSpendInput = {
    liquidBalance: 6400, incomeReceived: 50000, expectedIncome: 0, upcomingBills: 800,
    goalsPlanned: 0, goalsPaid: 0, savedInCycle: 0, flexibleSpent: 0, spentToday: 0,
    daysPassed: 1, daysTotal: 6, savingsRate: 0.3,
  };

  it('CASE 1: nothing moved yet — the unmet target does NOT make money unavailable', () => {
    const s = computeSafeToSpend(c);
    expect(s.spendable).toBe(5600);                 // 6 400 − 800 (was 0 when the target was reserved)
    expect(s.savingsTarget).toBe(15000);
    expect(s.savingsDone).toBe(0);                  // progress 0 / 15 000
    expect(s.savingsLeft).toBe(15000);
  });

  it('CASE 2: 5 000 actually moved to Savings — it left the balance, so spendable drops by 5 000', () => {
    // the transfer already took 5 000 from cash/main: liquid 6 400 → 1 400
    const s = computeSafeToSpend({ ...c, liquidBalance: 1400, savedInCycle: 5000 });
    expect(s.spendable).toBe(600);                  // 5 600 − 5 000
    expect(s.savingsDone).toBe(5000);               // progress 5 000 / 15 000
    expect(s.savingsLeft).toBe(10000);
  });

  it('CASE 3: 0% — no target, nothing kept back', () => {
    const s = computeSafeToSpend({ ...c, savingsRate: 0 });
    expect(s.savingsTarget).toBe(0);
    expect(s.savingsLeft).toBe(0);
    expect(s.spendable).toBe(5600);
  });

  it('CASE 4: target reached — it doesn\'t reduce spendable again', () => {
    const s = computeSafeToSpend({ ...c, liquidBalance: 1400, savedInCycle: 20000 });
    expect(s.savingsDone).toBe(15000);
    expect(s.savingsLeft).toBe(0);
    expect(s.spendable).toBe(600);                  // only the real balance and the bill count
  });

  it('the % never pushes into "over"; only uncovered bills/goals do', () => {
    expect(computeSafeToSpend({ ...c, savingsRate: 0.9 }).status).not.toBe('over');
  });
});

// ─── Goals and the savings % are fed by different transfers ─────────────────
describe('goals vs savings %: separate money', () => {
  const b: SafeToSpendInput = {
    liquidBalance: 5000, incomeReceived: 4000, expectedIncome: 0, upcomingBills: 0,
    goalsPlanned: 500, goalsPaid: 0, savedInCycle: 0, flexibleSpent: 0, spentToday: 0,
    daysPassed: 5, daysTotal: 30, savingsRate: 0.25,
  };

  it('a plain transfer to Savings does NOT pay a goal', () => {
    const s = computeSafeToSpend({ ...b, savedInCycle: 1000 });
    expect(s.goalsLeft).toBe(500);                   // goal still reserved
    expect(s.savingsMoved).toBe(1000);               // counts toward the 25% (target 1000) instead
    expect(s.savingsProgressPct).toBe(100);
  });

  it('a goal top-up pays the goal and does NOT count toward the savings %', () => {
    const s = computeSafeToSpend({ ...b, goalsPaid: 500 });
    expect(s.goalsLeft).toBe(0);
    expect(s.savingsMoved).toBe(0);
  });

  it('paying a goal more than planned doesn\'t go beyond the plan', () => {
    const s = computeSafeToSpend({ ...b, goalsPaid: 900 });
    expect(s.goalsDone).toBe(500);
    expect(s.goalsLeft).toBe(0);
  });

  it('money moved out of Savings never counts as negative progress', () => {
    const s = computeSafeToSpend({ ...b, savedInCycle: -300 });
    expect(s.savingsMoved).toBe(0);
    expect(s.goalsLeft).toBe(500);
  });
});

it('saving more than the target shows how far the plan was beaten', () => {
  const s = computeSafeToSpend({
    liquidBalance: 1_280_000, incomeReceived: 800_000, expectedIncome: 0, upcomingBills: 0, goalsPlanned: 0,
    goalsPaid: 0, savedInCycle: 300_000, flexibleSpent: 0, spentToday: 0, daysPassed: 25, daysTotal: 30, savingsRate: 0.25,
  });
  expect(s.savingsTarget).toBe(200_000);
  expect(s.savingsDone).toBe(200_000);          // capped: target reached
  expect(s.savingsMoved).toBe(300_000);         // the real amount
  expect(s.savingsProgressPct).toBe(150);       // plan beaten by 50%
  expect(s.savingsLeft).toBe(0);
  expect(s.spendable).toBe(1_280_000);          // the transfer already left the balance; the target isn't deducted
});

it('tomorrow: what is left today rolls into the next days; none on the last day before payday', () => {
  const s = computeSafeToSpend({
    liquidBalance: 1_000, incomeReceived: 0, expectedIncome: 0, upcomingBills: 0, goalsPlanned: 0, goalsPaid: 0,
    savedInCycle: 0, flexibleSpent: 100, spentToday: 100, daysPassed: 1, daysTotal: 5, savingsRate: 0,
  });
  expect(s.todayLimit).toBe(220);                // (1000 + 100) ÷ 5
  expect(s.tomorrowLimit).toBe(250);             // 1000 left ÷ 4 remaining days
  const last = computeSafeToSpend({ ...s, liquidBalance: 300, incomeReceived: 0, expectedIncome: 0, upcomingBills: 0, goalsPlanned: 0, goalsPaid: 0,
    savedInCycle: 0, flexibleSpent: 0, spentToday: 0, daysPassed: 5, daysTotal: 5, savingsRate: 0 });
  expect(last.tomorrowLimit).toBeNull();
});
