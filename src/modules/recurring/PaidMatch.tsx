import type { RecurringPayment, Transaction } from '../../shared/types';
import { t, descLabel } from '../../shared/i18n';
import { fmtDate } from '../../shared/format';
import { useMoney } from '../../store/Settings';
import { useFinance } from '../../store/FinanceStore';
import { isIncomeRule, likelyPayment, paymentCandidates } from './logic';
import { isoDay } from '../../shared/config';

/**
 * Under a due payment: either a one-click suggestion ("looks like it's already paid: Rent, 1 Sep")
 * or, when the user pressed "Already paid", a list of this month's expenses to pick from.
 * Linking marks the bill paid without creating a second expense.
 */
export function PaidMatch({ r, txs, picking, onClose }: { r: RecurringPayment; txs: Transaction[]; picking: boolean; onClose: () => void }) {
  const { linkPayment, addTransactionKeepBalance, period } = useFinance();
  // paid (or received) outside the app and already reflected in the balance: record it without moving money again
  const markInBalance = () => {
    const ok = addTransactionKeepBalance({
      date: isoDay(period, Math.min(r.day, period.current)), description: r.name, category: r.category,
      amount: isIncomeRule(r) ? r.amount : -r.amount, accountId: r.accountId, recurringId: r.id,
    });
    if (ok) onClose();
  };
  const { money } = useMoney();
  const likely = likelyPayment(r, txs);
  const link = (id: string) => { if (linkPayment(r.id, id)) onClose(); };

  const txLine = (tx: Transaction) => (
    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      <b style={{ fontWeight: 500 }}>{descLabel(tx.description) || '—'}</b>
      <span style={{ color: 'var(--color-ink-3)' }}> · {fmtDate(tx.date)} · </span>
      <span style={{ fontFamily: 'var(--font-mono)' }}>{money(Math.abs(tx.amount))}</span>
    </span>
  );

  const box = {
    margin: '0 0 8px 60px', padding: '8px 12px', borderRadius: 10, fontSize: 12,
    background: 'var(--color-bg)', border: '1px solid var(--line)',
  } as const;

  if (picking) {
    const list = paymentCandidates(r, txs);
    return (
      <div className="view-enter paid-match" style={box}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: 'var(--color-ink-2)', marginBottom: list.length ? 6 : 0 }}>
          <span>{list.length ? t('whichTx') : t('noCandidates')}</span>
          <button className="link-btn" onClick={onClose} style={{ padding: '2px 10px', fontSize: 11, flexShrink: 0 }}>{t('close')}</button>
        </div>
        {list.map(tx => (
          <div key={tx.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '5px 0', borderTop: '1px solid var(--color-border-light)' }}>
            {txLine(tx)}
            <button className="confirm-btn" onClick={() => link(tx.id)} style={{ flexShrink: 0 }}>{t('thisOne')}</button>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '6px 0 0', borderTop: '1px solid var(--color-border-light)', marginTop: list.length ? 2 : 6 }}>
          <span style={{ color: 'var(--color-ink-2)' }}>{isIncomeRule(r) ? t('receivedNotRecorded') : t('paidNotRecorded')}</span>
          <button className="confirm-btn" onClick={markInBalance} style={{ flexShrink: 0 }}>{t('markInBalance')}</button>
        </div>
      </div>
    );
  }

  if (!likely) return null;
  return (
    <div className="view-enter paid-match" style={{ ...box, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span style={{ color: 'var(--color-ink-2)' }}>{t('looksPaid')}</span>
      {txLine(likely)}
      <button className="confirm-btn" onClick={() => link(likely.id)} style={{ marginLeft: 'auto' }}>{t('yesThisOne')}</button>
    </div>
  );
}
