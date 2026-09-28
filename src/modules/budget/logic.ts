// Budget compares limits with *actual* spending only.
// A planned recurring payment does not reduce a category until its transaction exists.
import type { Allocations, BudgetCategory, Transaction } from '../../shared/types';
import { percent, sub, sum } from '../../shared/money';
import { isExpense } from '../transactions/logic';

export interface BudgetRow extends BudgetCategory {
  /** limit − actual expenses (negative = over) */
  remaining: number;
  /** actual / limit in % (100 when there's spending but no limit) */
  usedPct: number;
}

export function buildBudget(allocations: Allocations, txs: Transaction[]): BudgetRow[] {
  return Object.entries(allocations).map(([name, allocated]) => {
    const spent = sum(txs.filter(t => t.category === name && isExpense(t)).map(t => -t.amount));
    return {
      name, allocated, spent,
      remaining: sub(allocated, spent),
      usedPct: allocated > 0 ? percent(spent, allocated) : spent > 0 ? 100 : 0,
    };
  });
}

export const budgetTotals = (cats: BudgetCategory[]) => {
  const planned = sum(cats.map(c => c.allocated));
  const spent = sum(cats.map(c => c.spent));
  return { planned, spent, left: sub(planned, spent), usedPct: percent(spent, planned) };
};
