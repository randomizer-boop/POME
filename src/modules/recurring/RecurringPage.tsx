import { useState, type CSSProperties, type ReactNode } from 'react';
import type { RecurringPayment } from '../../shared/types';
import { t, catLabel, descLabel, locale, paymentsWord } from '../../shared/i18n';
import { monthName } from '../../shared/format';
import { isoDay } from '../../shared/config';
import { CategoryBadge } from '../../shared/ui/categoryIcons';
import { Card, Collapse, Page, PageHeader } from '../../shared/ui/primitives';
import { useMoney } from '../../store/Settings';
import { DeleteButton } from '../../shared/ui/DeleteButton';
import { useFinance } from '../../store/FinanceStore';
import { useMonthSummary } from '../../store/useMonthSummary';
import { accName } from '../accounts/labels';
import { daysToCharge, daysUntil, isBillRule, isDueInPeriod, isIncomeRule, nextChargeDate, recurringStatus, type RecurringStatus } from './logic';
import { dueLabel } from './dueLabel';
import { RecurringForm } from './RecurringForm';
import { PaidMatch } from './PaidMatch';

/** A button that says what it will do to the money: label + a small line under it */
function ResultButton({ label, result, onClick, primary }: { label: string; result: string; onClick: () => void; primary?: boolean }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, padding: '6px 12px', borderRadius: 12, cursor: 'pointer',
      border: `1px ${primary ? 'solid' : 'dashed'} var(--line-strong)`, background: primary ? 'var(--color-card)' : 'transparent', textAlign: 'left',
    }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-ink)' }}>{label}</span>
      <span style={{ fontSize: 10.5, color: 'var(--color-ink-3)', whiteSpace: 'nowrap' }}>{result}</span>
    </button>
  );
}

const PauseIcon = () => <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect x="2.5" y="2" width="2.5" height="8" rx="1" fill="currentColor"/><rect x="7" y="2" width="2.5" height="8" rx="1" fill="currentColor"/></svg>;
const PlayIcon = () => <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 2l7 4-7 4z" fill="currentColor"/></svg>;

type Row = { r: RecurringPayment; next: Date; status: RecurringStatus; days: number };

/** Calendar-style date tile: day number + short month; colour = urgency */
function DateTile({ date, tone }: { date: Date; tone: 'overdue' | 'soon' | 'later' | 'muted' }) {
  const c = {
    overdue: { bg: 'var(--color-accent-soft)', fg: 'var(--color-negative)', bd: 'var(--color-negative)' },
    soon:    { bg: 'var(--color-accent-soft)', fg: 'var(--color-brand)',    bd: 'transparent' },
    later:   { bg: 'var(--color-bg)',          fg: 'var(--color-ink)',      bd: 'var(--line-strong)' },
    muted:   { bg: 'var(--color-bg)',          fg: 'var(--color-ink-3)',    bd: 'var(--line)' },
  }[tone];
  return (
    <div style={{
      width: 46, height: 50, borderRadius: 10, background: c.bg, border: `1px solid ${c.bd}`, color: c.fg,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
    }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 500 }}>{date.getDate()}</span>
      <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>
        {date.toLocaleDateString(locale(), { month: 'short' }).replace('.', '')}
      </span>
    </div>
  );
}

/** This month's bills as one bar: each segment is a payment, filled = paid, red = overdue */
function PaidBar({ rows, total, paid, money }: { rows: Row[]; total: number; paid: number; money: (v: number) => string }) {
  if (total === 0) return null;
  const ordered = [...rows].sort((a, b) => a.r.day - b.r.day);
  return (
    <div>
      <div style={{ display: 'flex', gap: 3, height: 10 }}>
        {ordered.map(x => (
          <div key={x.r.id} title={`${descLabel(x.r.name)} · ${money(x.r.amount)}`} style={{
            flex: `${Math.max(x.r.amount, total * 0.02)} 0 0`, borderRadius: 4,
            background: x.status === 'paid' ? 'var(--color-ink-2)' : x.status === 'overdue' ? 'var(--color-negative)' : 'transparent',
            border: x.status === 'upcoming' ? '1.5px solid var(--line-strong)' : 'none',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-ink-2)', marginTop: 8 }}>
        <span>{t('paidOfTotal', { a: money(paid), b: money(total) })}</span>
        <span style={{ display: 'flex', gap: 14, color: 'var(--color-ink-3)' }}>
          <Legend swatch={{ background: 'var(--color-ink-2)' }} label={t('statusPaid')} />
          <Legend swatch={{ border: '1.5px solid var(--line-strong)' }} label={t('statusUpcoming')} />
          {rows.some(x => x.status === 'overdue') && <Legend swatch={{ background: 'var(--color-negative)' }} label={t('statusOverdue')} />}
        </span>
      </div>
    </div>
  );
}

const Legend = ({ swatch, label }: { swatch: CSSProperties; label: string }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
    <span style={{ width: 10, height: 10, borderRadius: 3, boxSizing: 'border-box', ...swatch }} />{label}
  </span>
);

function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-ink-3)' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 500, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', margin: '4px 0 2px' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--color-ink-3)' }}>{sub}</div>}
    </div>
  );
}

const SOON_DAYS = 7;

export function RecurringPage() {
  const { period, transactions, allTransactions, recurring, toggleRecurring, payRecurring, removeRecurring, addTransactionKeepBalance, guard } = useFinance();
  const { billsUpcoming, unpaid, bills } = useMonthSummary();
  const { money } = useMoney();
  const [formOpen, setFormOpen] = useState(false);
  const [incomeFormOpen, setIncomeFormOpen] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);
  const m0 = (v: number) => money(v, { maxFrac: 0 });

  const perMonth = bills.perMonth;
  const allRows: Row[] = recurring.map(r => {
    const next = nextChargeDate(r, allTransactions, period);
    const status = recurringStatus(r, allTransactions, period);
    return { r, next, status, days: status === 'overdue' ? daysToCharge(r, period) : daysUntil(next, period) };
  });
  // income (salary) lives in its own card; everything below is about bills
  const incomeRows = allRows.filter(x => isIncomeRule(x.r)).sort((a, b) => a.r.day - b.r.day);
  const rows = allRows.filter(x => isBillRule(x.r));
  const byDays = (a: Row, b: Row) => a.days - b.days;
  const dueNow = (x: Row) => x.r.active && isDueInPeriod(x.r, period);
  const thisMonth = rows.filter(dueNow);

  const sections: { key: string; title: string; rows: Row[] }[] = [
    { key: 'pay',    title: t('needToPay'),      rows: thisMonth.filter(x => x.status === 'overdue' || (x.status === 'upcoming' && x.days <= SOON_DAYS)).sort(byDays) },
    { key: 'later',  title: t('laterThisMonth'), rows: thisMonth.filter(x => x.status === 'upcoming' && x.days > SOON_DAYS).sort(byDays) },
    { key: 'paid',   title: t('paidSection'),    rows: thisMonth.filter(x => x.status === 'paid').sort((a, b) => a.r.day - b.r.day) },
    { key: 'yearly', title: t('yearlySection'),  rows: rows.filter(x => x.r.active && !isDueInPeriod(x.r, period)).sort((a, b) => a.next.getTime() - b.next.getTime()) },
    { key: 'paused', title: t('pausedSection'),  rows: rows.filter(x => x.status === 'paused') },
  ];

  const nextOne = [...thisMonth.filter(x => x.status === 'upcoming')].sort(byDays)[0];
  const fmtNext = (d: Date) => d.toLocaleDateString(locale(), { day: 'numeric', month: 'short', ...(d.getFullYear() !== period.year ? { year: 'numeric' } : {}) });

  const tone = (x: Row): 'overdue' | 'soon' | 'later' | 'muted' =>
    x.status === 'overdue' ? 'overdue' : x.status === 'paid' || x.status === 'paused' ? 'muted' : x.days <= SOON_DAYS && dueNow(x) ? 'soon' : 'later';

  const statusText = (x: Row): ReactNode => {
    if (x.status === 'paused') return t('pausedSection');
    if (x.status === 'paid') return <span>✓ {isIncomeRule(x.r) ? t('receivedThisMonthShort') : ''} {t('nextOn', { d: fmtNext(x.next) })}</span>;
    // income that's late isn't a debt: say when it was expected
    if (isIncomeRule(x.r) && x.status === 'overdue') return <span style={{ color: 'var(--color-brand)' }}>{t('incomeExpectedOn', { d: fmtNext(dueDate(x)) })}</span>;
    return <span style={{ color: x.status === 'overdue' ? 'var(--color-negative)' : x.days <= SOON_DAYS ? 'var(--color-brand)' : undefined }}>{dueLabel(x.days)}</span>;
  };
  /** the date the action buttons refer to: this month's (overdue) or the next one */
  const dueDate = (x: Row) => (x.status === 'overdue' ? new Date(period.year, period.index, Math.min(x.r.day, period.total)) : x.next);

  // income already reflected in the account: record it (history, stats, marks it received) without adding it again
  const markInBalance = (r: RecurringPayment) => addTransactionKeepBalance({
    date: isoDay(period, Math.min(r.day, period.current)), description: r.name, category: r.category,
    amount: r.amount, accountId: r.accountId, recurringId: r.id,
  });

  const openForm = () => { if (!guard()) setFormOpen(o => !o); };
  const openIncomeForm = () => { if (!guard()) setIncomeFormOpen(o => !o); };

  const renderRow = (x: Row) => {
    const canPay = x.status === 'overdue' || x.status === 'upcoming' ? dueNow(x) : false;
    return (
      <div key={x.r.id}>
      <div className="row-hover reveal-on-hover row-recur" style={{
        display: 'grid', gridTemplateColumns: '46px 1fr auto auto 30px 26px', gap: 14, alignItems: 'center',
        padding: '10px 8px', margin: '0 -8px', borderBottom: '1px solid var(--color-border-light)', borderRadius: 8,
        opacity: x.status === 'paused' ? 0.55 : 1,
      }}>
        <DateTile date={x.status === 'overdue' ? new Date(period.year, period.index, Math.min(x.r.day, period.total)) : x.next} tone={tone(x)} />
        <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="m-hide"><CategoryBadge category={x.r.category} size={30} /></span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{descLabel(x.r.name)}</div>
            <div style={{ fontSize: 11, color: 'var(--color-ink-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {isIncomeRule(x.r)
                ? `${t('incomeEvery', { d: x.r.day })} · ${t('toAccount', { a: accName(x.r.accountId) })}`
                : `${x.r.frequency === 'yearly' ? t('yearly') : t('monthly')} · ${catLabel(x.r.category)} · ${accName(x.r.accountId)}`}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 14, fontWeight: 500, fontFamily: 'var(--font-mono)', color: isIncomeRule(x.r) ? 'var(--color-positive)' : undefined }}>{isIncomeRule(x.r) ? '+' : ''}{money(x.r.amount)}</div>
          <div style={{ fontSize: 11, marginTop: 2, color: 'var(--color-ink-3)' }}>{statusText(x)}</div>
        </div>
        <div style={{ minWidth: 84, display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {canPay && isBillRule(x.r) && (
            <>
              <button className="link-btn" onClick={() => payRecurring(x.r.id)}>{t('payNow')}</button>
              <button className="link-btn" onClick={() => { if (!guard()) setPicking(p => (p === x.r.id ? null : x.r.id)); }}
                style={{ background: 'transparent', borderStyle: 'dashed' }}>{t('alreadyPaid')}</button>
            </>
          )}
          {/* income: each button says what happens to the balance */}
          {canPay && isIncomeRule(x.r) && (
            <>
              <ResultButton label={t('addIncomeArrival')} result={t('addIncomeArrivalSub', { x: money(x.r.amount), a: accName(x.r.accountId) })}
                onClick={() => payRecurring(x.r.id)} primary />
              <ResultButton label={t('alreadyInBalance')} result={t('alreadyInBalanceSub')}
                onClick={() => markInBalance(x.r)} />
            </>
          )}
        </div>
        <button
          className="icon-btn reveal"
          onClick={() => toggleRecurring(x.r.id)}
          aria-label={x.status === 'paused' ? t('resume') : t('pause')}
          title={x.status === 'paused' ? t('resume') : t('pause')}
        >
          {x.status === 'paused' ? <PlayIcon /> : <PauseIcon />}
        </button>
        <DeleteButton onConfirm={() => removeRecurring(x.r.id)} label={t('deleteTx')} />
      </div>
      {canPay && isBillRule(x.r) && <PaidMatch r={x.r} txs={transactions} picking={picking === x.r.id} onClose={() => setPicking(null)} />}
      </div>
    );
  };

  return (
    <Page maxWidth={920}>
      <PageHeader eyebrow={`${monthName(period)} ${period.year}`} title={t('recurringPayments')} />

      {/* Income — not a payment: it tells "Safe to spend" until when the money must last */}
      <Card style={{ marginBottom: 16, padding: '16px 20px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-3)' }}>{t('incomeSection')}</div>
          </div>
          <button className="link-btn" onClick={openIncomeForm} aria-expanded={incomeFormOpen} style={{ flexShrink: 0 }}>
            {incomeFormOpen ? t('close') : `+ ${t('addIncomeBtn')}`}
          </button>
        </div>
        <Collapse open={incomeFormOpen}><div style={{ padding: '12px 0 4px' }}><RecurringForm embedded kind="income" onDone={() => setIncomeFormOpen(false)} /></div></Collapse>
        {incomeRows.length === 0 && !incomeFormOpen && (
          <div style={{ padding: '14px 0 6px', fontSize: 13, color: 'var(--color-ink-2)' }}>{t('noIncomeRule')}</div>
        )}
        {incomeRows.length > 0 && <div style={{ marginTop: 10 }}>{incomeRows.map(renderRow)}</div>}
      </Card>

      {/* This month at a glance */}
      <Card style={{ marginBottom: 16 }}>
        <div className="m-stack m-flat" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 20, marginBottom: 18 }}>
          <Stat label={t('stillDue')} value={m0(billsUpcoming)} sub={unpaid.length ? `${unpaid.length} ${paymentsWord(unpaid.length)}` : t('allPaid')} />
          <div style={{ borderLeft: '1px solid var(--line)', paddingLeft: 20 }}>
            <Stat label={t('perMonthEq')} value={m0(perMonth)} />
          </div>
          <div style={{ borderLeft: '1px solid var(--line)', paddingLeft: 20 }}>
            <Stat
              label={t('nextUp')}
              value={nextOne ? <span style={{ fontFamily: 'var(--font-sans)', fontSize: 17 }}>{descLabel(nextOne.r.name)}</span> : '—'}
              sub={nextOne ? `${fmtNext(nextOne.next)} · ${money(nextOne.r.amount)}` : undefined}
            />
          </div>
        </div>
        <PaidBar rows={thisMonth.filter(x => isBillRule(x.r))} total={bills.total} paid={bills.paid} money={m0} />
      </Card>

      {/* Agenda */}
      <Card style={{ padding: '14px 20px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="link-btn" onClick={openForm} aria-expanded={formOpen}>
            {formOpen ? t('close') : `+ ${t('addPaymentBtn')}`}
          </button>
        </div>
        <Collapse open={formOpen}><div style={{ padding: '12px 0 4px' }}><RecurringForm embedded onDone={() => setFormOpen(false)} /></div></Collapse>

        {rows.length === 0 && !formOpen && (
          <div style={{ padding: '28px 0', textAlign: 'center', fontSize: 13, color: 'var(--color-ink-3)' }}>{t('noRecurring')}</div>
        )}

        {sections.filter(s => s.rows.length > 0).map(section => (
          <div key={section.key} style={{ marginTop: 16 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: section.key === 'pay' ? 'var(--color-brand)' : 'var(--color-ink-3)', paddingBottom: 8, borderBottom: '1px solid var(--line-strong)',
            }}>
              <span>{section.title}</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{section.rows.length}</span>
            </div>
            {section.rows.map(renderRow)}
          </div>
        ))}
      </Card>
    </Page>
  );
}
