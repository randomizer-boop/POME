import { useEffect, useState } from 'react';
import { t } from '../../shared/i18n';
import { useFinance } from '../../store/FinanceStore';
import { MAX_SAVINGS_RATE } from './logic';

const PRESETS = [0, 5, 10, 15, 20];

/**
 * Chips 0 / 5 / 10 / 15 / 20 % + "Other". A custom value becomes its own highlighted chip
 * (e.g. "18%") as soon as it's saved, with a short "Saved" confirmation.
 */
export function SavingsRatePicker({ onPicked }: { onPicked?: () => void }) {
  const { savingsRate, setSavingsRate } = useFinance();
  const pct = Math.round(savingsRate * 100);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const id = window.setTimeout(() => setSaved(false), 1800);
    return () => window.clearTimeout(id);
  }, [saved]);

  const pick = (p: number) => {
    if (!setSavingsRate(p / 100)) return;
    setEditing(false);
    setSaved(true);
    onPicked?.();
  };

  const chip = (active: boolean) => ({
    border: `1px solid ${active ? 'var(--color-ink)' : 'var(--line-strong)'}`,
    background: active ? 'var(--color-ink)' : 'var(--color-card)', color: active ? '#fff' : 'var(--color-ink)',
    borderRadius: 18, padding: '6px 12px', fontSize: 13, fontFamily: 'var(--font-mono)', cursor: 'pointer',
  } as const);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      {PRESETS.map(p => (
        <button key={p} type="button" style={chip(pct === p)} onClick={() => pick(p)} title={p === 0 ? t('savingsOff') : undefined}>
          {p}%
        </button>
      ))}
      {!PRESETS.includes(pct) && <button type="button" style={chip(true)} onClick={() => { setDraft(String(pct)); setEditing(true); }}>{pct}%</button>}
      {editing ? (
        <form onSubmit={e => { e.preventDefault(); const v = Number(draft.replace(',', '.')); if (draft !== '' && Number.isFinite(v) && v >= 0) pick(Math.min(Math.round(v), MAX_SAVINGS_RATE * 100)); }}
          style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
          <input autoFocus inputMode="numeric" value={draft} onChange={e => setDraft(e.target.value.replace(/\D/g, '').slice(0, 2))}
            aria-label={t('savingsCustom')}
            style={{ width: 56, height: 32, border: '1px solid var(--line-strong)', borderRadius: 16, padding: '0 10px', fontFamily: 'var(--font-mono)', fontSize: 13, background: 'var(--color-card)' }} />
          <span style={{ fontSize: 13, color: 'var(--color-ink-2)' }}>%</span>
          <button type="submit" className="confirm-btn">OK</button>
        </form>
      ) : (
        <button type="button" style={chip(false)} onClick={() => { setDraft(''); setEditing(true); }}>{t('savingsCustom')}</button>
      )}
      {saved && <span role="status" style={{ fontSize: 12, color: 'var(--color-positive)', marginLeft: 4 }}>✓ {t('savedShort')}</span>}
    </div>
  );
}
