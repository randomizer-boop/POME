import { useState } from 'react';
import { t, catLabel } from '../../shared/i18n';
import { monthName } from '../../shared/format';
import { spendingByCategory } from './logic';
import { colorOf } from '../../shared/categories';
import { useProgressLoad } from '../../shared/hooks';
import { Card, Dot, Page, PageHeader, SectionHeader } from '../../shared/ui/primitives';
import { useMoney } from '../../store/Settings';
import { useFinance } from '../../store/FinanceStore';
import { useMonthSummary } from '../../store/useMonthSummary';
import { SpendingChart } from './SpendingChart';

/** Kept intentionally small: one trend chart + one breakdown */
export function AnalyticsPage() {
  const { period, transactions } = useFinance();
  const { expenses } = useMonthSummary();
  const { money } = useMoney();
  const loaded = useProgressLoad();
  const [hoverCat, setHoverCat] = useState<string | null>(null);
  const sorted = spendingByCategory(transactions);
  const COLS = '1fr 120px 60px';

  return (
    <Page maxWidth={1000}>
      <PageHeader eyebrow={`${monthName(period)} ${period.year}`} title={t('analytics')} />
      <SpendingChart />
      <Card>
        <SectionHeader title={t('whereMoneyWent')} right={<span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--color-ink-2)' }}>{money(expenses, { maxFrac: 0 })}</span>} />
        <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', gap: 2, marginBottom: 14 }}>
          {sorted.map(s => (
            <div key={s.name} title={catLabel(s.name)} onMouseEnter={() => setHoverCat(s.name)} onMouseLeave={() => setHoverCat(null)} style={{
              width: loaded ? `${s.share}%` : '0%', background: colorOf(s.name), cursor: 'pointer',
              opacity: hoverCat && hoverCat !== s.name ? 0.25 : 1, transition: 'width 0.9s cubic-bezier(0.4,0,0.2,1), opacity 0.15s ease',
            }} />
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: COLS, fontSize: 11, color: 'var(--color-ink-3)', padding: '6px 8px', borderBottom: '1px solid var(--line)' }}>
          <span>{t('category')}</span><span style={{ textAlign: 'right' }}>{t('spent')}</span><span style={{ textAlign: 'right' }}>{t('share')}</span>
        </div>
        {sorted.map(s => (
          <div key={s.name} className="row-hover" onMouseEnter={() => setHoverCat(s.name)} onMouseLeave={() => setHoverCat(null)} style={{
            display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', fontSize: 13, padding: 8,
            borderBottom: '1px solid var(--color-border-light)', background: hoverCat === s.name ? 'var(--color-bg)' : undefined,
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}><Dot color={colorOf(s.name)} />{catLabel(s.name)}</span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{money(s.spent, { maxFrac: 0 })}</span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-ink-2)' }}>{Math.round(s.share)}%</span>
          </div>
        ))}
      </Card>
    </Page>
  );
}
