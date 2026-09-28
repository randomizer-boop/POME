import { useState } from 'react';
import type { AccountType, Goal } from '../../shared/types';
import { t, goalLabel } from '../../shared/i18n';
import { currencySymbol, fmtMonthYear, parseAmount, sanitizeAmountInput } from '../../shared/format';
import { useProgressLoad } from '../../shared/hooks';
import { Card, Page, PageHeader, SectionHeader, StatusPill } from '../../shared/ui/primitives';
import { useMoney } from '../../store/Settings';
import { useFinance } from '../../store/FinanceStore';
import { useMonthSummary } from '../../store/useMonthSummary';
import { goalProgress } from './logic';
import { GoalForm } from './GoalForm';
import { AccountChips } from '../accounts/AccountChips';
import { accName } from '../accounts/labels';
import { validateTransfer } from '../accounts/logic';
import { DeleteButton } from '../../shared/ui/DeleteButton';

/** Inline "top up" + delete for one goal */
function GoalActions({ goal }: { goal: Goal }) {
  const { contributeToGoal, removeGoal, guard } = useFinance();
  const { balances } = useMonthSummary();
  const { money, currency, rate } = useMoney();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [from, setFrom] = useState<AccountType>('main');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const amount = parseAmount(value) / rate;
    if (!(amount > 0)) return;
    // money really moves into Savings, so it has to be there on the source account
    if (from !== 'savings' && validateTransfer(from, 'savings', amount, balances) === 'insufficient') {
      setError(t('errInsufficient', { acc: accName(from) }));
      return;
    }
    if (contributeToGoal(goal.id, amount, from)) { setValue(''); setError(null); setOpen(false); }
  };

  return (
    <div style={{ marginTop: 'auto', paddingTop: 12 }}>
      {open && (
        <div className="view-enter" style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--color-ink-3)', marginBottom: 6 }}>{t('topUpFrom')}</div>
          <AccountChips label={t('topUpFrom')} value={from} onChange={a => { setFrom(a); setError(null); }} sub={a => money(balances[a], { maxFrac: 0 })} />
          <div style={{ fontSize: 11, color: error ? 'var(--color-negative)' : 'var(--color-ink-3)', marginTop: 6, lineHeight: 1.4 }}>
            {error ?? (from === 'savings' ? t('topUpFromSavingsHint') : t('topUpTransferHint'))}
          </div>
        </div>
      )}
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {open ? (
        <form onSubmit={e => { e.preventDefault(); submit(); }} style={{ display: 'flex', gap: 6, flex: 1 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input autoFocus inputMode="decimal" value={value} placeholder="0" onChange={e => setValue(sanitizeAmountInput(e.target.value, currency))}
              onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }}
              style={{ width: '100%', height: 32, border: '1px solid var(--line-strong)', borderRadius: 8, padding: '0 26px 0 10px', fontFamily: 'var(--font-mono)', fontSize: 13, background: 'var(--color-card)' }} />
            <span style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--color-ink-3)', fontFamily: 'var(--font-mono)' }}>{currencySymbol(currency)}</span>
          </div>
          <button type="submit" className="link-btn">{t('add')}</button>
          <button type="button" className="link-btn" onClick={() => { setOpen(false); setError(null); }}>✕</button>
        </form>
      ) : (
        <button className="link-btn" onClick={() => { if (!guard()) setOpen(true); }} style={{ flex: 1 }}>+ {t('topUp')}</button>
      )}
      {!open && <DeleteButton onConfirm={() => removeGoal(goal.id)} label={t('deleteGoal')} />}
    </div>
    </div>
  );
}

function Ring({ pct, loaded }: { pct: number; loaded: boolean }) {
  const r = 30, c = 2 * Math.PI * r;
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true">
      <circle cx="38" cy="38" r={r} fill="none" stroke="var(--color-surface)" strokeWidth="7" />
      <circle cx="38" cy="38" r={r} fill="none" stroke="var(--color-ink)" strokeWidth="7" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={loaded ? c * (1 - pct / 100) : c} transform="rotate(-90 38 38)"
        style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.4,0,0.2,1)' }} />
      <text x="38" y="43" textAnchor="middle" fontSize="14" fill="var(--color-ink)" fontFamily="DM Mono, monospace">{Math.round(pct)}%</text>
    </svg>
  );
}

export function GoalsPage() {
  const { period, goals } = useFinance();
  const { goalsPlanned, goalsSaved } = useMonthSummary();
  const { money } = useMoney();
  const loaded = useProgressLoad();
  const m0 = (v: number) => money(v, { maxFrac: 0 });
  const totalSaved = goalsSaved;
  const [formOpen, setFormOpen] = useState(false);
  const { guard } = useFinance();
  const openForm = () => { if (!guard()) setFormOpen(true); };

  return (
    <Page>
      <PageHeader eyebrow={t('progress')} title={t('savingsGoals')}>
        <div style={{ fontSize: 14, color: 'var(--color-ink-2)' }}>
          {t('savedAcross', { x: m0(totalSaved), n: goals.length, y: m0(goalsPlanned) })}
        </div>
        {!formOpen && <button className="link-btn" onClick={openForm} style={{ marginTop: 12 }}>+ {t('newGoalBtn')}</button>}
      </PageHeader>

      {formOpen && (
        <Card style={{ marginBottom: 16, maxWidth: 560 }} className="view-enter">
          <SectionHeader title={t('newGoal')} right={<button className="link-btn" onClick={() => setFormOpen(false)}>{t('close')}</button>} />
          <GoalForm onDone={() => setFormOpen(false)} />
        </Card>
      )}

      {goals.length === 0 && !formOpen && (
        <div style={{ padding: '36px 0', textAlign: 'center', fontSize: 14, color: 'var(--color-ink-3)' }}>
          <div style={{ marginBottom: 12 }}>{t('emptyGoals')}</div>
          <button className="link-btn" onClick={openForm}>+ {t('newGoalBtn')}</button>
        </div>
      )}
      <div className="m-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {goals.map((goal, i) => {
          const g = goalProgress(goal, period);
          return (
            <Card key={goal.id} className="lift reveal-on-hover" style={{ display: 'flex', flexDirection: 'column' }}>
              <SectionHeader title={t('goalN', { n: String(i + 1).padStart(2, '0') })} right={<StatusPill tone={g.remaining === 0 || g.onTrack ? 'ok' : 'warn'}>{g.remaining === 0 ? t('goalReached') : g.onTrack ? t('onTrack') : t('behind')}</StatusPill>} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 22, fontWeight: 500, lineHeight: 1.15 }}>{goalLabel(goal.name)}</div>
                  <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--color-ink-2)', marginTop: 6 }}>{m0(goal.saved)} / {m0(goal.target)}</div>
                </div>
                <Ring pct={g.pct} loaded={loaded} />
              </div>
              {[
                { label: t('remaining'),    val: m0(g.remaining) },
                { label: t('deadline'),     val: `${fmtMonthYear(new Date(goal.deadline))} · ${t('monthsShort', { n: g.months })}` },
                { label: t('needsMonth'),   val: m0(g.neededPerMonth) },
                { label: t('contributing'), val: `${m0(goal.monthlyContribution)}${t('perMo')}`, color: g.onTrack ? 'var(--color-positive)' : 'var(--color-negative)' },
              ].map((row, j) => (
                <div key={j} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, padding: '7px 0', borderTop: '1px solid var(--color-border-light)' }}>
                  <span style={{ color: 'var(--color-ink-3)' }}>{row.label}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, color: row.color ?? 'var(--color-ink)', textAlign: 'right' }}>{row.val}</span>
                </div>
              ))}
              {!g.onTrack && g.remaining > 0 && <div style={{ fontSize: 12, color: 'var(--color-ink-2)', marginTop: 8 }}>{t('addToHit', { x: m0(Math.abs(g.gap)) })}</div>}
              <GoalActions goal={goal} />
            </Card>
          );
        })}
      </div>
    </Page>
  );
}
