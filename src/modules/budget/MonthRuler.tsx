import type { Period } from '../../shared/types';
import { t } from '../../shared/i18n';

/** Budget used vs. month elapsed, with day ticks as guide lines */
export function MonthRuler({ budgetPct, period, loaded }: { budgetPct: number; period: Period; loaded: boolean }) {
  const monthPct = (period.current / period.total) * 100;
  const pos = (d: number) => `${((d - 0.5) / period.total) * 100}%`;
  return (
    <div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11, color: 'var(--color-ink-2)', marginBottom: 10 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 6, borderRadius: 3, background: 'var(--color-ink)' }} />{t('budgetUsed', { p: Math.round(budgetPct) })}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 2, height: 12, background: 'var(--color-accent)' }} />{t('todayOfMonth', { p: Math.round(monthPct) })}
        </span>
      </div>
      <div style={{ position: 'relative', paddingTop: 4 }}>
        <div style={{ height: 8, background: 'var(--color-surface)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: loaded ? `${Math.min(budgetPct, 100)}%` : '0%',
            background: 'var(--color-ink)', borderRadius: 8, transition: 'width 1.1s cubic-bezier(0.4,0,0.2,1)',
          }} />
        </div>
        <div style={{ position: 'absolute', top: -2, left: `${monthPct}%`, width: 2, height: 20, background: 'var(--color-accent)', transform: 'translateX(-50%)' }} />
        <div style={{ position: 'relative', height: 10, marginTop: 4 }}>
          {Array.from({ length: period.total }, (_, i) => i + 1).map(d => {
            const major = d === 1 || d % 5 === 0;
            return <div key={d} style={{ position: 'absolute', left: pos(d), width: 1, height: major ? 8 : 4, background: major ? 'var(--line-strong)' : 'var(--line)' }} />;
          })}
        </div>
        <div style={{ position: 'relative', height: 14, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-ink-3)' }}>
          {[1, 5, 10, 15, 20, 25, 30].filter(d => d <= period.total).map(d => (
            <span key={d} style={{ position: 'absolute', left: pos(d), transform: 'translateX(-50%)' }}>{d}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
