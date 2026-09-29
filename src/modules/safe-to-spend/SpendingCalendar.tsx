import type { CSSProperties } from 'react';
import { t } from '../../shared/i18n';
import { currencySymbol, fmtDate, fmtTiny, monthName, weekdaysShort } from '../../shared/format';
import { Card, Dot, SectionHeader } from '../../shared/ui/primitives';
import { useMoney } from '../../store/Settings';
import { useFinance } from '../../store/FinanceStore';
import { useDayLimits, useMonthSummary } from '../../store/useMonthSummary';
import { isoDay } from '../../shared/config';
import { flexibleByDay } from '../transactions/logic';

/** Month grid of flexible spending per day. Each day is compared with THAT day's limit —
 *  the same number the Safe-to-spend card showed on that day (see safeOnDay). */
export function SpendingCalendar() {
  const { period, transactions, isCurrentMonth, viewDay, dayPicked, isToday, selectDay } = useFinance();
  const { safe } = useMonthSummary();
  const limits = useDayLimits();
  const { money, currency, rate } = useMoney();
  const byDay = flexibleByDay(transactions, period);

  const offset = (new Date(period.year, period.index, 1).getDay() + 6) % 7; // Monday-first
  const cells: (number | null)[] = [...Array.from({ length: offset }, () => null), ...byDay.map((_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  return (
    <Card className="cal-card" style={{ padding: '20px 20px 16px' }}>
      <SectionHeader
        title={t('spendingByDay', { month: monthName(period) })}
        right={<span style={{ fontSize: 12, color: 'var(--color-ink-2)', whiteSpace: 'nowrap' }}>{isToday ? t('calLimitToday') : t('calLimitDay', { d: fmtDate(isoDay(period, viewDay)) })} <b style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--color-ink)' }}>{money(safe.todayLimit, { maxFrac: 0 })}</b></span>}
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
            const clickable = !future || isCurrentMonth;
            const today = isCurrentMonth && d === period.current;
            const selected = dayPicked && d === viewDay && !today;
            const dayLimit = limits[d - 1]?.limit ?? 0;
            const over = !future && spent > 0 && spent > dayLimit + 0.005;
            return (
              <div key={idx} className="cal-cell" title={future ? t('calFutureTitle') : t('calCellTitle', { a: money(spent, { maxFrac: 0 }), b: money(dayLimit, { maxFrac: 0 }) })}
                role={clickable ? 'button' : undefined} tabIndex={clickable ? 0 : undefined}
                onClick={clickable ? () => selectDay(d) : undefined}
                onKeyDown={!clickable ? undefined : e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectDay(d); } }}
                style={{
                ...base, background: selected ? 'var(--color-accent-soft)' : 'var(--color-card)', cursor: clickable ? 'pointer' : 'default',
                boxShadow: today ? 'inset 0 0 0 1.5px var(--color-ink)' : selected ? 'inset 0 0 0 1.5px var(--color-brand)' : 'none',
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
