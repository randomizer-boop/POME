import { t, daysWord } from '../../shared/i18n';

/** "overdue by 3 days" / "today" / "tomorrow" / "in 5 days" */
export function dueLabel(days: number): string {
  if (days < 0) return t('overdueBy', { n: -days, days: daysWord(-days) });
  if (days === 0) return t('todayLower');
  if (days === 1) return t('dueTomorrow');
  return t('inDays', { n: days, days: daysWord(days) });
}
