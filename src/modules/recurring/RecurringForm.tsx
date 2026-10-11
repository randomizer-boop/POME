import { useState, type FormEvent } from 'react';
import type { AccountType, Frequency } from '../../shared/types';
import { t, catLabel } from '../../shared/i18n';
import { currencySymbol, parseAmount, sanitizeAmountInput } from '../../shared/format';
import { locale } from '../../shared/i18n';
import { EXPENSE_CATEGORIES } from '../../shared/categories';
import { Card, Field, FormMessage, PrimaryButton, SectionHeader, fieldStyle } from '../../shared/ui/primitives';
import { useMoney } from '../../store/Settings';
import { useFinance } from '../../store/FinanceStore';
import { ACCOUNT_IDS, accName } from '../accounts/labels';
import { validateRecurring } from './logic';

const monthLabel = (m: number) => new Date(2026, m, 1).toLocaleDateString(locale(), { month: 'long' });

/** kind 'income' = salary / regular income (category Income, no category choice); 'bill' = a payment */
export function RecurringForm({ embedded = false, kind = 'bill', onDone }: { embedded?: boolean; kind?: 'bill' | 'income'; /** called after a successful add (e.g. to close the form) */ onDone?: () => void }) {
  const isIncome = kind === 'income';
  const { period, addRecurring } = useFinance();
  const { money, currency, rate } = useMoney();

  const [name, setName] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [day, setDay] = useState('1');
  const [month, setMonth] = useState(period.index);
  const [category, setCategory] = useState(isIncome ? 'Income' : 'Subscriptions');
  const [accountId, setAccountId] = useState<AccountType>('main');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const amount = parseAmount(amountStr) / rate;
    const dayNum = Number(day);
    const err = validateRecurring(name, amount, dayNum);
    if (err) {
      setDone(null);
      setError(err === 'name' ? t('errName') : err === 'amount' ? t('errAmount') : t('errDay'));
      return;
    }
    const ok = addRecurring({
      name: name.trim(), amount, frequency, day: dayNum, category: isIncome ? 'Income' : category, accountId,
      ...(frequency === 'yearly' ? { month } : {}),
    });
    if (!ok) return;
    setError(null);
    setDone(t('paymentAdded', { x: `${name.trim()} · ${money(amount)}` }));
    setName(''); setAmountStr('');
    onDone?.();
  };

  const clear = () => { setError(null); setDone(null); };

  return (
    <Card style={embedded ? { background: 'var(--color-bg)', boxShadow: 'none', backdropFilter: 'none' } : undefined}>
      <SectionHeader title={isIncome ? t('addIncome') : t('addPayment')} />
      <form onSubmit={submit} noValidate>
        <Field label={t('name')} style={{ marginBottom: 12 }}>
          <input maxLength={80} value={name} onChange={e => { setName(e.target.value); clear(); }} placeholder={isIncome ? t('incomeNamePlaceholder') : t('namePlaceholder')} style={fieldStyle} />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <Field label={t('amount')}>
            <div style={{ position: 'relative' }}>
              <input inputMode="decimal" value={amountStr} placeholder="0" onChange={e => { setAmountStr(sanitizeAmountInput(e.target.value, currency)); clear(); }}
                style={{ ...fieldStyle, fontFamily: 'var(--font-mono)', paddingRight: 30 }} />
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--font-mono)', color: 'var(--color-ink-3)' }}>
                {currencySymbol(currency)}
              </span>
            </div>
          </Field>
          <Field label={t('frequency')}>
            <select value={frequency} onChange={e => setFrequency(e.target.value as Frequency)} style={fieldStyle}>
              <option value="monthly">{t('monthly')}</option>
              <option value="yearly">{t('yearly')}</option>
            </select>
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: frequency === 'yearly' ? '1fr 1fr' : '1fr', gap: 10, marginBottom: 12 }}>
          <Field label={isIncome ? t('incomeDayLabel') : t('dayOfMonth')}>
            <input inputMode="numeric" value={day} onChange={e => { setDay(e.target.value.replace(/\D/g, '').slice(0, 2)); clear(); }} style={{ ...fieldStyle, fontFamily: 'var(--font-mono)' }} />
          </Field>
          {frequency === 'yearly' && (
            <Field label={t('month')}>
              <select value={month} onChange={e => setMonth(Number(e.target.value))} style={fieldStyle}>
                {Array.from({ length: 12 }, (_, m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
              </select>
            </Field>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isIncome ? '1fr' : '1fr 1fr', gap: 10, marginBottom: 14 }}>
          {!isIncome && (
            <Field label={t('category')}>
              <select value={category} onChange={e => setCategory(e.target.value)} style={fieldStyle}>
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{catLabel(c)}</option>)}
              </select>
            </Field>
          )}
          <Field label={isIncome ? t('incomeAccountLabel') : t('account')}>
            <select value={accountId} onChange={e => setAccountId(e.target.value as AccountType)} style={fieldStyle}>
              {ACCOUNT_IDS.map(a => <option key={a} value={a}>{accName(a)}</option>)}
            </select>
          </Field>
        </div>
        <FormMessage error={error} success={done} />
        <PrimaryButton>{t('add')}</PrimaryButton>
        <p style={{ fontSize: 11, color: 'var(--color-ink-3)', margin: '12px 0 0', lineHeight: 1.5 }}>{isIncome ? t('incomeHint') : t('recurringHint')}</p>
      </form>
    </Card>
  );
}
