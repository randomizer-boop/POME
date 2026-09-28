import type { Transaction } from '../../shared/types';
import { divide, percent, scale, sum } from '../../shared/money';
import { isExpense } from '../transactions/logic';

/** Round axis step in display units (1, 2, 2.5, 5 × 10ⁿ) and the resulting max */
export function niceScale(maxValue: number, steps = 6) {
  if (!(maxValue > 0)) maxValue = steps; // empty data → a small 0..6 axis instead of NaN
  const raw = maxValue / steps;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = ([1, 2, 2.5, 5, 10].find(m => m * mag >= raw) ?? 10) * mag;
  const max = Math.ceil(maxValue / step) * step;
  return { step, max, ticks: Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step) };
}

// ─── Spending breakdown ───────────────────────────────────────────────────────

export interface CategoryShare { name: string; spent: number; share: number }

/** All actual expenses this period by category (bills included, transfers never), biggest first */
export function spendingByCategory(txs: Transaction[]): CategoryShare[] {
  const groups: Record<string, number[]> = {};
  for (const t of txs) if (isExpense(t)) (groups[t.category] ??= []).push(-t.amount);
  const rows = Object.entries(groups).map(([name, v]) => ({ name, spent: sum(v) }));
  const total = sum(rows.map(r => r.spent));
  return rows.map(r => ({ ...r, share: percent(r.spent, total) })).sort((a, b) => b.spent - a.spent);
}

/** Even-plan line: budget spread evenly over the month, value on `day` */
export const planPace = (planTotal: number, day: number, daysTotal: number) => scale(divide(planTotal, daysTotal), day);
