import { useState, type FormEvent } from 'react';
import type { AccountType } from '../../shared/types';
import { isoDay } from '../../shared/config';
import { t } from '../../shared/i18n';
import { currencySymbol, parseAmount, sanitizeAmountInput } from '../../shared/format';
import { Card, Field, FormMessage, PrimaryButton, SectionHeader, fieldStyle } from '../../shared/ui/primitives';
import { useMoney } from '../../store/Settings';
import { useFinance } from '../../store/FinanceStore';
import { useMonthSummary } from '../../store/useMonthSummary';
import { validateTransfer } from './logic';
import { accName } from './labels';
import { AccountChips } from './AccountChips';

export function TransferForm() {
  const { period, addTransfer } = useFinance();
  const { balances } = useMonthSummary();
  const { money, currency, rate } = useMoney();

  const [from, setFrom] = useState<AccountType>('main');
  const [to, setTo] = useState<AccountType>('savings');
  const [amountStr, setAmountStr] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const base = parseAmount(amountStr) / rate; // stored in base currency
    const err = validateTransfer(from, to, base, balances);
    if (err) {
      setDone(null);
      setError(err === 'amount' ? t('errAmount') : err === 'same' ? t('errSame') : t('errInsufficient', { acc: accName(from) }));
      return;
    }
    if (!addTransfer({ date: isoDay(period, period.current), from, to, amount: base, note: note.trim() || undefined })) return;
    setError(null);
    setDone(t('transferDone', { x: money(base) }));
    setAmountStr('');
    setNote('');
  };

  return (
    <Card>
      <SectionHeader title={t('transferBetween')} />
      <form onSubmit={submit} noValidate>
        <Field label={t('from')} style={{ marginBottom: 6 }}>
          <AccountChips label={t('from')} value={from} onChange={a => { setFrom(a); setError(null); }} sub={a => money(balances[a], { maxFrac: 0 })} />
        </Field>
        <div style={{ display: 'flex', justifyContent: 'center', margin: '2px 0 4px' }}>
          <button type="button" aria-label="Swap" title="⇅" onClick={() => { setFrom(to); setTo(from); setError(null); }} style={{
            height: 28, width: 40, border: '1px solid var(--line-strong)', borderRadius: 14,
            background: 'var(--color-bg)', cursor: 'pointer', color: 'var(--color-ink-2)', fontSize: 14,
          }}>⇅</button>
        </div>
        <Field label={t('to')} style={{ marginBottom: 14 }}>
          <AccountChips label={t('to')} value={to} onChange={a => { setTo(a); setError(null); }} />
        </Field>

        <Field label={t('amount')} style={{ marginBottom: 12 }}>
          <div style={{ position: 'relative' }}>
            <input inputMode="decimal" value={amountStr} placeholder="0"
              onChange={e => { setAmountStr(sanitizeAmountInput(e.target.value, currency)); setError(null); setDone(null); }}
              style={{ ...fieldStyle, fontFamily: 'var(--font-mono)', paddingRight: 36, borderColor: error ? 'var(--color-negative)' : 'var(--line-strong)' }} />
            <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--font-mono)', color: 'var(--color-ink-3)' }}>
              {currencySymbol(currency)}
            </span>
          </div>
        </Field>

        <Field label={t('note')} style={{ marginBottom: 14 }}>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder={t('notePlaceholder')} style={fieldStyle} />
        </Field>

        <FormMessage error={error} success={done} />
        <PrimaryButton>{t('doTransfer')}</PrimaryButton>
        <p style={{ fontSize: 11, color: 'var(--color-ink-3)', margin: '12px 0 0', lineHeight: 1.5 }}>{t('transfersHint')}</p>
      </form>
    </Card>
  );
}
