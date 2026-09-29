import { useState, type FormEvent } from 'react';
import type { AccountType } from '../../shared/types';
import { t, goalLabel } from '../../shared/i18n';
import { currencySymbol, fmtDate, monthName, parseAmount, sanitizeAmountInput } from '../../shared/format';
import { Card, Page, PageHeader, SectionHeader } from '../../shared/ui/primitives';
import { useMoney } from '../../store/Settings';
import { DeleteButton } from '../../shared/ui/DeleteButton';
import { useFinance } from '../../store/FinanceStore';
import { useMonthSummary } from '../../store/useMonthSummary';
import { accountFlow } from './logic';
import { sub } from '../../shared/money';
import { ACCOUNT_IDS, accName } from './labels';
import { TransferForm } from './TransferForm';
import { markReconciled } from './ReconcileReminder';
import { useSession } from '../../store/Session';
import { isoDay } from '../../shared/config';

const ICON = { cash: '◍', main: '▭', savings: '◔' } as const;

/** "How much is on this account right now?" — inline editor under the balance */
function BalanceEditor({ id, current, onDone }: { id: AccountType; current: number; onDone: () => void }) {
  const { setAccountBalance, today } = useFinance();
  const { user } = useSession();
  const { currency, rate } = useMoney();
  const [value, setValue] = useState(() => sanitizeAmountInput(String(Math.round(current * rate)), currency));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = parseAmount(value);
    if (!Number.isFinite(v)) return;
    if (setAccountBalance(id, v / rate)) {
      if (user) markReconciled(user.id, isoDay(today, today.current));
      onDone();
    }
  };
  return (
    <form onSubmit={submit} className="view-enter" style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: 'var(--color-ink-3)', marginBottom: 6 }}>{t('balanceNowQ')}</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input autoFocus inputMode="decimal" value={value} onChange={e => setValue(sanitizeAmountInput(e.target.value, currency))}
            onKeyDown={e => { if (e.key === 'Escape') onDone(); }}
            style={{ width: '100%', height: 36, border: '1px solid var(--line-strong)', borderRadius: 8, padding: '0 28px 0 10px', fontFamily: 'var(--font-mono)', fontSize: 15, background: 'var(--color-card)' }} />
          <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--color-ink-3)', fontFamily: 'var(--font-mono)' }}>{currencySymbol(currency)}</span>
        </div>
        <button type="submit" className="confirm-btn" style={{ height: 36 }}>{t('save')}</button>
        <button type="button" className="confirm-btn" style={{ height: 36 }} onClick={onDone}>{t('cancel')}</button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-ink-3)', marginTop: 6, lineHeight: 1.4 }}>{t('balanceNowHint')}</div>
    </form>
  );
}

export function AccountsPage() {
  const { period, transactions, transfers, removeTransfer, guard, isCurrentMonth } = useFinance();
  const [editing, setEditing] = useState<AccountType | null>(null);
  const { balances, totalBalance } = useMonthSummary();
  const { money } = useMoney();
  const total = totalBalance;

  const row = (label: string, value: string, color?: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '7px 0', borderTop: '1px solid var(--color-border-light)' }}>
      <span style={{ color: 'var(--color-ink-3)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', color }}>{value}</span>
    </div>
  );

  return (
    <Page>
      <PageHeader eyebrow={`${monthName(period)} ${period.year}`} title={t('accounts')}>
        <div style={{ fontSize: 14, color: 'var(--color-ink-2)' }}>
          {t('totalBalance')} <b style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--color-ink)' }}>{money(total)}</b>
        </div>
      </PageHeader>

      <div className="m-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
        {ACCOUNT_IDS.map(id => {
          const { inc, out } = accountFlow(id, transactions, transfers);
          return (
            <Card key={id} className="lift reveal-on-hover">
              <SectionHeader title={accName(id)} right={<span aria-hidden="true" style={{ fontSize: 16, color: id === 'savings' ? 'var(--color-accent)' : 'var(--color-ink-3)' }}>{ICON[id]}</span>} />
              {editing === id ? (
                <BalanceEditor id={id} current={balances[id]} onDone={() => setEditing(null)} />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ fontSize: 28, fontWeight: 500, fontFamily: 'var(--font-mono)', letterSpacing: '-0.03em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {money(balances[id])}
                  </div>
                  <button className="icon-btn soft-btn" onClick={() => { if (!guard()) setEditing(id); }} aria-label={t('editBalance')} title={t('editBalance')} style={{ width: 28, height: 28, flexShrink: 0 }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8.2 1.8l2 2L4 10H2v-2z" /></svg>
                  </button>
                </div>
              )}
              {/* start of month + in − out = balance, so it's clear where the number comes from */}
              {isCurrentMonth && row(t('monthStartBalance'), money(sub(balances[id], sub(inc, out))))}
              {row(t('monthIn'), `+${money(inc)}`, 'var(--color-positive)')}
              {row(t('monthOut'), `${out > 0 ? '−' : ''}${money(out)}`)}
            </Card>
          );
        })}
      </div>

      <div className="m-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: 16, alignItems: 'start' }}>
        <TransferForm />
        <Card>
          <SectionHeader title={t('transfersThisMonth')} right={<span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--color-ink-3)' }}>{transfers.length}</span>} />
          {transfers.length === 0
            ? <div style={{ fontSize: 13, color: 'var(--color-ink-3)', padding: '12px 0' }}>{t('noTransfers')}</div>
            : transfers.map((x, i) => (
              <div key={x.id} className="row-hover reveal-on-hover row-transfer" style={{
                display: 'grid', gridTemplateColumns: '64px 1fr auto auto', gap: 12, alignItems: 'center',
                padding: '10px 8px', margin: '0 -8px', borderRadius: 8, borderTop: i ? '1px solid var(--color-border-light)' : 'none',
              }}>
                <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--color-ink-3)' }}>{fmtDate(x.date)}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 13 }}>{accName(x.from)} <span style={{ color: 'var(--color-ink-3)' }}>→</span> {accName(x.to)}</span>
                  {x.note && <span style={{ fontSize: 11, color: 'var(--color-ink-3)', marginLeft: 8 }}>{goalLabel(x.note)}</span>}
                </span>
                <span style={{ fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-mono)', color: 'var(--color-ink-2)' }}>{money(x.amount)}</span>
                <DeleteButton onConfirm={() => removeTransfer(x.id)} label={t('deleteTx')} />
              </div>
            ))}
        </Card>
      </div>
    </Page>
  );
}
