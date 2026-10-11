// ─── Presentational building blocks (no business logic) ──────────────────────

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { t } from '../i18n';

export function Label({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: color ?? 'var(--color-ink-2)' }}>
      {children}
    </div>
  );
}

export function Card({ children, style, className }: { children: ReactNode; style?: CSSProperties; className?: string }) {
  return (
    <div className={className} style={{
      background: 'var(--color-card-glass)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      borderRadius: 16, padding: '20px 24px',
      border: '1px solid var(--line)', boxShadow: 'var(--shadow-card)', ...style,
    }}>
      {children}
    </div>
  );
}

/** Card title with a divider underneath — marks where the block's content starts */
export function SectionHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
      paddingBottom: 12, marginBottom: 16, borderBottom: '1px solid var(--line)',
    }}>
      <Label>{title}</Label>
      {right}
    </div>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--line)' }}>
      <Label>{eyebrow}</Label>
      <h1 style={{
        fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 40, fontWeight: 500,
        letterSpacing: '-0.02em', margin: '8px 0 6px', lineHeight: 1.05,
      }}>
        {title}
      </h1>
      {children}
    </div>
  );
}

export function Page({ children, maxWidth = 1080 }: { children: ReactNode; maxWidth?: number }) {
  return <div style={{ padding: '28px 36px 48px', maxWidth }} className="view-enter page">{children}</div>;
}

export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return <span style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', background: color, flexShrink: 0 }} />;
}

export type Tone = 'ok' | 'warn' | 'bad' | 'muted';
const toneColor: Record<Tone, string> = {
  ok: 'var(--color-positive)', warn: 'var(--color-caution)', bad: 'var(--color-negative)', muted: 'var(--color-ink-3)',
};

export function StatusPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 20,
      border: '1px solid var(--line-strong)', fontSize: 12, fontWeight: 500, color: 'var(--color-ink)',
      background: 'var(--color-card)', whiteSpace: 'nowrap',
    }}>
      <Dot color={toneColor[tone]} size={7} />{children}
    </span>
  );
}

/** Progress bar with an optional "expected by today" guide line */
export function ProgressBar({ pct, loaded, delay = 0, color, height = 6, marker }: {
  pct: number; loaded: boolean; delay?: number; color?: string; height?: number; marker?: number;
}) {
  const fill = color ?? (pct > 100 ? 'var(--color-negative)' : 'var(--color-ink-2)');
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ height, background: 'var(--color-surface)', borderRadius: height, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: loaded ? `${Math.min(pct, 100)}%` : '0%', background: fill, borderRadius: height,
          transition: `width ${0.55 + delay * 0.08}s cubic-bezier(0.4, 0, 0.2, 1)`,
        }} />
      </div>
      {marker !== undefined && (
        <div title={t('expectedByToday')} style={{
          position: 'absolute', top: -4, left: `${marker}%`, width: 1.5, height: height + 8,
          background: 'var(--color-ink)', transform: 'translateX(-50%)',
        }} />
      )}
    </div>
  );
}

export function PaceLegend() {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--color-ink-3)' }}>
      <span style={{ width: 1.5, height: 12, background: 'var(--color-ink)' }} />
      {t('expectedByToday')}
    </span>
  );
}

/** Label/value line with a guide line on top (ledger style) */
export function LedgerRow({ label, detail, amount, strong, children }: {
  label: string; detail?: ReactNode; amount: ReactNode; strong?: boolean; children?: ReactNode;
}) {
  return (
    <div style={{ borderTop: strong ? '1.5px solid var(--color-ink)' : '1px solid var(--line)', padding: '9px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: strong ? 500 : 400 }}>{label}</span>
          {detail && <span style={{ fontSize: 11, color: 'var(--color-ink-3)', marginLeft: 8 }}>{detail}</span>}
        </div>
        <span style={{ fontSize: strong ? 15 : 13, fontWeight: 500, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{amount}</span>
      </div>
      {children}
    </div>
  );
}

// ─── Form bits ────────────────────────────────────────────────────────────────

export const fieldStyle: CSSProperties = {
  width: '100%', padding: '8px 12px', border: '1px solid var(--line-strong)', borderRadius: 10,
  background: 'var(--color-card)', fontSize: 14, color: 'var(--color-ink)', fontFamily: 'var(--font-sans)',
};

export function Field({ label, children, style }: { label: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <label style={{ display: 'block', ...style }}>
      <span style={{ fontSize: 11, color: 'var(--color-ink-3)', marginBottom: 5, display: 'block' }}>{label}</span>
      {children}
    </label>
  );
}

export function PrimaryButton({ children, type = 'submit', onClick }: { children: ReactNode; type?: 'submit' | 'button'; onClick?: () => void }) {
  return (
    <button type={type} onClick={onClick} style={{
      width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--color-ink)',
      background: 'var(--color-ink)', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer',
    }}>
      {children}
    </button>
  );
}

export function FormMessage({ error, success }: { error?: string | null; success?: string | null }) {
  if (error) return <div role="alert" style={{ fontSize: 13, color: 'var(--color-negative)', marginBottom: 10 }}>{error}</div>;
  if (success) return <div style={{ fontSize: 13, color: 'var(--color-positive)', marginBottom: 10 }}>✓ {success}</div>;
  return null;
}

/**
 * Smoothly opens/closes its content (height + fade), and unmounts it once closed.
 * Grid-rows trick: 0fr ↔ 1fr animates to the content's real height without measuring it.
 */
export function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      // next frame, so the browser sees the closed state first and animates from it
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(id);
    }
    setShown(false);
    const id = window.setTimeout(() => setMounted(false), 320);
    return () => window.clearTimeout(id);
  }, [open]);
  if (!mounted) return null;
  return (
    <div className="collapse" style={{
      display: 'grid', gridTemplateRows: shown ? '1fr' : '0fr', opacity: shown ? 1 : 0,
      transition: 'grid-template-rows 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease',
    }}>
      <div style={{ overflow: 'hidden', minHeight: 0 }}>{children}</div>
    </div>
  );
}
