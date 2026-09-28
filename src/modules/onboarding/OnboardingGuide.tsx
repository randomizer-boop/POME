import { useEffect, useState } from 'react';
import type { View } from '../../shared/types';
import { t } from '../../shared/i18n';
import { Card } from '../../shared/ui/primitives';
import { useFinance } from '../../store/FinanceStore';
import { useSession } from '../../store/Session';
import { openQuickAdd } from '../transactions/QuickAdd';
import { STEPS, nextStep, stepsDone, type StepId } from './logic';

// Hidden per user; "How to start" in the account menu brings it back
const key = (userId: string) => `pome.guide.hidden.${userId}`;
const SHOW_EVENT = 'pome:show-guide';
const readHidden = (userId: string) => { try { return localStorage.getItem(key(userId)) === '1'; } catch { return false; } };

export function showGuide(userId: string) {
  try { localStorage.removeItem(key(userId)); } catch { /* ignore */ }
  window.dispatchEvent(new Event(SHOW_EVENT));
}

const ACTION: Record<StepId, { kind: 'add-income' | 'add-expense' } | { view: View }> = {
  balances: { view: 'accounts' },
  income: { kind: 'add-income' },
  recurring: { view: 'recurring' },
  budget: { view: 'budget' },
  goal: { view: 'goals' },
  expense: { kind: 'add-expense' },
};

/** "First steps" checklist on the overview for new accounts. Steps tick themselves off from real data. */
export function OnboardingGuide({ onNav }: { onNav?: (v: View) => void }) {
  const { status, user } = useSession();
  const { accounts, allTransactions, recurring, allocations, goals } = useFinance();
  const userId = user?.id ?? '';
  const [hidden, setHidden] = useState(() => readHidden(userId));

  useEffect(() => {
    const onShow = () => setHidden(false);
    window.addEventListener(SHOW_EVENT, onShow);
    return () => window.removeEventListener(SHOW_EVENT, onShow);
  }, []);

  if (status !== 'user' || hidden) return null;

  const done = stepsDone({ accounts, transactions: allTransactions, recurring, allocations, goals });
  const next = nextStep(done);
  const count = STEPS.filter(s => done[s]).length;

  const hide = () => { try { localStorage.setItem(key(userId), '1'); } catch { /* ignore */ } setHidden(true); };
  const run = (s: StepId) => {
    const a = ACTION[s];
    if ('kind' in a) openQuickAdd(a.kind === 'add-income' ? 'income' : 'expense');
    else onNav?.(a.view);
  };

  return (
    <Card style={{ marginBottom: 16, padding: '20px 24px' }} className="view-enter card-pad">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 24, fontWeight: 500, lineHeight: 1.15 }}>
            {next ? t('guideTitle') : t('guideDoneTitle')}
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-ink-2)', marginTop: 4 }}>{next ? t('guideSub') : t('guideDoneSub')}</div>
        </div>
        <button className="link-btn" onClick={hide} style={{ flexShrink: 0 }}>{t('guideHide')}</button>
      </div>

      {/* progress */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 6px' }}>
        <div style={{ flex: 1, display: 'flex', gap: 4 }}>
          {STEPS.map(s => (
            <span key={s} style={{ flex: 1, height: 5, borderRadius: 3, background: done[s] ? 'var(--color-brand)' : 'var(--color-surface)', transition: 'background 0.3s ease' }} />
          ))}
        </div>
        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--color-ink-2)', whiteSpace: 'nowrap' }}>{t('guideProgress', { a: count, b: STEPS.length })}</span>
      </div>

      {/* steps */}
      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {STEPS.map((s, i) => {
          const isDone = done[s], isNext = s === next;
          return (
            <li key={s} className="guide-step" style={{
              display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr) auto', gap: 12, alignItems: 'center',
              padding: '10px 10px', margin: '0 -10px', borderRadius: 10,
              background: isNext ? 'var(--color-accent-soft)' : 'transparent',
              borderTop: i && !isNext && STEPS[i - 1] !== next ? '1px solid var(--color-border-light)' : '1px solid transparent',
            }}>
              <span aria-hidden="true" style={{
                width: 26, height: 26, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 500,
                background: isDone ? 'var(--color-brand)' : 'var(--color-card)', color: isDone ? '#fff' : isNext ? 'var(--color-brand)' : 'var(--color-ink-3)',
                border: isDone ? 'none' : `1.5px solid ${isNext ? 'var(--color-brand)' : 'var(--line-strong)'}`,
              }}>{isDone ? '✓' : i + 1}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: isNext ? 500 : 400, color: isDone ? 'var(--color-ink-3)' : 'var(--color-ink)', textDecoration: isDone ? 'line-through' : 'none' }}>
                  {t(`guide.${s}.title` as const)}
                </div>
                {!isDone && <div style={{ fontSize: 12, color: 'var(--color-ink-2)', marginTop: 2, lineHeight: 1.45 }}>{t(`guide.${s}.hint` as const)}</div>}
              </div>
              {!isDone && (
                <button onClick={() => run(s)} className={isNext ? undefined : 'link-btn'} style={isNext ? {
                  border: 'none', background: 'var(--color-ink)', color: '#fff', borderRadius: 20, padding: '7px 14px',
                  fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
                } : { whiteSpace: 'nowrap' }}>
                  {t(`guide.${s}.cta` as const)}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
