import { locale, t } from '../shared/i18n';
import { monthName } from '../shared/format';
import { useFinance } from '../store/FinanceStore';

const btn = {
  width: 28, height: 28, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 14,
  color: 'var(--color-ink-2)', fontSize: 16, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
} as const;

/** ‹ September 2026 › — look back at previous months; "Today" jumps back */
export function MonthSwitcher() {
  const { period, isCurrentMonth, canGoBack, canGoForward, shiftMonth, goToCurrentMonth } = useFinance();
  const short = new Date(period.year, period.index, 1).toLocaleDateString(locale(), { month: 'short' }).replace('.', '');
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', border: '1px solid var(--line-strong)', borderRadius: 18,
        background: isCurrentMonth ? 'var(--color-card)' : 'var(--color-accent-soft)', padding: 2,
      }}>
        <button style={{ ...btn, opacity: canGoBack ? 1 : 0.3 }} disabled={!canGoBack} onClick={() => shiftMonth(-1)} aria-label={t('prevMonth')} title={t('prevMonth')}>‹</button>
        <span style={{ fontSize: 13, fontWeight: 500, minWidth: 0, padding: '0 4px', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
          <span className="m-hide">{monthName(period)} {period.year}</span>
          <span className="m-only">{short}</span>
        </span>
        <button style={{ ...btn, opacity: canGoForward ? 1 : 0.3 }} disabled={!canGoForward} onClick={() => shiftMonth(1)} aria-label={t('nextMonth')} title={t('nextMonth')}>›</button>
      </div>
      {!isCurrentMonth && (
        <button className="link-btn m-hide" onClick={goToCurrentMonth} style={{ padding: '4px 10px', fontSize: 12 }}>{t('thisMonthBtn')}</button>
      )}
    </div>
  );
}
