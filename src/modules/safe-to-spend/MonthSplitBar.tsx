import { useState } from 'react';
import { t } from '../../shared/i18n';
import { useProgressLoad } from '../../shared/hooks';
import type { SafeToSpend } from './logic';
import { sumBy } from '../../shared/money';

// Muted, distinguishable colors — one per bucket
const SEG = {
  bills:  '#C98C7E',
  goals:  '#9A8FB8',
  left:   '#9DBB96',
} as const;

type Key = keyof typeof SEG;

/** Money available until payday / month end (balance + income due today) split into bills / goals / free */
export function MonthSplitBar({ safe, money }: { safe: SafeToSpend; money: (v: number) => string }) {
  const loaded = useProgressLoad();
  const [hover, setHover] = useState<Key | null>(null);
  const parts: { key: Key; label: string; value: number }[] = [
    { key: 'bills',  label: t('segBills'),  value: safe.upcomingBills },
    { key: 'goals',  label: t('segGoals'),  value: safe.goalsLeft },
    { key: 'left',   label: t('segLeft'),   value: Math.max(0, safe.spendable) },
  ];
  const total = sumBy(parts, p => p.value);

  return (
    <div>
      <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-3)', marginBottom: 8 }}>
        {t('monthSplit')}
      </div>
      <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', gap: 2, background: 'var(--color-surface)' }}>
        {parts.map(p => (
          <div
            key={p.key}
            className="segment"
            onMouseEnter={() => setHover(p.key)}
            onMouseLeave={() => setHover(null)}
            title={`${p.label} · ${money(p.value)}`}
            style={{
              width: loaded ? `${total > 0 ? (p.value / total) * 100 : 0}%` : '0%',
              background: SEG[p.key],
              opacity: hover && hover !== p.key ? 0.3 : 1,
              transition: 'width 0.9s cubic-bezier(0.4,0,0.2,1), opacity 0.15s ease',
            }}
          />
        ))}
      </div>
      <div className="m-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', marginTop: 10, rowGap: 8 }}>
        {parts.map((p, i) => (
          <div
            key={p.key}
            onMouseEnter={() => setHover(p.key)}
            onMouseLeave={() => setHover(null)}
            style={{
              padding: '2px 0 2px 10px', borderLeft: i ? '1px solid var(--line)' : 'none', marginLeft: i ? 0 : -10,
              opacity: hover && hover !== p.key ? 0.45 : 1, transition: 'opacity 0.15s ease', cursor: 'default',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--color-ink-2)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: SEG[p.key] }} />{p.label}
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, fontFamily: 'var(--font-mono)', marginTop: 2 }}>{money(p.value)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
