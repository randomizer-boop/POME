import { useMemo, useState } from 'react';
import { t, catLabel, goalLabel } from '../../shared/i18n';
import { fmtMonthYear, monthName } from '../../shared/format';
import { colorOf } from '../../shared/categories';
import { Card, Dot, LedgerRow, Page, PageHeader, SectionHeader, StatusPill } from '../../shared/ui/primitives';
import { useMoney } from '../../store/Settings';
import { useFinance } from '../../store/FinanceStore';
import { useMonthSummary } from '../../store/useMonthSummary';
import { flexibleByCategory, flexibleByDay } from '../transactions/logic';
import { addMonths } from '../goals/logic';
import { applyCuts, forecastReadiness, goalImpact, monthlyBaselines } from './logic';
import { add } from '../../shared/money';

/** Shown until there's enough data: says what's missing and how close it is */
function NotEnoughData({ hasIncome, days, need }: { hasIncome: boolean; days: number; need: number }) {
  const item = (done: boolean, text: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: done ? 'var(--color-ink-3)' : 'var(--color-ink)', padding: '6px 0' }}>
      <span style={{
        width: 18, height: 18, borderRadius: '50%', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
        border: done ? 'none' : '1.5px solid var(--line-strong)', background: done ? 'var(--color-ink-2)' : 'transparent', color: '#fff',
      }}>{done ? '✓' : ''}</span>
      <span style={{ textDecoration: done ? 'line-through' : 'none' }}>{text}</span>
    </div>
  );
  return (
    <Card style={{ maxWidth: 620, margin: '0 auto', textAlign: 'left', padding: '28px 32px' }}>
      <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 26, fontWeight: 500, lineHeight: 1.2, marginBottom: 10 }}>{t('noForecastTitle')}</div>
      <p style={{ fontSize: 14, color: 'var(--color-ink-2)', margin: '0 0 18px', lineHeight: 1.55 }}>{t('noForecastHint', { n: need })}</p>
      {item(hasIncome, t('noForecastIncome'))}
      {item(days >= need, t('noForecastProgress', { a: Math.min(days, need), b: need }))}
      <div style={{ display: 'flex', gap: 4, margin: '6px 0 0 28px' }}>
        {Array.from({ length: need }, (_, i) => (
          <span key={i} style={{ width: 36, height: 6, borderRadius: 3, background: i < days ? 'var(--color-ink-2)' : 'var(--color-surface)' }} />
        ))}
      </div>
      <p style={{ fontSize: 12, color: 'var(--color-ink-3)', margin: '18px 0 0' }}>{t('noForecastWhatIf')}</p>
    </Card>
  );
}

const MAX_CUT = 50;

export function ForecastPage() {
  const { period, transactions, goals } = useFinance();
  const { income, safe, forecast, hasLastMonth } = useMonthSummary();
  const { money } = useMoney();
  const m0 = (v: number) => money(v, { maxFrac: 0 });
  const [cuts, setCuts] = useState<Record<string, number>>({});

  const { projectedVariable, projectedEndBalance } = forecast;

  const baselines = useMemo(() => monthlyBaselines(flexibleByCategory(transactions), period), [transactions, period]);
  const categories = Object.entries(baselines).sort((a, b) => b[1] - a[1]);
  const { extraPerMonth, extraThisMonth } = applyCuts(baselines, cuts, period);
  const impact = goalImpact(goals, extraPerMonth);
  const endWithCuts = add(projectedEndBalance, extraThisMonth);
  const endTone = projectedEndBalance < 0 ? 'bad' : projectedEndBalance < safe.goalsLeft ? 'warn' : 'ok';
  const hasCuts = extraPerMonth > 0;

  const readiness = forecastReadiness(income, flexibleByDay(transactions, period), hasLastMonth);

  const reach = (n: number) => Number.isFinite(n) ? (
    <>
      <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)' }}>{t('monthsShort', { n })}</div>
      <div style={{ fontSize: 11, color: 'var(--color-ink-3)' }}>{fmtMonthYear(addMonths(period, n))}</div>
    </>
  ) : <span>—</span>;

  return (
    <Page maxWidth={1160}>
      <PageHeader eyebrow={`${monthName(period)} ${period.year}`} title={t('forecast')} />

      {!readiness.ready ? <NotEnoughData {...readiness} /> : (

      <div className="m-stack" style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* What if? */}
        <Card>
          <SectionHeader title={t('whatIf')} right={hasCuts && <button className="link-btn" onClick={() => setCuts({})}>{t('reset')}</button>} />
          <p style={{ fontSize: 13, color: 'var(--color-ink-2)', margin: '0 0 12px' }}>{t('whatIfHint')}</p>

          {categories.map(([cat, base]) => {
            const pct = cuts[cat] ?? 0;
            return (
              <div key={cat} className="row-whatif" style={{
                display: 'grid', gridTemplateColumns: '1fr 150px 46px 80px', gap: 12, alignItems: 'center',
                padding: '10px 0', borderTop: '1px solid var(--line)',
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}><Dot color={colorOf(cat)} />{catLabel(cat)}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-ink-3)', marginLeft: 16, fontFamily: 'var(--font-mono)' }}>{m0(base)} {t('nowPerMonth')}</div>
                </div>
                <input
                  type="range" min={0} max={MAX_CUT} step={5} value={pct}
                  aria-label={catLabel(cat)}
                  onChange={e => setCuts(c => ({ ...c, [cat]: Number(e.target.value) }))}
                  style={{ width: '100%', accentColor: 'var(--color-ink)' }}
                />
                <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', textAlign: 'right', color: pct ? 'var(--color-ink)' : 'var(--color-ink-3)' }}>
                  {pct ? `−${pct}%` : '0%'}
                </span>
                <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', textAlign: 'right', color: pct ? 'var(--color-positive)' : 'var(--color-ink-3)' }}>
                  {pct ? `+${m0(base * pct / 100)}` : '—'}
                </span>
              </div>
            );
          })}

          <LedgerRow strong label={t('extraPerMonth')} amount={<span style={{ color: hasCuts ? 'var(--color-positive)' : undefined }}>+{m0(extraPerMonth)}</span>} />
        </Card>

        <div style={{ display: 'grid', gap: 16 }}>
          {/* Month-end forecast */}
          <Card>
            <SectionHeader title={t('monthEnd')} right={
              <StatusPill tone={endTone}>{endTone === 'ok' ? t('onTrack') : endTone === 'warn' ? t('tight') : t('overBudget')}</StatusPill>
            } />
            <LedgerRow label={t('balanceNow')} amount={m0(safe.liquidBalance)} />
            {safe.expectedIncome > 0 && <LedgerRow label={t('expectedIncomeRow')} amount={`+${m0(safe.expectedIncome)}`} />}
            <LedgerRow label={t('billsToPay')} amount={`−${m0(safe.upcomingBills)}`} />
            <LedgerRow label={t('projectedVariableRow')} detail={forecast.paceSource === 'lastMonth' ? t('atLastMonthPace') : t('atCurrentPace')} amount={`−${m0(projectedVariable)}`} />
            <LedgerRow strong label={t('projectedEndRow')} amount={<span style={{ color: projectedEndBalance < 0 ? 'var(--color-negative)' : undefined }}>{m0(projectedEndBalance)}</span>} />
            {safe.goalsLeft > 0 && <LedgerRow label={t('goalsInEndRow')} amount={m0(safe.goalsLeft)} />}
            {hasCuts && (
              <LedgerRow label={t('leftWithCuts')} amount={<span style={{ color: 'var(--color-positive)' }}>{m0(endWithCuts)}</span>} />
            )}
          </Card>

          {/* Impact on goals */}
          <Card>
            <SectionHeader title={t('impactOnGoals')} />
            <p style={{ fontSize: 12, color: 'var(--color-ink-3)', margin: '0 0 8px' }}>{t('impactHint')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr', gap: 10, fontSize: 11, color: 'var(--color-ink-3)', padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
              <span />{/* goal name column */}
              <span>{t('nowLabel')}</span>
              <span>{t('withCuts')}</span>
            </div>
            {impact.map(({ goal, nowMonths, withMonths, soonerBy }) => (
              <div key={goal.id} style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr', gap: 10, alignItems: 'start', padding: '10px 0', borderBottom: '1px solid var(--color-border-light)' }}>
                <span style={{ fontSize: 13 }}>{goalLabel(goal.name)}</span>
                <div style={{ color: 'var(--color-ink-2)' }}>{reach(nowMonths)}</div>
                <div>
                  {reach(withMonths)}
                  <div style={{ fontSize: 11, color: soonerBy > 0 ? 'var(--color-positive)' : 'var(--color-ink-3)' }}>
                    {soonerBy > 0 ? t('monthsSooner', { n: soonerBy }) : t('noChange')}
                  </div>
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>
      )}
    </Page>
  );
}
