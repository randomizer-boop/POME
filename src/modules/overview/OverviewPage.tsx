import { t } from '../../shared/i18n';
import { useProgressLoad } from '../../shared/hooks';
import { Card, Label, Page, ProgressBar } from '../../shared/ui/primitives';
import { useMoney } from '../../store/Settings';
import { useMonthSummary } from '../../store/useMonthSummary';
import type { View } from '../../shared/types';
import { BillsAlert } from '../recurring/BillsAlert';
import { OnboardingGuide } from '../onboarding/OnboardingGuide';
import { ReconcileReminder } from '../accounts/ReconcileReminder';
import { SafeToSpendCard } from '../safe-to-spend/SafeToSpendCard';
import { MonthResultCard } from './MonthResultCard';
import { useFinance } from '../../store/FinanceStore';
import { SpendingCalendar } from '../safe-to-spend/SpendingCalendar';

const I = ({ d }: { d: string }) => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const STAT_ICONS = [
  'M8 13V3M4 7l4-4 4 4',                 // income
  'M8 3v10M4 9l4 4 4-4',                 // expenses
  'M2.5 8a5.5 5.5 0 1 0 11 0 5.5 5.5 0 0 0-11 0M8 2.5V8l3.5 2', // budget left
  'M8 13.5S2.5 10.2 2.5 6.3A2.8 2.8 0 0 1 8 5a2.8 2.8 0 0 1 5.5 1.3C13.5 10.2 8 13.5 8 13.5z', // savings
];
const STAT_TINT = ['#5E7A67', '#9B2F31', '#6B6259', '#9A8FB8'];

/** Only the key budget info. Charts live in Analytics / Forecast. */
export function OverviewPage({ viewKey, onNav }: { viewKey: number; onNav?: (v: View) => void }) {
  const loaded = useProgressLoad();
  const { money } = useMoney();
  const { income, expenses, budgetSum, expenseShare, safe } = useMonthSummary();
  const { isCurrentMonth, dayPicked } = useFinance();

  const stats = [
    { label: t('income'),      value: money(income, { compact: true }),         sub: t('receivedThisMonth'),                                   meter: null },
    { label: t('expenses'),    value: money(expenses, { compact: true }),       sub: t('pctOfIncome', { p: Math.round(expenseShare) }), meter: expenseShare },
    budgetSum.planned > 0
      ? { label: t('budgetLeft'), value: money(budgetSum.left, { compact: true }), sub: t('ofX', { x: money(budgetSum.planned, { maxFrac: 0 }) }), meter: Math.max(0, 100 - budgetSum.usedPct) }
      : { label: t('budgetLeft'), value: '—', sub: t('budgetNotSetSub'), meter: null },
    // the setting (target %) and the fact: how much of that target has actually been moved to Savings
    safe.savingsRate > 0
      ? { label: t('savingsRate'), value: `${Math.round(safe.savingsRate * 100)}%`,
          sub: t('savingsSavedOf', { x: money(safe.savingsMoved, { maxFrac: 0 }), y: money(safe.savingsTarget, { maxFrac: 0 }) })
            + (safe.savingsProgressPct > 100 ? ` · ${t('savingsPlanPct', { p: safe.savingsProgressPct })}` : ''),
          meter: Math.min(100, safe.savingsProgressPct) }
      : { label: t('savingsRate'), value: '0%', sub: t('savingsOff2'), meter: null },
  ];

  return (
    <Page maxWidth={1160}>
      {isCurrentMonth && <BillsAlert onOpenAll={onNav ? () => onNav('recurring') : undefined} />}
      {isCurrentMonth && <OnboardingGuide onNav={onNav} />}
      {isCurrentMonth && <ReconcileReminder onNav={onNav} />}
      <div className="m-stack" style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 16, marginBottom: 16, alignItems: 'start' }}>
        {isCurrentMonth || dayPicked ? <SafeToSpendCard viewKey={viewKey} /> : <MonthResultCard />}
        <SpendingCalendar />
      </div>

      <Card className="m-2col" style={{ padding: 0, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {stats.map((s, i) => (
          <div key={i} style={{ padding: '18px 22px', borderLeft: i ? '1px solid var(--line)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Label>{s.label}</Label>
              <span style={{
                width: 28, height: 28, borderRadius: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                color: STAT_TINT[i], background: `color-mix(in srgb, ${STAT_TINT[i]} 12%, white)`,
              }}>
                <I d={STAT_ICONS[i]} />
              </span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 500, fontFamily: 'var(--font-mono)', letterSpacing: '-0.03em', margin: '6px 0 8px', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
              {s.value}
            </div>
            {s.meter !== null ? <ProgressBar pct={s.meter} loaded={loaded} height={4} color="var(--color-ink-2)" /> : <div style={{ height: 4 }} />}
            <div style={{ fontSize: 11, color: 'var(--color-ink-3)', marginTop: 8 }}>{s.sub}</div>
          </div>
        ))}
      </Card>
    </Page>
  );
}
