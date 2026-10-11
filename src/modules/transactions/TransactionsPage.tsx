import { useState } from 'react';
import type { Transaction, Transfer } from '../../shared/types';
import { Deer } from '../../shared/ui/Deer';
import { t, catLabel, descLabel, goalLabel } from '../../shared/i18n';
import { fmtDate, monthName } from '../../shared/format';
import { colorOf } from '../../shared/categories';
import { Card, Dot, Label, Page, PageHeader } from '../../shared/ui/primitives';
import { useMoney } from '../../store/Settings';
import { DeleteButton } from '../../shared/ui/DeleteButton';
import { netTotal } from './logic';
import { useFinance } from '../../store/FinanceStore';
import { useMonthSummary } from '../../store/useMonthSummary';
import { accName } from '../accounts/labels';

type Filter = 'all' | 'income' | 'expense' | 'transfer';
type Row =
  | { kind: 'tx'; id: string; date: string; tx: Transaction }
  | { kind: 'transfer'; id: string; date: string; x: Transfer };

function buildRows(txs: Transaction[], transfers: Transfer[], filter: Filter, search: string): Row[] {
  const rows: Row[] = [
    ...(filter === 'transfer' ? [] : txs
      .filter(tx => filter === 'all' || (filter === 'income' ? tx.amount > 0 : tx.amount < 0))
      .map(tx => ({ kind: 'tx' as const, id: tx.id, date: tx.date, tx }))),
    ...(filter === 'all' || filter === 'transfer' ? transfers.map(x => ({ kind: 'transfer' as const, id: x.id, date: x.date, x })) : []),
  ];
  if (!search) return rows;
  const q = search.toLowerCase();
  return rows.filter(r => {
    const hay = r.kind === 'tx'
      ? [r.tx.description, r.tx.category, descLabel(r.tx.description), catLabel(r.tx.category), accName(r.tx.accountId)]
      : [accName(r.x.from), accName(r.x.to), r.x.note ?? '', t('transferCat')];
    return hay.join(' ').toLowerCase().includes(q);
  });
}

export function TransactionsPage() {
  const { period, transactions, transfers, removeTransaction, removeTransfer } = useFinance();
  const { income, expenses } = useMonthSummary();
  const { money } = useMoney();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const rows = buildRows(transactions, transfers, filter, search);
  const grouped = rows.reduce<Record<string, Row[]>>((acc, r) => { (acc[r.date] ||= []).push(r); return acc; }, {});
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: t('all') }, { id: 'income', label: t('income') },
    { id: 'expense', label: t('expenses') }, { id: 'transfer', label: t('transfers') },
  ];

  return (
    <Page maxWidth={900}>
      <PageHeader eyebrow={`${monthName(period)} ${period.year}`} title={t('transactions')}>
        <div style={{ display: 'flex', gap: 14, fontSize: 13, fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: 'var(--color-positive)' }}>+{money(income)} {t('incomeLower')}</span>
          <span style={{ color: 'var(--line-strong)' }}>|</span>
          <span>−{money(expenses)} {t('expensesLower')}</span>
        </div>
      </PageHeader>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {filters.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: 'pointer',
            border: `1px solid ${filter === f.id ? 'var(--color-ink)' : 'var(--line-strong)'}`,
            background: filter === f.id ? 'var(--color-ink)' : 'var(--color-card)',
            color: filter === f.id ? '#fff' : 'var(--color-ink-2)',
          }}>{f.label}</button>
        ))}
        <input type="text" maxLength={80} placeholder={t('searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} style={{
          marginLeft: 'auto', padding: '7px 14px', border: '1px solid var(--line-strong)', borderRadius: 20,
          background: 'var(--color-card)', fontSize: 13, color: 'var(--color-ink)', width: 230,
        }} />
      </div>

      {dates.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: '40px 0 48px', color: 'var(--color-ink-3)' }}>
          <Deer pose="front" size={104} style={{ margin: "0 auto 14px" }} />
          <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-ink-2)', marginBottom: 4 }}>{t('noTx')}</div>
          <div style={{ fontSize: 13 }}>{t('noTxHint')}</div>
        </Card>
      ) : (
        <Card style={{ padding: '4px 24px' }}>
          {dates.map((date, di) => {
            // transfers don't change the day's net — money only moves between own accounts
            const dayTotal = netTotal(grouped[date].flatMap(r => (r.kind === 'tx' ? [r.tx] : [])));
            return (
              <div key={date} style={{ borderTop: di ? '1px solid var(--line-strong)' : 'none', padding: '12px 0 6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <Label>{fmtDate(date)}</Label>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: dayTotal >= 0 ? 'var(--color-positive)' : 'var(--color-ink-3)' }}>
                    {dayTotal !== 0 && `${dayTotal > 0 ? '+' : ''}${money(dayTotal)}`}
                  </span>
                </div>
                {grouped[date].map(r => (
                  <div key={r.id} className="row-hover reveal-on-hover row-tx" style={{
                    display: 'grid', gridTemplateColumns: '1fr 160px 130px 30px', alignItems: 'center', gap: 12,
                    padding: '9px 8px', margin: '0 -8px', borderRadius: 8,
                  }}>
                    {r.kind === 'tx' ? (
                      <>
                        <span style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <span style={{ fontSize: 14, fontWeight: 500 }}>{descLabel(r.tx.description)}</span>
                          <span style={{ fontSize: 11, color: 'var(--color-ink-3)', marginLeft: 8 }}>{accName(r.tx.accountId)}</span>
                        </span>
                        <span className="m-hide" style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--color-ink-2)' }}>
                          <Dot color={colorOf(r.tx.category)} size={7} />{catLabel(r.tx.category)}
                        </span>
                        <span style={{ textAlign: 'right', fontSize: 14, fontWeight: 500, fontFamily: 'var(--font-mono)', color: r.tx.amount > 0 ? 'var(--color-positive)' : 'var(--color-ink)' }}>
                          {r.tx.amount > 0 ? '+' : ''}{money(r.tx.amount)}
                        </span>
                        <DeleteButton onConfirm={() => removeTransaction(r.tx.id)} label={t('deleteTx')} />
                      </>
                    ) : (
                      <>
                        <span style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 14 }}>
                          {accName(r.x.from)} <span style={{ color: 'var(--color-ink-3)' }}>→</span> {accName(r.x.to)}
                          {r.x.note && <span style={{ fontSize: 11, color: 'var(--color-ink-3)', marginLeft: 8 }}>{goalLabel(r.x.note)}</span>}
                        </span>
                        <span className="m-hide" style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--color-ink-3)' }}>
                          <span aria-hidden="true">⇄</span>{t('transferCat')}
                        </span>
                        <span style={{ textAlign: 'right', fontSize: 14, fontFamily: 'var(--font-mono)', color: 'var(--color-ink-3)' }}>{money(r.x.amount)}</span>
                        <DeleteButton onConfirm={() => removeTransfer(r.x.id)} label={t('deleteTx')} />
                      </>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </Card>
      )}
    </Page>
  );
}
