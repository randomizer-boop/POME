import type { CSSProperties } from 'react';
import { t } from '../../shared/i18n';
import { currencySymbol, fmtTiny, monthName, weekdaysShort } from '../../shared/format';
import { Card, Dot, SectionHeader } from '../../shared/ui/primitives';
import { useMoney } from '../../store/Settings';
import { useFinance } from '../../store/FinanceStore';
import { useMonthSummary } from '../../store/useMonthSummary';
import { flexibleByDay } from '../transactions/logic';

/** Month grid of flexible spending per day vs. the daily limit from safe-to-spend */
export function SpendingCalendar() {
  const { period, transactions, isCurrentMonth } = useFinance();
  const { safe } = useMonthSummary();
  const { money, currency, rate } = useMoney();
  const byDay = flexibleByDay(transactions, period);
  const limit = safe.dailyPace;

  const offset = (new Date(period.year, period.index, 1).getDay() + 6) % 7; // Monday-first
  const cells: (number | null)[] = [...Array.from({ length: offset }, () => null), ...byDay.map((_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  return (
    <Card className="cal-card" style={{ padding: '20px 20px 16px' }}>
      <SectionHeader
        title={t('spendingByDay', { month: monthName(period) })}
        right={<span style={{ fontSize: 12, color: 'var(--color-ink-2)', whiteSpace: 'nowrap' }}>{t('dailyLimit')} <b style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--color-ink)' }}>{money(limit, { maxFrac: 0 })}</b></span>}
      />
      <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'var(--color-bg)', borderBottom: '1px solid var(--line)' }}>
          {weekdaysShort().map((w, i) => (
            <div key={i} style={{ fontSize: 10, textAlign: 'center', padding: '5px 0', color: 'var(--color-ink-3)', borderLeft: i ? '1px solid var(--line)' : 'none' }}>{w}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {cells.map((d, idx) => {
            const base: CSSProperties = {
              height: 46, padding: '4px 6px', position: 'relative',
              borderLeft: idx % 7 ? '1px solid var(--line)' : 'none',
              borderBottom: idx >= cells.length - 7 ? 'none' : '1px solid var(--line)',
            };
            if (d === null) return <div key={idx} style={{ ...base, background: 'var(--color-bg)' }} />;
            const spent = byDay[d - 1];
            const future = d > period.current;
            const today = isCurrentMonth && d === period.current;
            const over = !future && spent > limit;
            return (
              <div key={idx} className="cal-cell" title={future ? t('upcoming') : money(spent, { maxFrac: 0 })} style={{
                ...base, background: 'var(--color-card)', cursor: 'default',
                boxShadow: today ? 'inset 0 0 0 1.5px var(--color-ink)' : 'none',
              }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: today ? 'var(--color-ink)' : 'var(--color-ink-3)', fontWeight: today ? 500 : 400 }}>{d}</div>
                {!future && spent > 0 && (
                  <div className="cal-amt" style={{
                    position: 'absolute', right: 6, bottom: 4, fontSize: 10, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap',
                    color: over ? 'var(--color-negative)' : 'var(--color-ink-2)',
                  }}>
                    <span className="m-hide">{fmtTiny(spent * rate, currency)}</span>
                    <span className="m-only">{fmtTiny(spent * rate, currency).replace(currencySymbol(currency), '').trim()}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 11, color: 'var(--color-ink-2)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Dot color="var(--color-negative)" size={7} />{t('overLimitLegend')}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, boxShadow: 'inset 0 0 0 1.5px var(--color-ink)' }} />{t('today')}
        </span>
      </div>
    </Card>
  );
}
