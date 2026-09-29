import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { AccountType, View } from '../../shared/types';
import { t, catLabel, descLabel } from '../../shared/i18n';
import { currencySymbol, parseAmount, sanitizeAmountInput } from '../../shared/format';
import { isoDay } from '../../shared/config';
import { EXPENSE_CATEGORIES } from '../../shared/categories';
import { Deer } from '../../shared/ui/Deer';
import { Field, fieldStyle } from '../../shared/ui/primitives';
import { useFinance } from '../../store/FinanceStore';
import { useMoney } from '../../store/Settings';
import { useSession } from '../../store/Session';
import { useMonthSummary } from '../../store/useMonthSummary';
import { accName } from '../accounts/labels';
import { AccountChips } from '../accounts/AccountChips';
import { isBillRule, isIncomeRule } from '../recurring/logic';
import { SavingsRatePicker } from '../safe-to-spend/SavingsRatePicker';
import { OPTIONAL, STEPS, alreadyDue, nextStep, stepsDone, type StepId } from './logic';

// Setup wizard over the overview (full screen, one question at a time).
// "Don't show again" is stored per user; "How to start" in the account menu brings it back.
// "Later" hides it until the app is opened again. Confirmed/skipped steps are stored per user.
const key = (userId: string) => `pome.guide.hidden.${userId}`;
const confirmedKey = (userId: string) => `pome.setup.${userId}`;
const SHOW_EVENT = 'pome:show-guide';
const readHidden = (userId: string) => { try { return localStorage.getItem(key(userId)) === '1'; } catch { return false; } };
const readConfirmed = (userId: string): StepId[] => {
  try { const v = JSON.parse(localStorage.getItem(confirmedKey(userId)) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
};
let laterThisSession = false;

export function showGuide(userId: string) {
  try { localStorage.removeItem(key(userId)); } catch { /* ignore */ }
  laterThisSession = false;
  window.dispatchEvent(new Event(SHOW_EVENT));
}

const PAGE: Partial<Record<StepId, View>> = { budget: 'budget', goal: 'goals' };

export function OnboardingGuide({ onNav }: { onNav?: (v: View) => void }) {
  const { status, user } = useSession();
  const { accounts, allTransactions, recurring, allocations, goals, savingsChosen, savingsRate, setSavingsRate } = useFinance();
  const userId = user?.id ?? '';
  const [hidden, setHidden] = useState(() => readHidden(userId) || laterThisSession);
  const [confirmed, setConfirmed] = useState<StepId[]>(() => readConfirmed(userId));

  const done = stepsDone({ accounts, transactions: allTransactions, recurring, allocations, goals, savingsChosen, confirmed });
  const [step, setStep] = useState<StepId | 'done'>(() => nextStep(done) ?? 'done');
  // Until the user navigates by hand, follow the data: some of it (e.g. the savings %) loads a moment
  // after the rest, and a step that turns out to be done must not stay on screen.
  const [touched, setTouched] = useState(false);
  const auto = nextStep(done) ?? 'done';
  useEffect(() => { if (!touched && step !== 'done' && done[step]) setStep(auto); }, [touched, step, auto, done]);

  useEffect(() => {
    const onShow = () => { setHidden(false); setStep(nextStep(done) ?? 'done'); };
    window.addEventListener(SHOW_EVENT, onShow);
    return () => window.removeEventListener(SHOW_EVENT, onShow);
  });

  const visible = status === 'user' && !hidden;
  // the page behind must not scroll while the overlay is open
  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [visible]);

  if (!visible) return null;

  const confirm = (s: StepId) => {
    const next = confirmed.includes(s) ? confirmed : [...confirmed, s];
    setConfirmed(next);
    try { localStorage.setItem(confirmedKey(userId), JSON.stringify(next)); } catch { /* ignore */ }
  };
  const index = step === 'done' ? STEPS.length : STEPS.indexOf(step);
  const goNext = (s: StepId) => { confirm(s); setStep(STEPS[STEPS.indexOf(s) + 1] ?? 'done'); };
  const goBack = () => { if (index > 0) { setTouched(true); setStep(STEPS[index - 1]); } };
  const hideForever = () => { try { localStorage.setItem(key(userId), '1'); } catch { /* ignore */ } setHidden(true); };
  const later = () => { laterThisSession = true; setHidden(true); };

  const body = (() => {
    switch (step) {
      case 'savings': return (
        <StepFrame s="savings" index={index} onBack={goBack} onNext={() => { if (!savingsChosen) setSavingsRate(savingsRate); goNext('savings'); }}>
          <SavingsRatePicker />
        </StepFrame>
      );
      case 'income': return <IncomeStep index={index} onBack={goBack} onNext={() => goNext('income')} onSkip={() => goNext('income')} />;
      case 'bills': return <BillsStep index={index} onBack={goBack} onNext={() => goNext('bills')} onSkip={() => goNext('bills')} />;
      case 'balances': return <BalancesStep index={index} onBack={goBack} onNext={() => goNext('balances')} />;
      case 'budget':
      case 'goal': {
        const s = step;
        return (
          <StepFrame s={s} index={index} onBack={goBack} onSkip={() => goNext(s)} skipLabel={t('wizLater')}
            onNext={done[s] ? () => goNext(s) : undefined}
            extra={!done[s] && (
              <button onClick={() => onNav?.(PAGE[s]!)} style={primaryBtn}>{t(`guide.${s}.cta` as const)}</button>
            )}>
            {done[s] && <div style={{ fontSize: 13, color: 'var(--color-positive)' }}>✓ {t('wizAlreadySet')}</div>}
          </StepFrame>
        );
      }
      default: return (
        <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><Deer pose="front" size={150} /></div>
          <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 30, fontWeight: 500 }}>{t('guideDoneTitle')}</div>
          <p style={{ fontSize: 14, color: 'var(--color-ink-2)', lineHeight: 1.55, margin: '8px auto 20px', maxWidth: 420 }}>{t('guideDoneSub')}</p>
          <button onClick={hideForever} style={{ ...primaryBtn, padding: '11px 24px', fontSize: 14 }}>{t('guideStart')}</button>
        </div>
      );
    }
  })();

  // portal: rendered on <body>, above the header, sidebar and everything else
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={t('guideTitle')} className="view-enter" style={{
      position: 'fixed', inset: 0, zIndex: 48, background: 'var(--color-bg)', overflowY: 'auto',
      display: 'flex', justifyContent: 'center', padding: 'max(24px, env(safe-area-inset-top)) 16px 32px',
    }}>
      <div style={{ width: '100%', maxWidth: 560, margin: 'auto 0' }}>
        {step !== 'done' && (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <Deer pose="front" size={78} />
                <div>
                  <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-brand)', fontWeight: 500 }}>POME</div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 30, fontWeight: 500, lineHeight: 1.1, marginTop: 2 }}>{t('guideTitle')}</div>
                  <div style={{ fontSize: 13, color: 'var(--color-ink-2)', marginTop: 4, lineHeight: 1.45 }}>{t('guideSub')}</div>
                </div>
              </div>
              <button className="link-btn" onClick={later} style={{ flexShrink: 0 }}>{t('guideLater')}</button>
            </div>
            {/* progress */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0 10px' }}>
              <div style={{ flex: 1, display: 'flex', gap: 4 }}>
                {STEPS.map((s, i) => (
                  <button key={s} onClick={() => { setTouched(true); setStep(s); }} aria-label={t(`guide.${s}.title` as const)} title={t(`guide.${s}.title` as const)} style={{
                    flex: 1, height: 5, borderRadius: 3, border: 'none', padding: 0, cursor: 'pointer',
                    background: i === index ? 'var(--color-ink)' : done[s] ? 'var(--color-brand)' : 'var(--color-surface)', transition: 'background 0.3s ease',
                  }} />
                ))}
              </div>
              <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--color-ink-2)', whiteSpace: 'nowrap' }}>{t('wizStep', { a: index + 1, b: STEPS.length })}</span>
            </div>
          </>
        )}

        <div key={step} className="view-enter" style={{ background: 'var(--color-card)', border: '1px solid var(--line)', borderRadius: 16, padding: '22px 22px 18px' }}>
          {body}
        </div>

        {step !== 'done' && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
            <button onClick={hideForever} style={{ border: 'none', background: 'none', color: 'var(--color-ink-3)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>{t('guideNever')}</button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ─── building blocks ──────────────────────────────────────────────────────────

const primaryBtn = {
  border: 'none', background: 'var(--color-ink)', color: '#fff', borderRadius: 20, padding: '9px 18px',
  fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
} as const;
const ghostBtn = { border: 'none', background: 'none', padding: '9px 6px', fontSize: 13, color: 'var(--color-ink-2)', cursor: 'pointer' } as const;

function StepFrame({ s, index, children, onBack, onNext, onSkip, skipLabel, nextLabel, extra }: {
  s: StepId; index: number; children?: ReactNode; onBack: () => void; onNext?: () => void; onSkip?: () => void;
  skipLabel?: string; nextLabel?: string; extra?: ReactNode;
}) {
  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 500 }}>{t(`guide.${s}.title` as const)}</div>
      <div style={{ fontSize: 13, color: 'var(--color-ink-2)', marginTop: 4, lineHeight: 1.5 }}>{t(`guide.${s}.hint` as const)}</div>
      <div style={{ marginTop: 16 }}>{children}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
        {index > 0 && <button onClick={onBack} style={ghostBtn}>← {t('wizBack')}</button>}
        <span style={{ flex: 1 }} />
        {onSkip && OPTIONAL.includes(s) && <button onClick={onSkip} style={ghostBtn}>{skipLabel ?? t('wizSkip')}</button>}
        {extra}
        {onNext && <button onClick={onNext} style={primaryBtn}>{nextLabel ?? t('wizNext')} →</button>}
      </div>
    </div>
  );
}

function AmountInput({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  const { currency } = useMoney();
  return (
    <div style={{ position: 'relative' }}>
      <input autoFocus={autoFocus} inputMode="decimal" value={value} placeholder="0" onChange={e => onChange(sanitizeAmountInput(e.target.value, currency))}
        style={{ ...fieldStyle, fontFamily: 'var(--font-mono)', paddingRight: 30 }} />
      <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--font-mono)', color: 'var(--color-ink-3)' }}>{currencySymbol(currency)}</span>
    </div>
  );
}

const dayInput = (v: string, set: (v: string) => void) => (
  <input inputMode="numeric" value={v} onChange={e => set(e.target.value.replace(/\D/g, '').slice(0, 2))} style={{ ...fieldStyle, fontFamily: 'var(--font-mono)' }} />
);

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: 'var(--color-ink)', cursor: 'pointer', lineHeight: 1.45 }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ marginTop: 2, accentColor: 'var(--color-brand)' }} />
      <span>{children}</span>
    </label>
  );
}

const Saved = ({ children }: { children: ReactNode }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, padding: '8px 0', borderTop: '1px solid var(--color-border-light)' }}>{children}</div>
);

// ─── step: salary ─────────────────────────────────────────────────────────────

function IncomeStep({ index, onBack, onNext, onSkip }: { index: number; onBack: () => void; onNext: () => void; onSkip: () => void }) {
  const { recurring, today, addRecurring, addTransactionKeepBalance } = useFinance();
  const { money, rate } = useMoney();
  const existing = recurring.filter(isIncomeRule);
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState('');
  const [account, setAccount] = useState<AccountType>('main');
  const [arrived, setArrived] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dayNum = Number(day);
  const due = dayNum >= 1 && alreadyDue(dayNum, today.current);

  const save = () => {
    if (!amount && existing.length) return onNext();
    const base = parseAmount(amount) / rate;
    if (!(base > 0)) return setError(t('errAmount'));
    if (!(dayNum >= 1 && dayNum <= 31)) return setError(t('errDay'));
    const name = t('salaryDefaultName');
    const id = addRecurring({ name, amount: base, frequency: 'monthly', day: dayNum, category: 'Income', accountId: account });
    if (!id) return;
    // salary that has already come is in the balance the user will type next — record it without adding it again
    if (due && arrived) {
      addTransactionKeepBalance({ date: isoDay(today, Math.min(dayNum, today.total)), description: name, category: 'Income', amount: base, accountId: account, recurringId: id });
    }
    onNext();
  };

  return (
    <StepFrame s="income" index={index} onBack={onBack} onNext={save} onSkip={onSkip} skipLabel={t('noSalary')}>
      {existing.map(r => (
        <Saved key={r.id}><span>✓ {descLabel(r.name)} · {t('incomeEvery', { d: r.day })} · {accName(r.accountId)}</span><b style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{money(r.amount, { maxFrac: 0 })}</b></Saved>
      ))}
      {existing.length > 0 && <div style={{ fontSize: 12, color: 'var(--color-ink-3)', margin: '8px 0 10px' }}>{t('wizAddAnother')}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 10, marginBottom: 12 }}>
        <Field label={t('salaryAmount')}><AmountInput value={amount} onChange={v => { setAmount(v); setError(null); }} autoFocus={!existing.length} /></Field>
        <Field label={t('incomeDayLabel')}>{dayInput(day, v => { setDay(v); setError(null); })}</Field>
      </div>
      <AccountChips label={t('incomeAccountLabel')} value={account} onChange={setAccount} />
      {due && (
        <div style={{ marginTop: 12 }}>
          <Check checked={arrived} onChange={setArrived}>{t('salaryArrived')}</Check>
        </div>
      )}
      {error && <div style={{ fontSize: 12, color: 'var(--color-negative)', marginTop: 8 }}>{error}</div>}
    </StepFrame>
  );
}

// ─── step: fixed payments ─────────────────────────────────────────────────────

function BillsStep({ index, onBack, onNext, onSkip }: { index: number; onBack: () => void; onNext: () => void; onSkip: () => void }) {
  const { recurring, today, addRecurring, addTransactionKeepBalance } = useFinance();
  const { money, rate } = useMoney();
  const bills = recurring.filter(isBillRule);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState('');
  const [category, setCategory] = useState('Housing');
  const [paid, setPaid] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dayNum = Number(day);
  const due = dayNum >= 1 && alreadyDue(dayNum, today.current);
  const filled = name.trim() !== '' || amount !== '';

  const add = (): boolean => {
    const base = parseAmount(amount) / rate;
    if (!name.trim()) { setError(t('errName')); return false; }
    if (!(base > 0)) { setError(t('errAmount')); return false; }
    if (!(dayNum >= 1 && dayNum <= 31)) { setError(t('errDay')); return false; }
    const id = addRecurring({ name: name.trim(), amount: base, frequency: 'monthly', day: dayNum, category, accountId: 'main' });
    if (!id) return false;
    // already paid this month → it's already out of the balance; record it without taking it again
    if (due && paid) {
      addTransactionKeepBalance({ date: isoDay(today, Math.min(dayNum, today.total)), description: name.trim(), category, amount: -base, accountId: 'main', recurringId: id });
    }
    setName(''); setAmount(''); setDay(''); setError(null); setPaid(true);
    return true;
  };

  return (
    <StepFrame s="bills" index={index} onBack={onBack} onSkip={onSkip} skipLabel={t('noBills')}
      onNext={() => { if (!filled || add()) onNext(); }}>
      {bills.map(r => (
        <Saved key={r.id}><span>✓ {descLabel(r.name)} · {t('dueEvery', { d: r.day })}</span><b style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{money(r.amount, { maxFrac: 0 })}</b></Saved>
      ))}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 10, margin: bills.length ? '12px 0' : '0 0 12px' }}>
        <Field label={t('name')}><input value={name} onChange={e => { setName(e.target.value); setError(null); }} placeholder={t('billPlaceholder')} style={fieldStyle} autoFocus /></Field>
        <Field label={t('category')}>
          <select value={category} onChange={e => setCategory(e.target.value)} style={fieldStyle}>
            {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{catLabel(c)}</option>)}
          </select>
        </Field>
        <Field label={t('amount')}><AmountInput value={amount} onChange={v => { setAmount(v); setError(null); }} /></Field>
        <Field label={t('dayOfMonth')}>{dayInput(day, v => { setDay(v); setError(null); })}</Field>
      </div>
      {due && <Check checked={paid} onChange={setPaid}>{t('billPaidAlready')}</Check>}
      {error && <div style={{ fontSize: 12, color: 'var(--color-negative)', marginTop: 8 }}>{error}</div>}
      <button onClick={add} className="link-btn" style={{ marginTop: 12 }}>+ {t('wizAddBill')}</button>
    </StepFrame>
  );
}

// ─── step: balances right now ─────────────────────────────────────────────────

function BalancesStep({ index, onBack, onNext }: { index: number; onBack: () => void; onNext: () => void }) {
  const { setAccountBalance } = useFinance();
  const { balances } = useMonthSummary();
  const { currency, rate } = useMoney();
  const ids: AccountType[] = ['main', 'cash', 'savings'];
  const [values, setValues] = useState<Record<AccountType, string>>(() => Object.fromEntries(
    ids.map(id => [id, balances[id] ? sanitizeAmountInput(String(Math.round(balances[id] * rate)), currency) : '']),
  ) as Record<AccountType, string>);

  const save = () => {
    for (const id of ids) {
      const typed = values[id] === '' ? 0 : parseAmount(values[id]);
      if (!Number.isFinite(typed)) continue;
      if (Math.round(typed) !== Math.round(balances[id] * rate)) setAccountBalance(id, typed / rate);
    }
    onNext();
  };

  return (
    <StepFrame s="balances" index={index} onBack={onBack} onNext={save}>
      <div style={{ display: 'grid', gap: 10 }}>
        {ids.map(id => (
          <Field key={id} label={accName(id)}>
            <AmountInput value={values[id]} onChange={v => setValues(s => ({ ...s, [id]: v }))} autoFocus={id === 'main'} />
          </Field>
        ))}
      </div>
    </StepFrame>
  );
}
