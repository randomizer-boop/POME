import type { AccountType } from '../../shared/types';
import { ACCOUNT_IDS, accName } from './labels';

/** Pick one of the 3 accounts with tappable chips (instead of a native <select>, which is huge on phones) */
export function AccountChips({ value, onChange, sub, label }: {
  value: AccountType;
  onChange: (a: AccountType) => void;
  /** small second line under each name, e.g. the balance */
  sub?: (a: AccountType) => string;
  label?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
      {ACCOUNT_IDS.map(a => {
        const on = a === value;
        return (
          <button key={a} type="button" role="radio" aria-checked={on} onClick={() => onChange(a)} style={{
            minHeight: 38, padding: '6px 8px', borderRadius: 10, cursor: 'pointer', textAlign: 'center', lineHeight: 1.25,
            border: on ? '1.5px solid var(--color-ink)' : '1px solid var(--line-strong)',
            background: on ? 'var(--color-bg)' : 'var(--color-card)', color: 'var(--color-ink)',
            fontSize: 13, fontWeight: on ? 500 : 400,
          }}>
            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{accName(a)}</div>
            {sub && <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-ink-3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub(a)}</div>}
          </button>
        );
      })}
    </div>
  );
}
