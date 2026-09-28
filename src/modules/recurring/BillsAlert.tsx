import { useState } from 'react';
import { t, descLabel, paymentsWord } from '../../shared/i18n';
import { useMoney } from '../../store/Settings';
import { useFinance } from '../../store/FinanceStore';
import { useMonthSummary } from '../../store/useMonthSummary';
import { daysToCharge, likelyPayment, urgentBills } from './logic';
import { sumBy } from '../../shared/money';
import { dueLabel } from './dueLabel';

const BellIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 11V7a4 4 0 0 1 8 0v4l1.2 1.5H2.8L4 11zM6.5 14a1.6 1.6 0 0 0 3 0" />
  </svg>
);

// Dismissed for the rest of the day (per set of bills), survives page switches
const dismissKey = (ids: string[], day: number) => `pome.bills.${day}.${ids.join(',')}`;
const isDismissed = (k: string) => { try { return sessionStorage.getItem(k) === '1'; } catch { return false; } };

/** Banner for bills that are overdue or due in the next few days, with a one-click "Pay" */
export function BillsAlert({ onOpenAll }: { onOpenAll?: () => void }) {
  const { period, payRecurring, linkPayment, transactions } = useFinance();
  const { unpaid } = useMonthSummary();
  const { money } = useMoney();
  const bills = urgentBills(unpaid, period);
  const key = dismissKey(bills.map(b => b.id), period.current);
  const [hidden, setHidden] = useState(() => isDismissed(key));

  if (bills.length === 0 || hidden) return null;
  const total = sumBy(bills, b => b.amount);
  const anyOverdue = bills.some(b => daysToCharge(b, period) < 0);
  const tone = anyOverdue ? 'var(--color-negative)' : 'var(--color-brand)';

  const dismiss = () => { try { sessionStorage.setItem(key, '1'); } catch { /* ignore */ } setHidden(true); };

  return (
    <div role="status" className="view-enter" style={{
      marginBottom: 16, borderRadius: 14, border: '1px solid var(--line-strong)', borderLeft: `3px solid ${tone}`,
      background: 'var(--color-card)', padding: '12px 16px 10px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: tone, display: 'inline-flex' }}><BellIcon /></span>
        <span style={{ fontSize: 14, fontWeight: 500, flex: 1 }}>
          {t('billsAlert', { n: bills.length, payments: paymentsWord(bills.length) })}
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 400, color: 'var(--color-ink-2)', marginLeft: 8 }}>{money(total)}</span>
        </span>
        {onOpenAll && <button className="link-btn" onClick={onOpenAll}>{t('billsAlertAll')}</button>}
        <button onClick={dismiss} aria-label={t('close')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-ink-3)', fontSize: 13 }}>✕</button>
      </div>
      <div style={{ marginTop: 8 }}>
        {bills.map(b => {
          const d = daysToCharge(b, period);
          return (
            <div key={b.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 14, alignItems: 'center', padding: '6px 0 6px 26px', borderTop: '1px solid var(--color-border-light)', fontSize: 13 }}>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {descLabel(b.name)}
                <span style={{ marginLeft: 8, fontSize: 12, color: d < 0 ? 'var(--color-negative)' : 'var(--color-ink-3)' }}>{dueLabel(d)}</span>
              </span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{money(b.amount)}</span>
              {(() => {
                const match = likelyPayment(b, transactions);
                return match
                  ? <button className="link-btn" title={t('looksPaid')} onClick={() => linkPayment(b.id, match.id)}>{t('alreadyPaid')} ✓</button>
                  : <button className="link-btn" onClick={() => payRecurring(b.id)}>{t('payNow')}</button>;
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}
