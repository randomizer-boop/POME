// Muted category palette — used only for small dots and chart segments
const CATEGORY_COLORS: Record<string, string> = {
  Income:          '#5E7A67',
  Housing:         '#9B2F31',
  Groceries:       '#5E7A67',
  Dining:          '#C19A55',
  Transport:       '#7D7596',
  Subscriptions:   '#B08470',
  Health:          '#7E9A74',
  Shopping:        '#A0697E',
  'Personal Care': '#9A8067',
  'Work & Tools':  '#6A8497',
  Utilities:       '#8A8C6E',
  'Family & Gifts': '#B0707A',   // money to family/friends, gifts
  Other:           '#8E877D',   // anything that doesn't fit — always last
};

export const colorOf = (category: string) => CATEGORY_COLORS[category] ?? 'var(--color-ink-3)';

/** Expense categories available in forms */
export const EXPENSE_CATEGORIES = Object.keys(CATEGORY_COLORS).filter(c => c !== 'Income');
