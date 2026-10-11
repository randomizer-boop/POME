import { useState, type FormEvent, type ReactNode } from 'react';
import { t } from '../../shared/i18n';
import { currencySymbol, parseAmount, sanitizeAmountInput } from '../../shared/format';
import { Field, FormMessage, PrimaryButton, fieldStyle } from '../../shared/ui/primitives';
import { useMoney } from '../../store/Settings';
import { useFinance } from '../../store/FinanceStore';
import { monthToDeadline, validateGoal } from './logic';

const pad = (n: number) => String(n).padStart(2, '0');

/** Add a savings goal. Amounts are typed in the display currency and stored in base (USD). */
export function GoalForm({ onDone }: { onDone?: () => void }) {
  const { period, addGoal } = useFinance();
  const { money, currency, rate } = useMoney();
  const minMonth = `${period.year}-${pad(period.index + 1)}`;
  const inAYear = `${period.year + 1}-${pad(period.index + 1)}`;

  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [saved, setSaved] = useState('');
  const [monthly, setMonthly] = useState('');
  const [month, setMonth] = useState(inAYear);
  const [error, setError] = useState<string | null>(null);

  const toBase = (s: string) => (s.trim() ? parseAmount(s) / rate : 0);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const tgt = target.trim() ? toBase(target) : NaN;
    const sv = toBase(saved);
    const err = validateGoal(name, tgt, sv, month, period);
    if (err) {
      setError({ name: t('errName'), target: t('errTarget'), saved: t('errSaved'), deadline: t('errDeadline') }[err]);
      return;
    }
    const ok = addGoal({ name: name.trim(), target: tgt, saved: sv, deadline: monthToDeadline(month), monthlyContribution: toBase(monthly) });
    if (!ok) return;
    setError(null);
    onDone?.();
  };

  const amount = (value: string, set: (v: string) => void): ReactNode => (
    <div style={{ position: 'relative' }}>
      <input inputMode="decimal" value={value} placeholder="0" onChange={e => { set(sanitizeAmountInput(e.target.value, currency)); setError(null); }}
        style={{ ...fieldStyle, fontFamily: 'var(--font-mono)', paddingRight: 30 }} />
      <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--font-mono)', color: 'var(--color-ink-3)' }}>
        {currencySymbol(currency)}
      </span>
    </div>
  );

  // hint: how much per month the goal needs with the chosen date
  const tgt = toBase(target), sv = toBase(saved);
  const [y, m] = month.split('-').map(Number);
  const months = Math.max(1, (y * 12 + m - 1) - (period.year * 12 + period.index));
  const need = tgt > sv ? (tgt - sv) / months : 0;

  return (
    <form onSubmit={submit} noValidate>
      <Field label={t('name')} style={{ marginBottom: 12 }}>
        <input maxLength={80} value={name} onChange={e => { setName(e.target.value); setError(null); }} placeholder={t('goalNamePh')} style={fieldStyle} autoFocus />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <Field label={t('targetAmount')}>{amount(target, setTarget)}</Field>
        <Field label={t('alreadySaved')}>{amount(saved, setSaved)}</Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
        <Field label={t('targetDate')}>
          <input type="month" min={minMonth} value={month} onChange={e => { setMonth(e.target.value); setError(null); }} style={fieldStyle} />
        </Field>
        <Field label={t('monthlyPlan')}>{amount(monthly, setMonthly)}</Field>
      </div>
      <div style={{ fontSize: 12, color: 'var(--color-ink-3)', minHeight: 18, marginBottom: 10 }}>
        {need > 0 && <>{t('needsMonth')}: <b style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--color-ink-2)' }}>{money(need, { maxFrac: 0 })}</b></>}
      </div>
      <FormMessage error={error} />
      <PrimaryButton>{t('add')}</PrimaryButton>
    </form>
  );
}
