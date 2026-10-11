import { useState } from 'react';
import type { Period, RecurringPayment } from '../../shared/types';
import { t, descLabel } from '../../shared/i18n';
import { fmtDate } from '../../shared/format';
import { isoDay } from '../../shared/config';

interface Item { r: RecurringPayment; paid: boolean }

/** This month on one axis: paid payments filled, upcoming ones outlined, dot size ~ amount */
export function RecurringTimeline({ items, period, money }: { items: Item[]; period: Period; money: (v: number) => string }) {
  const [hover, setHover] = useState<string | null>(null);
  const W = 800, H = 92, L = 32, R = 24, AXIS = 52;
  const x = (d: number) => L + ((d - 1) / (period.total - 1)) * (W - L - R);
  const max = Math.max(...items.map(i => i.r.amount), 1);
  const radius = (a: number) => 5 + Math.sqrt(a / max) * 13;

  // stack payments that share a day
  const byDay = new Map<number, number>();
  const placed = items
    .map(i => ({ ...i, day: Math.min(i.r.day, period.total) }))
    .sort((a, b) => b.r.amount - a.r.amount)
    .map(i => { const n = byDay.get(i.day) ?? 0; byDay.set(i.day, n + 1); return { ...i, stack: n }; });

  const active = placed.find(p => p.r.id === hover);

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }} role="img" aria-label={t('thisMonth')}>
        {/* axis with week guides */}
        <line x1={L} x2={W - R} y1={AXIS} y2={AXIS} stroke="var(--line-strong)" />
        {[1, 5, 10, 15, 20, 25, period.total].map(d => (
          <g key={d}>
            <line x1={x(d)} x2={x(d)} y1={AXIS} y2={AXIS + 5} stroke="var(--line-strong)" />
            <text x={x(d)} y={AXIS + 18} textAnchor="middle" fontSize={11} fill="var(--color-ink-3)" fontFamily="DM Mono, monospace">{d}</text>
          </g>
        ))}
        {/* past part of the month */}
        <line x1={L} x2={x(period.current)} y1={AXIS} y2={AXIS} stroke="var(--color-ink-2)" strokeWidth={2} />
        <line x1={x(period.current)} x2={x(period.current)} y1={8} y2={AXIS + 5} stroke="var(--color-accent)" strokeWidth={1.5} />
        <text x={x(period.current) + 5} y={16} fontSize={11} fill="var(--color-accent)">{t('today')}</text>

        {placed.map(p => {
          const r = radius(p.r.amount);
          const cy = AXIS - r - 2 - p.stack * 6;
          return (
            <circle
              key={p.r.id}
              className="timeline-dot"
              cx={x(p.day)} cy={cy} r={r}
              fill={p.paid ? 'color-mix(in srgb, var(--color-ink-2) 22%, white)' : 'var(--color-card)'}
              stroke={p.paid ? 'var(--color-ink-3)' : 'var(--color-brand)'}
              strokeWidth={p.paid ? 1 : 2}
              onMouseEnter={() => setHover(p.r.id)}
              onMouseLeave={() => setHover(null)}
            />
          );
        })}
      </svg>
      {active && (
        <div style={{
          position: 'absolute', top: -6, left: `${(x(active.day) / W) * 100}%`,
          // keep the tooltip inside the card near the edges
          transform: `translate(${active.day <= 4 ? '-10%' : active.day >= period.total - 3 ? '-90%' : '-50%'}, -100%)`,
          background: 'var(--color-card)', border: '1px solid var(--line-strong)', borderRadius: 8, padding: '5px 10px',
          fontSize: 12, whiteSpace: 'nowrap', boxShadow: 'var(--shadow-hover)', pointerEvents: 'none',
        }}>
          <b style={{ fontWeight: 500 }}>{descLabel(active.r.name)}</b>
          <span style={{ color: 'var(--color-ink-3)', margin: '0 6px' }}>{fmtDate(isoDay(period, active.day))}</span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>{money(active.r.amount)}</span>
        </div>
      )}
      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--color-ink-2)', marginTop: 4 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'color-mix(in srgb, var(--color-ink-2) 22%, white)', border: '1px solid var(--color-ink-3)' }} />{t('statusPaid')}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid var(--color-brand)' }} />{t('statusUpcoming')}
        </span>
      </div>
    </div>
  );
}
