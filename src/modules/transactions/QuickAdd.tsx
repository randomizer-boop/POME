// ─── Quick add: "+" button in the header, dialog, and an undo toast ──────────
// Hotkey: N (when not typing in a field). Esc closes the dialog.

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import type { AccountType } from '../../shared/types';
import { inPeriod, isoDay } from '../../shared/config';
import { t, catLabel } from '../../shared/i18n';
import { currencySymbol, fmtDate, parseAmount, sanitizeAmountInput } from '../../shared/format';
import { EXPENSE_CATEGORIES } from '../../shared/categories';
import { CategoryBadge } from '../../shared/ui/categoryIcons';
import { Field, fieldStyle } from '../../shared/ui/primitives';
import { useMoney } from '../../store/Settings';
import { AccountChips } from '../accounts/AccountChips';
import { useFinance } from '../../store/FinanceStore';
import { useMonthSummary } from '../../store/useMonthSummary';
import { accName } from '../accounts/labels';
import { validateTransactionDraft } from './logic';

type Kind = 'expense' | 'income';

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);

const OPEN_EVENT = 'pome:quick-add';
/** Open the "new transaction" dialog from anywhere (e.g. the first-steps guide) */
export const openQuickAdd = (kind: Kind = 'expense') => window.dispatchEvent(new CustomEvent<Kind>(OPEN_EVENT, { detail: kind }));

export function QuickAdd() {
  const [open, setOpen] = useState(false);
  const [startKind, setStartKind] = useState<Kind>('expense');
  const [toast, setToast] = useState<{ id: string; text: string } | null>(null);
  const { removeTransaction, guard } = useFinance();

  // N opens the dialog from anywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey && !isTyping(e.target)) {
        e.preventDefault();
        if (!guard()) { setStartKind('expense'); setOpen(true); }
      }
    };
    const onOpen = (e: Event) => {
      if (guard()) return;
      setStartKind((e as CustomEvent<Kind>).detail ?? 'expense');
      setOpen(true);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener(OPEN_EVENT, onOpen); };
  }, [guard]);

  // toast auto-hides
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(id);
  }, [toast]);

  const onSaved = useCallback((id: string, text: string) => { setOpen(false); setToast({ id, text }); }, []);

  return (
    <>
      <button
        onClick={() => { if (!guard()) { setStartKind('expense'); setOpen(true); } }}
        title={t('hotkeyHint')}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20,
          border: '1px solid var(--color-ink)', background: 'var(--color-ink)', color: '#fff',
          fontSize: 13, fontWeight: 500, cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>+</span><span className="m-hide">{t('addOperation')}</span>
      </button>

      {/* portal: the header is its own stacking context, overlays must live at <body> level */}
      {open && createPortal(<QuickAddDialog initialKind={startKind} onClose={() => setOpen(false)} onSaved={onSaved} />, document.body)}

      {toast && createPortal(
        <div role="status" className="toast" style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 60,
          display: 'flex', alignItems: 'center', gap: 16, padding: '10px 12px 10px 16px', borderRadius: 12,
          background: 'var(--color-ink)', color: '#fff', fontSize: 13, boxShadow: 'var(--shadow-hover)',
        }}>
          <span>{toast.text}</span>
          <button onClick={() => { removeTransaction(toast.id); setToast(null); }} style={{
            border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: '#fff',
            borderRadius: 8, padding: '4px 10px', fontSize: 12, cursor: 'pointer',
          }}>
            {t('undo')}
          </button>
        </div>,
        document.body,
      )}
    </>
  );
}

function QuickAddDialog({ initialKind, onClose, onSaved }: { initialKind: Kind; onClose: () => void; onSaved: (id: string, text: string) => void }) {
  const { period, today, addTransaction } = useFinance();
  const { balances } = useMonthSummary();
  const { money, currency, rate } = useMoney();

  const [kind, setKind] = useState<Kind>(initialKind);
  const [amountStr, setAmountStr] = useState('');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES.includes('Groceries') ? 'Groceries' : EXPENSE_CATEGORIES[0]);
  const [accountId, setAccountId] = useState<AccountType>('main');
  const [date, setDate] = useState(isoDay(period, period.current));
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => { amountRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const base = parseAmount(amountStr) / rate;
  const overBalance = kind === 'expense' && base > 0 && base > balances[accountId];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const err = validateTransactionDraft(base, date, today);
    if (err) {
      setError(err === 'amount' ? t('errAmount') : t('errDate'));
      if (err === 'amount') amountRef.current?.focus();
      return;
    }
    const cat = kind === 'income' ? 'Income' : category;
    const desc = description.trim() || catLabel(cat);
    const id = addTransaction({
      date, description: desc, category: cat, accountId,
      amount: kind === 'income' ? base : -base,
    });
    if (!id) { onClose(); return; }
    // saved into another month than the one on screen → say which day, so it doesn't look lost
    const when = inPeriod(date, period) ? '' : ` · ${fmtDate(date)}`;
    onSaved(id, t('added', { x: `${kind === 'income' ? '+' : '−'}${money(base)} · ${desc}${when}` }));
  };

  const seg = (k: Kind, label: string) => (
    <button type="button" role="radio" aria-checked={kind === k} onClick={() => { setKind(k); setError(null); }} style={{
      flex: 1, padding: '7px 0', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
      background: kind === k ? 'var(--color-card)' : 'transparent',
      color: kind === k ? (k === 'income' ? 'var(--color-positive)' : 'var(--color-ink)') : 'var(--color-ink-2)',
      boxShadow: kind === k ? 'var(--shadow-card)' : 'none',
    }}>{label}</button>
  );

  return (
    <div
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      className="sheet-wrap"
      style={{
        position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(26,23,20,0.28)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <form
        role="dialog" aria-modal="true" aria-label={t('quickAddTitle')}
        onSubmit={submit} noValidate className="view-enter sheet"
        style={{
          width: 460, maxWidth: 'calc(100vw - 32px)', background: 'var(--color-card)', borderRadius: 18,
          border: '1px solid var(--line)', boxShadow: '0 24px 60px rgba(26,23,20,0.22)', padding: '18px 22px 0',
          // never taller than the screen: the form scrolls, the buttons stay pinned at the bottom
          maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 22, fontWeight: 500 }}>{t('quickAddTitle')}</div>
          <button type="button" onClick={onClose} aria-label={t('close')} className="icon-btn" style={{ border: 'none' }}>✕</button>
        </div>

        <div role="radiogroup" style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 10, background: 'var(--color-surface)', marginBottom: 12 }}>
          {seg('expense', t('expenseOne'))}
          {seg('income', t('incomeOne'))}
        </div>

        {/* amount — the main thing */}
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 8, borderBottom: `2px solid ${error && base <= 0 ? 'var(--color-negative)' : 'var(--color-ink)'}`,
          paddingBottom: 4, marginBottom: 14,
        }}>
          <span style={{ fontSize: 28, fontFamily: 'var(--font-mono)', color: kind === 'income' ? 'var(--color-positive)' : 'var(--color-ink-3)' }}>
            {kind === 'income' ? '+' : '−'}
          </span>
          <input
            ref={amountRef} inputMode="decimal" placeholder="0" value={amountStr}
            aria-label={t('amount')}
            onChange={e => { setAmountStr(sanitizeAmountInput(e.target.value, currency)); setError(null); }}
            style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', fontSize: 30, fontFamily: 'var(--font-mono)', color: 'var(--color-ink)', padding: 0 }}
          />
          <span style={{ fontSize: 22, fontFamily: 'var(--font-mono)', color: 'var(--color-ink-3)' }}>{currencySymbol(currency)}</span>
        </div>

        {kind === 'expense' && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--color-ink-3)', marginBottom: 6 }}>{t('category')}</div>
            <div role="radiogroup" aria-label={t('category')} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
              {EXPENSE_CATEGORIES.map(c => {
                const on = c === category;
                return (
                  <button key={c} type="button" role="radio" aria-checked={on} onClick={() => setCategory(c)} title={catLabel(c)} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '6px 2px 5px',
                    borderRadius: 10, cursor: 'pointer', fontSize: 10, lineHeight: 1.2, color: on ? 'var(--color-ink)' : 'var(--color-ink-2)',
                    border: `1px solid ${on ? 'var(--color-ink)' : 'var(--line)'}`, background: on ? 'var(--color-bg)' : 'var(--color-card)',
                  }}>
                    <CategoryBadge category={c} size={24} />
                    <span style={{ maxWidth: '100%', textAlign: 'center', minHeight: '2.4em', display: 'flex', alignItems: 'center', hyphens: 'auto', WebkitHyphens: 'auto' }}>{catLabel(c)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <Field label={t('account')} style={{ marginBottom: 10 }}>
          <AccountChips label={t('account')} value={accountId} onChange={setAccountId} sub={a => money(balances[a], { maxFrac: 0 })} />
        </Field>
        <div className="m-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 10, marginBottom: 12 }}>
          <Field label={t('date')}>
            <input type="date" value={date} max={isoDay(today, today.current)}
              onChange={e => { setDate(e.target.value); setError(null); }} style={fieldStyle} />
          </Field>
          <Field label={t('description')}>
            <input value={description} onChange={e => setDescription(e.target.value)}
              placeholder={kind === 'income' ? t('incomePlaceholder') : t('descPlaceholder')} style={fieldStyle} />
          </Field>
        </div>

        {error && <div role="alert" style={{ fontSize: 13, color: 'var(--color-negative)', marginBottom: 10 }}>{error}</div>}
        {!error && overBalance && (
          <div style={{ fontSize: 12, color: 'var(--color-caution)', marginBottom: 10 }}>
            {t('balanceWarn', { acc: accName(accountId), x: money(balances[accountId]) })}
          </div>
        )}

        <div style={{
          display: 'flex', gap: 8, alignItems: 'center', position: 'sticky', bottom: 0, zIndex: 1,
          background: 'var(--color-card)', borderTop: '1px solid var(--line)', margin: '0 -22px', padding: '12px 22px 16px',
        }}>
          <span style={{ marginRight: 'auto' }} />
          <button type="button" onClick={onClose} className="link-btn" style={{ padding: '8px 14px', fontSize: 13 }}>{t('cancel')}</button>
          <button type="submit" style={{
            padding: '8px 18px', borderRadius: 20, border: '1px solid var(--color-ink)', background: 'var(--color-ink)',
            color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}>{t('save')}</button>
        </div>
      </form>
    </div>
  );
}
