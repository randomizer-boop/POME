import type { Goal, Period } from '../../shared/types';
import { monthsToReach } from '../goals/logic';
import { add, divide, scale, sub, sum } from '../../shared/money';

// ─── Month-end forecast (explainable: straight-line pace, no "magic") ────────
//   end balance = balance on spending accounts now
//               + income still expected
//               − bills still to pay
//               − variable spending for the days after today (at this month's average pace;
//                 in the first week, while that's noisy, at last month's average if there is one)

export interface MonthEndInput {
  liquidBalance: number;
  expectedIncome: number;
  upcomingBills: number;
  flexibleSpent: number;    // this month so far, today included
  period: Period;
  /** last month's flexible spending per day (0/undefined = no data) */
  lastMonthDailyAvg?: number;
}

/** Before this many days of the month, one big purchase would distort the pace */
export const OWN_PACE_FROM_DAY = 7;

export function projectMonthEnd(i: MonthEndInput) {
  const useLastMonth = i.period.current < OWN_PACE_FROM_DAY && (i.lastMonthDailyAvg ?? 0) > 0;
  const avgPerDay = useLastMonth ? i.lastMonthDailyAvg! : divide(i.flexibleSpent, i.period.current);
  const paceSource: 'current' | 'lastMonth' = useLastMonth ? 'lastMonth' : 'current';
  const daysAhead = Math.max(0, i.period.total - i.period.current);
  const projectedVariable = scale(avgPerDay, daysAhead);
  const projectedEndBalance = sub(add(i.liquidBalance, i.expectedIncome), i.upcomingBills, projectedVariable);
  return { avgPerDay, paceSource, daysAhead, projectedVariable, projectedEndBalance };
}

// ─── What if? ─────────────────────────────────────────────────────────────────

/** Flexible spend per category projected to a full month at the current pace */
export function monthlyBaselines(flexibleByCategory: Record<string, number>, p: Period): Record<string, number> {
  const k = p.total / Math.max(1, p.current);
  return Object.fromEntries(Object.entries(flexibleByCategory).map(([c, v]) => [c, scale(v, k)]));
}

/** cuts: category → percent (0–100) */
export function applyCuts(baselines: Record<string, number>, cuts: Record<string, number>, p: Period) {
  const extraPerMonth = sum(Object.entries(cuts).map(([c, pct]) => scale(baselines[c] ?? 0, pct / 100)));
  // cuts only affect the days that are still ahead in this month
  const extraThisMonth = scale(extraPerMonth, Math.max(0, p.total - p.current) / p.total);
  return { extraPerMonth, extraThisMonth };
}

export interface GoalImpact {
  goal: Goal;
  nowMonths: number;
  withMonths: number;
  soonerBy: number;
}

/** How much sooner each goal is reached if ALL the extra money goes to it */
export function goalImpact(goals: Goal[], extraPerMonth: number): GoalImpact[] {
  return goals.map(goal => {
    const nowMonths = monthsToReach(goal, goal.monthlyContribution);
    const withMonths = monthsToReach(goal, goal.monthlyContribution + extraPerMonth);
    const soonerBy = Number.isFinite(nowMonths) && Number.isFinite(withMonths) ? nowMonths - withMonths : 0;
    return { goal, nowMonths, withMonths, soonerBy };
  });
}

// ─── Is there enough data to forecast? ────────────────────────────────────────

export const MIN_SPENDING_DAYS = 3;

/** A straight-line forecast from 0–2 days of spending (or no income) would be noise */
export function forecastReadiness(income: number, spendingByDay: number[], hasLastMonth = false) {
  const days = spendingByDay.filter(v => v > 0).length;
  const hasIncome = income > 0;
  // with last month's pace to lean on, a new month is forecastable right away
  return { ready: hasIncome && (days >= MIN_SPENDING_DAYS || hasLastMonth), hasIncome, days, need: MIN_SPENDING_DAYS };
}
