import { useState } from 'react';
import type { View } from '../../shared/types';
import { t } from '../../shared/i18n';
import { isoDay } from '../../shared/config';
import { useFinance } from '../../store/FinanceStore';
import { useSession } from '../../store/Session';
import { needsReconcile } from './logic';

const key = (uid: string) => `pome.reconciled.${uid}`;
const read = (uid: string) => { try { return localStorage.getItem(key(uid)); } catch { return null; } };

/** Remember "balances checked today" (also called after ✎ on an account) */
export function markReconciled(uid: string, todayIso: string) {
  try { localStorage.setItem(key(uid), todayIso); } catch { /* ignore */ }
}

/** Weekly nudge on the overview: compare balances with the bank */
export function ReconcileReminder({ onNav }: { onNav?: (v: View) => void }) {
  const { status, user } = useSession();
  const { today, allTransactions } = useFinance();
  const todayIso = isoDay(today, today.current);
  const uid = user?.id ?? '';
  const [last, setLast] = useState(() => {
    const v = read(uid);
    if (!v && uid) markReconciled(uid, todayIso);      // first visit: start the clock
    return v ?? todayIso;
  });

  if (status !== 'user' || !needsReconcile(last, todayIso, allTransactions.length > 0)) return null;
  const done = () => { markReconciled(uid, todayIso); setLast(todayIso); };

  return (
    <div className="view-enter" style={{
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16, padding: '12px 16px',
      borderRadius: 14, border: '1px solid var(--line-strong)', background: 'var(--color-card)', fontSize: 13,
    }}>
      <span style={{ flex: 1, minWidth: 200, color: 'var(--color-ink-2)' }}>{t('reconcileText')}</span>
      <button className="link-btn" onClick={() => { done(); onNav?.('accounts'); }}>{t('reconcileCheck')}</button>
      <button className="link-btn" onClick={done} style={{ background: 'transparent' }}>{t('reconcileOk')}</button>
    </div>
  );
}
