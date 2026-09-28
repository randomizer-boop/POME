import { useState } from 'react';
import { t, daysWord, descLabel } from '../../shared/i18n';
import { currencySymbol, fmtCurrency, fmtDate, parseAmount, sanitizeAmountInput } from '../../shared/format';
import { useCountUp, useProgressLoad } from '../../shared/hooks';
import { Card, LedgerRow, SectionHeader, StatusPill } from '../../shared/ui/primitives';
import { useMoney, useSettings } from '../../store/Settings';
import { useFinance } from '../../store/FinanceStore';
import { useMonthSummary } from '../../store/useMonthSummary';
import { MonthSplitBar } from './MonthSplitBar';
import { SAFETY_BUFFER_RATE } from './logic';

/** Small ring: share of the month's flexible budget that is still left */
function Ring({ pct }: { pct: number }) {
  const r = 16, c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r={r} fill="none" stroke="var(--color-surface)" strokeWidth="5" />
      <circle cx="20" cy="20" r={r} fill="none" stroke={p < 15 ? 'var(--color-negative)' : 'var(--color-ink-2)'} strokeWidth="5"
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)} transform="rotate(-90 20 20)" />
    </svg>
  );
}

export function SafeToSpendCard({ viewKey }: { viewKey: number }) {
  const { safe, cycle, saved, goalsPlanned } = useMonthSummary();
  const { safetyBuffer: customBuffer, setSafetyBuffer } = useSettings();
  const { guard } = useFinance();
  const [editBuffer, setEditBuffer] = useState(false);
  const [bufferDraft, setBufferDraft] = useState('');
  const untilPayday = cycle.mode === 'income' && cycle.nextIncome;
  const bufferPct = Math.round(SAFETY_BUFFER_RATE * 100);
  const { money: m, currency, rate } = useMoney();
  const money = (v: number) => m(v, { maxFrac: 0 });
  const loaded = useProgressLoad();
  const hero = useCountUp(Math.max(0, safe.todayLeft) * rate, 1300, viewKey);
  const [open, setOpen] = useState(false);

  const tone = safe.status === 'ok' ? 'ok' : safe.status === 'tight' ? 'warn' : 'bad';
  const label = safe.status === 'ok' ? t('onTrack') : safe.status === 'tight' ? t('tight') : t('overBudget');
  const overToday = safe.todayLeft < 0;
  const todayPct = safe.todayUsedPct;
  // "{a} left of {b}" with the amount {a} styled
  const [leftPre, leftPost] = t('monthLeftOf', { a: '\u0000', b: money(safe.flexibleBudget) }).split('\u0000');
  const monthPct = safe.monthLeftPct;

  return (
    <Card>
      <SectionHeader title={t('safeToday')} right={<StatusPill tone={tone}>{label}</StatusPill>} />

      {/* Today — the main answer */}
      <div className="hero-amount" style={{
        fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 64, fontWeight: 500, lineHeight: 1,
        letterSpacing: '-0.035em', whiteSpace: 'nowrap', margin: '2px 0 16px',
        color: overToday || safe.status === 'over' ? 'var(--color-negative)' : 'var(--color-ink)',
      }}>
        {fmtCurrency(hero, currency)}
      </div>

      <div style={{ height: 8, background: 'var(--color-surface)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: loaded ? `${Math.min(100, todayPct)}%` : '0%', borderRadius: 8,
          background: overToday ? 'var(--color-negative)' : 'var(--color-ink)', transition: 'width 0.9s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 7, color: 'var(--color-ink-2)' }}>
        <span>{t('spentTodayLabel')} <b style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--color-ink)' }}>{money(safe.spentToday)}</b></span>
        <span>{t('todayLimitLabel', { x: money(safe.todayLimit) })}</span>
      </div>
      {overToday && (
        <div style={{ fontSize: 12, color: 'var(--color-negative)', marginTop: 6 }}>{t('overToday', { x: money(-safe.todayLeft) })}</div>
      )}

      {/* Month — small indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
        <Ring pct={monthPct} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-3)' }}>{untilPayday ? t('untilPayday') : t('monthBudget')}</div>
          <div style={{ fontSize: 13, color: 'var(--color-ink-2)' }}>
            {leftPre}<b style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--color-ink)' }}>{money(Math.max(0, safe.leftForMonth))}</b>{leftPost}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-ink-3)' }}>
            {t('daysIncl', { n: safe.daysLeft, days: daysWord(safe.daysLeft) })}
            {untilPayday && ` · ${t('nextIncomeOn', { d: fmtDate(cycle.nextIncome!) })}`}
          </div>
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 12, color: 'var(--color-ink-2)', whiteSpace: 'nowrap' }}
        >
          <span style={{ display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s ease', marginRight: 4 }}>›</span>
          {t('howCalculated')}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 14 }} className="view-enter">
          <MonthSplitBar safe={safe} money={money} />
          <div style={{ marginTop: 12 }}>
            <LedgerRow label={t('balanceNow')} detail={t('balanceNowDetail')} amount={money(safe.liquidBalance)} />
            {safe.expectedIncome > 0 && <LedgerRow label={t('incomeDueTodayRow')} amount={`+${money(safe.expectedIncome)}`} />}
            <LedgerRow
              label={untilPayday ? t('billsBeforePayday') : t('billsToPay')}
              amount={`−${money(safe.upcomingBills)}`}
            >
              {cycle.bills.length > 0 && (
                <div style={{ margin: '8px 0 2px 12px', borderLeft: '2px solid var(--line)', paddingLeft: 12 }}>
                  {cycle.bills.map(b => (
                    <div key={`${b.rule.id}-${b.date}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0', color: 'var(--color-ink-2)' }}>
                      <span>
                        {descLabel(b.rule.name)}
                        <span style={{ color: 'var(--color-ink-3)', marginLeft: 8 }}>{t('dueDay', { d: fmtDate(b.date) })}</span>
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>{money(b.rule.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </LedgerRow>
            <LedgerRow
              label={t('goalsToSetAside')}
              detail={t('goalsSavingsDetail', { x: money(Math.max(0, saved)), y: money(goalsPlanned) })}
              amount={`−${money(safe.goalsLeft)}`}
            />
            <LedgerRow
              label={t('safetyBufferRow')}
              detail={
                <>
                  {customBuffer === null ? t('safetyBufferDetail', { p: bufferPct }) : t('safetyBufferCustom')}
                  {!editBuffer && (
                    <button className="link-btn" onClick={() => { if (!guard()) { setBufferDraft(sanitizeAmountInput(String(Math.round(safe.safetyBuffer * rate)), currency)); setEditBuffer(true); } }}
                      style={{ marginLeft: 8, padding: '0 8px', fontSize: 11 }}>{t('change')}</button>
                  )}
                </>
              }
              amount={`−${money(safe.safetyBuffer)}`}
            >
              {editBuffer && (
                <form className="view-enter" onSubmit={e => { e.preventDefault(); const v = parseAmount(bufferDraft); if (Number.isFinite(v) && v >= 0) { setSafetyBuffer(v / rate); setEditBuffer(false); } }}
                  style={{ display: 'flex', gap: 6, alignItems: 'center', margin: '8px 0 2px', flexWrap: 'wrap' }}>
                  <input autoFocus inputMode="decimal" value={bufferDraft} onChange={e => setBufferDraft(sanitizeAmountInput(e.target.value, currency))}
                    style={{ width: 130, height: 30, border: '1px solid var(--line-strong)', borderRadius: 8, padding: '0 10px', fontFamily: 'var(--font-mono)', fontSize: 13, background: 'var(--color-card)' }} />
                  <span style={{ fontSize: 12, color: 'var(--color-ink-3)', fontFamily: 'var(--font-mono)' }}>{currencySymbol(currency)}</span>
                  <button type="submit" className="confirm-btn">{t('save')}</button>
                  {customBuffer !== null && <button type="button" className="confirm-btn" onClick={() => { setSafetyBuffer(null); setEditBuffer(false); }}>{t('bufferAuto')}</button>}
                  <button type="button" className="confirm-btn" onClick={() => setEditBuffer(false)}>{t('cancel')}</button>
                </form>
              )}
            </LedgerRow>
            <LedgerRow strong label={untilPayday ? t('canSpendUntilPayday') : t('canSpendMonth')} amount={money(safe.spendable)} />
            <div style={{ fontSize: 11, color: 'var(--color-ink-3)', paddingTop: 6 }}>
              {t('limitFormula', { n: safe.daysLeft, days: daysWord(safe.daysLeft) })} = {money(safe.todayLimit)}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
