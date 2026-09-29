// ─── Safe to spend ────────────────────────────────────────────────────────────
// Starts from the money you actually have, not from income, and covers the days until
// the next income (pay cycle, see cycle.ts) — or the month end if there's no income rule:
//
//   spendable = balance on spending accounts (cash + main)  ← money actually moved to Savings is already out
//             + income due today, not recorded yet    (planned salary arriving today)
//             − bills to pay before the next income   (planned, not yet paid; overdue included)
//             − goal contributions still to set aside (planned for the month − already moved to Savings)
//   per day   = spendable / days covered (today included)
//
// The savings % is a target, not a reserve: target = % × income; progress = moved to Savings
// (beyond goal contributions). "I want to save 15 000" doesn't make 15 000 unavailable —
// only a real transfer to Savings does, and it's already reflected in the balance.
//
// Today's spending is already out of the balance, so today's limit is computed from the
// start of the day:  todayLimit = (spendable + spentToday) / daysLeft,  todayLeft = todayLimit − spentToday.

import { add, divide, percent, scale, sub } from '../../shared/money';

/** Default share of income to save (chosen by the user in onboarding / the Safe-to-spend card) */
export const DEFAULT_SAVINGS_RATE = 0.05;
export const MAX_SAVINGS_RATE = 0.9;

export interface SafeToSpendInput {
  liquidBalance: number;    // cash + main right now (can be negative)
  incomeReceived: number;   // actual income in the pay cycle (base of the savings %)
  expectedIncome: number;   // planned income arriving today, not recorded yet
  upcomingBills: number;    // planned bills not paid yet
  goalsPlanned: number;     // planned goal contributions for the CALENDAR month
  /** moved INTO goals this month (goal by goal, each capped by its own plan) — see goals/logic.goalsThisMonth */
  goalsPaid: number;
  /** net moved to Savings in the pay cycle, EXCLUDING goal top-ups — progress of the savings % */
  savedInCycle: number;
  flexibleSpent: number;    // actual non-bill spending in the cycle, today included
  spentToday: number;       // actual non-bill spending today
  daysPassed: number;       // days of the cycle so far, today included
  daysTotal: number;        // days in the cycle
  /** share of income to save, 0…0.9 (default 5%) */
  savingsRate?: number;
}

export type SafeStatus = 'ok' | 'tight' | 'over';

export interface SafeToSpend {
  liquidBalance: number;
  expectedIncome: number;
  upcomingBills: number;
  goalsLeft: number;        // goal money still to set aside
  /** moved to Savings this month that counts toward the goal contributions */
  goalsDone: number;
  savingsRate: number;
  /** savings % × this month's income */
  savingsTarget: number;
  /** already moved to Savings toward the target (beyond goal contributions) */
  savingsDone: number;
  /** actually moved toward the % (beyond goal contributions), NOT capped — can exceed the target */
  savingsMoved: number;
  /** savingsMoved as % of the target (e.g. 150 = plan beaten by 50%); 0 when there's no target */
  savingsProgressPct: number;
  /** still to move to Savings to reach the target — a recommendation, NOT subtracted from spendable */
  savingsLeft: number;
  /** What can still be spent until payday / month end (negative = bills/goals aren't covered) */
  spendable: number;
  /** how much is missing when spendable < 0 */
  shortfall: number;
  /** = spendable, kept for the "left for the month" indicator */
  leftForMonth: number;
  /** Cycle's flexible capacity: already spent + still spendable (≥ 0) */
  flexibleBudget: number;
  flexibleSpent: number;
  daysLeft: number;         // including today
  todayLimit: number;       // never negative
  spentToday: number;
  todayLeft: number;        // can be negative (overspent today)
  /** limit for tomorrow if nothing more is spent today (what's left today rolls over); null when tomorrow is payday */
  tomorrowLimit: number | null;
  /** Flexible capacity spread evenly over the cycle — the calendar's daily plan */
  dailyPace: number;
  avgSoFar: number;
  todayUsedPct: number;     // spentToday / todayLimit
  monthLeftPct: number;     // spendable / flexibleBudget
  status: SafeStatus;
}

export const clampSavingsRate = (r: number) => Number.isFinite(r) ? Math.min(MAX_SAVINGS_RATE, Math.max(0, r)) : DEFAULT_SAVINGS_RATE;

export function computeSafeToSpend(i: SafeToSpendInput): SafeToSpend {
  // Goals and the savings % are separate things, fed by separate transfers:
  //  • goals (calendar month) ← only top-ups made to a goal
  //  • the savings % (pay cycle) ← only other transfers to Savings
  const goalsDone = Math.min(Math.max(0, i.goalsPaid), Math.max(0, i.goalsPlanned));
  const goalsLeft = sub(Math.max(0, i.goalsPlanned), goalsDone);
  const savingsRate = clampSavingsRate(i.savingsRate ?? DEFAULT_SAVINGS_RATE);
  const savingsTarget = scale(Math.max(0, add(i.incomeReceived, i.expectedIncome)), savingsRate);
  const savingsMoved = Math.max(0, i.savedInCycle);
  const savingsDone = Math.min(savingsTarget, savingsMoved);
  const savingsProgressPct = savingsTarget > 0 ? Math.round((savingsMoved / savingsTarget) * 100) : 0;
  // the % is a TARGET (shown as progress), not a reserve: only money actually moved to Savings
  // leaves the spending balance — and it already did, via liquidBalance (Savings isn't in it)
  const savingsLeft = sub(savingsTarget, savingsDone);

  const spendable = sub(add(i.liquidBalance, i.expectedIncome), i.upcomingBills, goalsLeft);

  const daysLeft = Math.max(1, i.daysTotal - i.daysPassed + 1);
  const todayLimit = divide(Math.max(0, add(spendable, i.spentToday)), daysLeft);
  const todayLeft = sub(todayLimit, i.spentToday);
  const tomorrowLimit = daysLeft > 1 ? divide(Math.max(0, spendable), daysLeft - 1) : null;
  const flexibleBudget = Math.max(0, add(spendable, i.flexibleSpent));
  const dailyPace = divide(flexibleBudget, Math.max(1, i.daysTotal));
  const avgSoFar = divide(i.flexibleSpent, Math.max(1, i.daysPassed));

  // over  → bills/goals until payday aren't covered
  // tight → over today's limit, or the usual daily pace is above what's allowed from now on
  const status: SafeStatus = spendable < 0 ? 'over' : todayLeft < 0 || avgSoFar > todayLimit ? 'tight' : 'ok';

  return {
    liquidBalance: i.liquidBalance, expectedIncome: i.expectedIncome, upcomingBills: i.upcomingBills,
    goalsLeft, goalsDone, savingsRate, savingsTarget, savingsDone, savingsMoved, savingsProgressPct, savingsLeft,
    spendable, shortfall: Math.max(0, -spendable), leftForMonth: spendable, flexibleBudget, flexibleSpent: i.flexibleSpent,
    daysLeft, todayLimit, spentToday: i.spentToday, todayLeft, tomorrowLimit, dailyPace, avgSoFar,
    todayUsedPct: todayLimit > 0 ? percent(i.spentToday, todayLimit) : i.spentToday > 0 ? 100 : 0,
    monthLeftPct: flexibleBudget > 0 ? percent(Math.max(0, spendable), flexibleBudget) : 0,
    status,
  };
}
