// ─── Safe to spend ────────────────────────────────────────────────────────────
// Starts from the money you actually have, not from income, and covers the days until
// the next income (pay cycle, see cycle.ts) — or the month end if there's no income rule:
//
//   spendable = balance on spending accounts (cash + main)
//             + income due today, not recorded yet   (planned salary arriving today)
//             − bills to pay before the next income  (planned, not yet paid; overdue included)
//             − goal contributions still to set aside (planned for the month − already moved to Savings)
//             − safety buffer                         (user's amount, or 5% of the cycle's income)
//
//   per day   = spendable / days covered (today included)
//
// Today's spending is already out of the balance, so today's limit is computed from the
// start of the day:  todayLimit = (spendable + spentToday) / daysLeft,  todayLeft = todayLimit − spentToday.

import { add, divide, percent, scale, sub } from '../../shared/money';

/** Cushion kept back from spending: share of this month's income (received + expected) */
export const SAFETY_BUFFER_RATE = 0.05;

export interface SafeToSpendInput {
  liquidBalance: number;    // cash + main right now (can be negative)
  incomeReceived: number;   // actual income this month (for the buffer)
  expectedIncome: number;   // planned income not received yet
  upcomingBills: number;    // planned bills not paid yet
  goalsPlanned: number;     // planned goal contributions for the month
  savedThisMonth: number;   // already moved to Savings this month
  flexibleSpent: number;    // actual non-bill spending this month, today included
  spentToday: number;       // actual non-bill spending today
  daysPassed: number;       // days of the cycle so far, today included
  daysTotal: number;        // days in the cycle
  bufferRate?: number;
  /** fixed safety buffer chosen by the user (overrides the rate) */
  bufferAmount?: number | null;
}

export type SafeStatus = 'ok' | 'tight' | 'over';

export interface SafeToSpend {
  liquidBalance: number;
  expectedIncome: number;
  upcomingBills: number;
  goalsLeft: number;        // goal money still to set aside
  safetyBuffer: number;
  /** What can still be spent until the end of the month (can be negative) */
  spendable: number;
  /** = spendable, kept for the "left for the month" indicator */
  leftForMonth: number;
  /** Month's flexible capacity: already spent + still spendable */
  flexibleBudget: number;
  flexibleSpent: number;
  daysLeft: number;         // including today
  todayLimit: number;       // never negative
  spentToday: number;
  todayLeft: number;        // can be negative (overspent today)
  /** Flexible capacity spread evenly over the month — the calendar's daily plan */
  dailyPace: number;
  avgSoFar: number;
  todayUsedPct: number;     // spentToday / todayLimit
  monthLeftPct: number;     // spendable / flexibleBudget
  status: SafeStatus;
}

export function computeSafeToSpend(i: SafeToSpendInput): SafeToSpend {
  const goalsLeft = Math.max(0, sub(i.goalsPlanned, Math.max(0, i.savedThisMonth)));
  const safetyBuffer = i.bufferAmount != null && i.bufferAmount >= 0
    ? i.bufferAmount
    : scale(Math.max(0, add(i.incomeReceived, i.expectedIncome)), i.bufferRate ?? SAFETY_BUFFER_RATE);
  const spendable = sub(add(i.liquidBalance, i.expectedIncome), i.upcomingBills, goalsLeft, safetyBuffer);

  const daysLeft = Math.max(1, i.daysTotal - i.daysPassed + 1);
  const todayLimit = divide(Math.max(0, add(spendable, i.spentToday)), daysLeft);
  const todayLeft = sub(todayLimit, i.spentToday);
  const flexibleBudget = add(spendable, i.flexibleSpent);
  const dailyPace = divide(Math.max(0, flexibleBudget), i.daysTotal);
  const avgSoFar = divide(i.flexibleSpent, i.daysPassed);

  // over  → already short for the rest of the month
  // tight → over today's limit, or the usual daily pace is above what's allowed from now on
  const status: SafeStatus = spendable < 0 ? 'over' : todayLeft < 0 || avgSoFar > todayLimit ? 'tight' : 'ok';

  return {
    liquidBalance: i.liquidBalance, expectedIncome: i.expectedIncome, upcomingBills: i.upcomingBills,
    goalsLeft, safetyBuffer, spendable, leftForMonth: spendable, flexibleBudget, flexibleSpent: i.flexibleSpent,
    daysLeft, todayLimit, spentToday: i.spentToday, todayLeft, dailyPace, avgSoFar,
    todayUsedPct: todayLimit > 0 ? percent(i.spentToday, todayLimit) : i.spentToday > 0 ? 100 : 0,
    monthLeftPct: percent(Math.max(0, spendable), flexibleBudget),
    status,
  };
}
