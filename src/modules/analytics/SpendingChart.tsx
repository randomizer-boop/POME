import { useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../../shared/i18n';
import { fmtDate } from '../../shared/format';
import { isoDay } from '../../shared/config';
import { Card, SectionHeader } from '../../shared/ui/primitives';
import { useMoney } from '../../store/Settings';
import { useFinance } from '../../store/FinanceStore';
import { useMonthSummary } from '../../store/useMonthSummary';
import { cumulativeExpenses } from '../transactions/logic';
import { niceScale, planPace } from './logic';

/** Cumulative spending vs. an even plan across the month, with hover crosshair */
export function SpendingChart() {
  const { period, transactions } = useFinance();
  const { budgetSum } = useMonthSummary();
  const { money, rate } = useMoney();
  const [hover, setHover] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  const W = 720, H = 292, L = 78, R = 30, T = 30, B = 30;
  const iw = W - L - R, ih = H - T - B;
  const cumulative = cumulativeExpenses(transactions, period);
  const planTotal = budgetSum.planned;
  const pace = (d: number) => planPace(planTotal, d, period.total);

  // axis fits both the plan and the actual line (+ a little headroom)
  const scale = niceScale(Math.max(planTotal, ...cumulative) * 1.05 * rate); // ticks in display currency
  const maxY = scale.max / rate;
  const x = (d: number) => L + ((d - 1) / (period.total - 1)) * iw;
  const y = (v: number) => T + ih - (v / maxY) * ih;
  const xTicks = [1, 5, 10, 15, 20, 25, period.total];
  const path = cumulative.map((v, i) => `${i ? 'L' : 'M'}${x(i + 1)},${y(v)}`).join(' ');
  const m0 = (v: number) => money(v, { maxFrac: 0 });

  const onMove = (e: MouseEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    setHover(Math.max(1, Math.min(period.current, Math.round(((px - L) / iw) * (period.total - 1)) + 1)));
  };
  const hv = hover !== null ? cumulative[hover - 1] : null;
  const diff = hover !== null && hv !== null ? hv - pace(hover) : 0;

  const plot = (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block', cursor: 'crosshair', touchAction: 'pan-x' }} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}>
        {scale.ticks.map(v => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v / rate)} y2={y(v / rate)} stroke="var(--grid)" />
            <text x={L - 8} y={y(v / rate) + 4} textAnchor="end" fontSize={11} fill="var(--color-ink-3)" fontFamily="DM Mono, monospace">
              {v === 0 ? '0' : money(v / rate, { compact: true, maxFrac: 0 })}
            </text>
          </g>
        ))}
        {xTicks.map(d => (
          <g key={d}>
            <line x1={x(d)} x2={x(d)} y1={T} y2={T + ih} stroke="var(--grid)" strokeDasharray="2 4" />
            <text x={x(d)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--color-ink-3)" fontFamily="DM Mono, monospace">{fmtDate(isoDay(period, d))}</text>
          </g>
        ))}
        <line x1={L} x2={W - R} y1={y(planTotal)} y2={y(planTotal)} stroke="var(--color-ink-2)" strokeDasharray="6 4" />
        {/* budget label on the left, away from the "today" marker */}
        <text x={L + 6} y={y(planTotal) - 6} fontSize={11} fill="var(--color-ink-2)">{t('budgetX', { x: m0(planTotal) })}</text>
        <line x1={x(1)} y1={y(pace(1))} x2={x(period.total)} y2={y(pace(period.total))} stroke="var(--color-ink-3)" strokeWidth={1.5} strokeDasharray="6 5" />
        <path d={path} fill="none" stroke="var(--color-ink)" strokeWidth={2} strokeLinejoin="round" />
        <line x1={x(period.current)} x2={x(period.current)} y1={T} y2={T + ih} stroke="var(--color-accent)" strokeWidth={1.5} />
        {/* "today" sits above the plot; flips to the left near the right edge */}
        <line x1={x(period.current)} x2={x(period.current)} y1={T - 12} y2={T} stroke="var(--color-accent)" strokeWidth={1.5} />
        <text
          x={x(period.current) + (period.current > period.total * 0.8 ? -6 : 6)} y={T - 4}
          textAnchor={period.current > period.total * 0.8 ? 'end' : 'start'} fontSize={11} fill="var(--color-accent)"
        >{t('today')}</text>
        {hover !== null && hv !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={T} y2={T + ih} stroke="var(--color-ink)" strokeOpacity={0.5} />
            <line x1={L} x2={W - R} y1={y(hv)} y2={y(hv)} stroke="var(--color-ink)" strokeDasharray="3 3" strokeOpacity={0.3} />
            <circle cx={x(hover)} cy={y(pace(hover))} r={4} fill="var(--color-card)" stroke="var(--color-ink-3)" strokeWidth={2} />
            <circle cx={x(hover)} cy={y(hv)} r={4.5} fill="var(--color-ink)" stroke="var(--color-card)" strokeWidth={2} />
          </g>
        )}
      </svg>
      {hover !== null && hv !== null && (
        <div style={{
          position: 'absolute', top: 8, left: `${(x(hover) / W) * 100}%`,
          transform: hover > period.total * 0.65 ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)',
          background: 'var(--color-card)', border: '1px solid var(--line-strong)', borderRadius: 10, padding: '8px 12px',
          fontSize: 12, lineHeight: 1.6, pointerEvents: 'none', whiteSpace: 'nowrap', boxShadow: 'var(--shadow-hover)',
        }}>
          <div style={{ color: 'var(--color-ink-3)', borderBottom: '1px solid var(--line)', paddingBottom: 3, marginBottom: 3 }}>{fmtDate(isoDay(period, hover))}</div>
          <div>{t('spent')} <b style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{m0(hv)}</b></div>
          <div>{t('plan')} <span style={{ fontFamily: 'var(--font-mono)' }}>{m0(pace(hover))}</span></div>
          <div style={{ color: diff > 0 ? 'var(--color-negative)' : 'var(--color-positive)' }}>
            {diff > 0 ? t('overPlanBy') : t('underPlanBy')} <span style={{ fontFamily: 'var(--font-mono)' }}>{m0(Math.abs(diff))}</span>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <Card style={{ marginBottom: 16 }}>
      <SectionHeader title={t('spendingVsPlan')} right={
        <span style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '6px 12px', fontSize: 11, color: 'var(--color-ink-2)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 2, background: 'var(--color-ink)' }} />{t('actual')}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, borderTop: '2px dashed var(--color-ink-3)' }} />{t('plan')}</span>
          <button className="link-btn m-only" onClick={() => setExpanded(true)} style={{ padding: '2px 10px', fontSize: 11, whiteSpace: 'nowrap' }}>⤢ {t('expandChart')}</button>
        </span>
      } />
      <div className="chart-scroll"><div className="chart-inner">{plot}</div></div>
      {expanded && createPortal(
        <div role="dialog" aria-modal="true" aria-label={t('spendingVsPlan')} style={{
          position: 'fixed', inset: 0, zIndex: 80, background: 'var(--color-bg)', display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
            <span style={{ fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-2)' }}>{t('spendingVsPlan')}</span>
            <button className="icon-btn" onClick={() => setExpanded(false)} aria-label={t('close')}>✕</button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ minWidth: 720 }}>{plot}</div>
          </div>
          <div className="rotate-hint" style={{ fontSize: 12, color: 'var(--color-ink-3)', textAlign: 'center', padding: '0 16px 16px' }}>{t('rotateHint')}</div>
        </div>,
        document.body,
      )}
    </Card>
  );
}
