import { t } from '../../shared/i18n';
import { monthName } from '../../shared/format';
import { useProgressLoad } from '../../shared/hooks';
import { Card, LedgerRow, ProgressBar, SectionHeader, StatusPill } from '../../shared/ui/primitives';
import { useMoney } from '../../store/Settings';
import { useFinance } from '../../store/FinanceStore';
import { useMonthSummary } from '../../store/useMonthSummary';

/** For a past month "safe to spend today" makes no sense — show how the month ended instead */
export function MonthResultCard() {
  const { period } = useFinance();
  const { income, expenses, saved, budgetSum, monthResult } = useMonthSummary();
  const { money, minus } = useMoney();
  const loaded = useProgressLoad();
  const left = monthResult;
  const over = left < 0;

  return (
    <Card>
      <SectionHeader
        title={`${t('monthResult')} · ${monthName(period)}`}
        right={<StatusPill tone={over ? 'bad' : 'ok'}>{over ? t('monthResultOver') : t('monthResultLeft')}</StatusPill>}
      />
      <div className="hero-amount" style={{
        fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 56, fontWeight: 500, lineHeight: 1,
        letterSpacing: '-0.03em', margin: '2px 0 16px', whiteSpace: 'nowrap',
        color: over ? 'var(--color-negative)' : 'var(--color-ink)',
      }}>
        {over ? '−' : ''}{money(Math.abs(left), { maxFrac: 0 })}
      </div>
      <LedgerRow label={t('income')} amount={`+${money(income, { maxFrac: 0 })}`} />
      <LedgerRow label={t('expenses')} amount={minus(expenses, { maxFrac: 0 })} />
      <LedgerRow label={t('monthResultSaved')} amount={minus(Math.max(0, saved), { maxFrac: 0 })} />
      {budgetSum.planned > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-ink-2)', marginBottom: 6 }}>
            <span>{t('monthlyBudget')}</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{Math.round(budgetSum.usedPct)}%</span>
          </div>
          <ProgressBar pct={budgetSum.usedPct} loaded={loaded} height={5} color={budgetSum.left < 0 ? 'var(--color-negative)' : 'var(--color-ink-2)'} />
        </div>
      )}
      <p style={{ fontSize: 12, color: 'var(--color-ink-3)', margin: '14px 0 0' }}>{t('pastMonthNote')}</p>
    </Card>
  );
}
