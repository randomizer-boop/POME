import type { Goal, Period, Transfer } from '../../shared/types';
import { divide, percent, sub, sum } from '../../shared/money';

/** Calendar months left for a goal, this month included (Sep → Mar = 7). 0 when the deadline has passed. */
export function monthsUntil(deadline: string, p: Period): number {
  const [y, m] = deadline.split('-').map(Number);
  return Math.max(0, (y * 12 + (m - 1)) - (p.year * 12 + p.index) + 1);
}

/** remaining = target − saved (never below 0) */
export const goalRemaining = (g: Goal) => Math.max(0, sub(g.target, g.saved));

/** Planned contributions for this month — what "safe to spend" sets aside for goals.
 *  Reached goals need nothing; a contribution is capped by what's left to save. */
export const goalsPlannedTotal = (goals: Goal[]) =>
  sum(goals.map(g => Math.min(goalRemaining(g), Math.max(0, g.monthlyContribution))));

export const goalsSavedTotal = (goals: Goal[]) => sum(goals.map(g => g.saved));

// ─── Goals ≠ the savings % ────────────────────────────────────────────────────
// A goal is paid only by transfers made TO THAT GOAL (Goals → Top up, tagged with its id).
// Any other transfer to Savings is general saving (the savings %), never a goal contribution.

/** The goal a transfer contributes to: tagged with its id, or (data saved before goal ids) into Savings with the goal's name as note */
export const goalOfTransfer = (x: Transfer, goals: Goal[]): Goal | undefined =>
  x.goalId ? goals.find(g => g.id === x.goalId)
    : x.to === 'savings' && x.note ? goals.find(g => g.name === x.note) : undefined;

export const isGoalTransfer = (x: Transfer, goals: Goal[]) => !!x.goalId || !!goalOfTransfer(x, goals);

/**
 * This month's goal contributions, goal by goal: planned vs. actually moved INTO that goal.
 * `monthTransfers` = this calendar month's transfers (so far). Over-paying one goal doesn't cover another.
 */
export function goalsThisMonth(goals: Goal[], monthTransfers: Transfer[]) {
  const rows = goals.map(g => {
    const mine = monthTransfers.filter(x => goalOfTransfer(x, goals)?.id === g.id);
    const paid = Math.max(0, sum(mine.map(x => (x.to === 'savings' ? x.amount : 0) - (x.from === 'savings' ? x.amount : 0))));
    // what was left to save at the start of the month (this month's contributions are already in `saved`)
    const leftBefore = Math.max(0, sub(g.target, sub(g.saved, paid)));
    const planned = Math.min(Math.max(0, g.monthlyContribution), leftBefore);
    const done = Math.min(paid, planned);
    return { goal: g, planned, paid, done, left: sub(planned, done) };
  });
  return { rows, planned: sum(rows.map(r => r.planned)), done: sum(rows.map(r => r.done)), left: sum(rows.map(r => r.left)) };
}

export function goalProgress(goal: Goal, p: Period) {
  const remaining = goalRemaining(goal);
  const months = monthsUntil(goal.deadline, p);
  const reached = remaining === 0;
  const overdue = !reached && months === 0;
  // overdue → everything left is needed now
  const neededPerMonth = reached ? 0 : overdue ? remaining : divide(remaining, months);
  const gap = sub(goal.monthlyContribution, neededPerMonth);
  return {
    pct: Math.min(100, percent(goal.saved, goal.target)),
    remaining, months, neededPerMonth, gap, reached, overdue,
    onTrack: reached || (!overdue && gap >= 0),
  };
}

/** Months until the goal is reached with a given monthly contribution (Infinity if never) */
export function monthsToReach(goal: Goal, perMonth: number): number {
  const remaining = goalRemaining(goal);
  if (remaining === 0) return 0;
  return perMonth > 0 ? Math.ceil(remaining / perMonth) : Infinity;
}

export const addMonths = (p: Period, n: number) => new Date(p.year, p.index + n, 1);

export type GoalDraftError = 'name' | 'target' | 'saved' | 'deadline' | null;

/** `month` is the <input type="month"> value, YYYY-MM */
export function validateGoal(name: string, target: number, saved: number, month: string, p: Period): GoalDraftError {
  if (!name.trim()) return 'name';
  if (!Number.isFinite(target) || target <= 0) return 'target';
  if (!Number.isFinite(saved) || saved < 0 || saved > target) return 'saved';
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m || Number(m[1]) * 12 + Number(m[2]) - 1 < p.year * 12 + p.index) return 'deadline';
  return null;
}

/** YYYY-MM → last day of that month, YYYY-MM-DD */
export function monthToDeadline(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
}
