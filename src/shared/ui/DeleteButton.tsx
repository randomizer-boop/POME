import { useState } from 'react';
import { t } from '../i18n';
import { useFinance } from '../../store/FinanceStore';

/**
 * ✕ that asks "Delete? Yes / No" inline before calling onConfirm.
 * In demo mode it shows the read-only notice instead.
 * Put it in a row with className="row-hover reveal-on-hover" — it's faint until the row is hovered.
 */
export function DeleteButton({ onConfirm, label }: { onConfirm: () => void; label: string }) {
  const { guard } = useFinance();
  const [asking, setAsking] = useState(false);

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
    {/* the question floats over the row, so table columns don't jump */}
    {asking && (
      <span role="dialog" style={{
        position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', zIndex: 5,
        display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, whiteSpace: 'nowrap',
        background: 'var(--color-card)', border: '1px solid var(--line-strong)', borderRadius: 10, padding: '5px 6px 5px 10px', boxShadow: 'var(--shadow-hover)',
      }}>
        <span style={{ color: 'var(--color-ink-2)' }}>{t('confirmDelete')}</span>
        <button type="button" autoFocus onClick={() => { setAsking(false); onConfirm(); }} className="confirm-btn danger">{t('yes')}</button>
        <button type="button" onClick={() => setAsking(false)} onKeyDown={e => { if (e.key === 'Escape') setAsking(false); }} className="confirm-btn">{t('no')}</button>
      </span>
    )}
    <button
      type="button"
      className="icon-btn del-btn"
      onClick={() => { if (!guard()) setAsking(true); }}
      aria-label={label}
      title={label}
      style={{ width: 26, height: 26, fontSize: 11 }}
    >
      ✕
    </button>
    </span>
  );
}
