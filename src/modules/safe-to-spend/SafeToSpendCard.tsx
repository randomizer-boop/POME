import { useState } from 'react';
import { t, daysWord, descLabel } from '../../shared/i18n';
import { fmtCurrency, fmtDate } from '../../shared/format';
import { isoDay } from '../../shared/config';
import { useCountUp, useProgressLoad } from '../../shared/hooks';
import { Card, LedgerRow, SectionHeader, StatusPill } from '../../shared/ui/primitives';
import { useMoney } from '../../store/Settings';
import { useFinance } from '../../store/FinanceStore';
import { useMonthSummary } from '../../store/useMonthSummary';
import { MonthSplitBar } from './MonthSplitBar';
import { SavingsRatePicker } from './SavingsRatePicker';
import { isIncomeRule } from '../recurring/logic';

const navBtn = {
  width: 26, height: 26, border: '1px solid var(--line-strong)', background: 'var(--color-card)', cursor: 'pointer', borderRadius: 13,
  color: 'var(--color-ink-2)', fontSize: 15, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0,
} as const;

/** ‹ Yesterday · 28 Sep › — look at any earlier day */
function DaySwitcher() {
  const { period, viewDay, isToday, isFuture, today, shiftDay, goToToday, canGoBack } = useFinance();
  const iso = isoDay(period, viewDay);
  const yesterday = new Date(today.year, today.index, today.current - 1);
  const isYesterday = period.year === yesterday.getFullYear() && period.index === yesterday.getMonth() && viewDay === yesterday.getDate();
  const isTomorrow = isFuture && viewDay === today.current + 1;
  const lastDay = period.year === today.year && period.index === today.index && viewDay >= period.total;
  const firstDay = viewDay === 1 && !canGoBack;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <button style={{ ...navBtn, opacity: firstDay ? 0.3 : 1 }} disabled={firstDay} onClick={() => shiftDay(-1)} aria-label={t('prevDay')} title={t('prevDay')}>‹</button>
      <span style={{ fontSize: 12, color: 'var(--color-ink-2)', whiteSpace: 'nowrap', minWidth: 0 }}>
        {isToday ? t('toToday') : isYesterday ? t('yesterday') : isTomorrow ? t('tomorrowWord') : ''}{isToday || isYesterday || isTomorrow ? ' · ' : ''}{fmtDate(iso)}
      </span>
      <button style={{ ...navBtn, opacity: lastDay ? 0.3 : 1 }} disabled={lastDay} onClick={() => shiftDay(1)} aria-label={t('nextDay')} title={t('nextDay')}>›</button>
      {!isToday && <button className="link-btn" onClick={goToToday} style={{ padding: '3px 10px', fontSize: 11 }}>{t('toToday')}</button>}
    </div>
  );
}

export function SafeToSpendCard({ viewKey }: { viewKey: number }) {
  const { safe, cycle } = useMonthSummary();
  const { period, viewDay, isToday, isFuture, readOnly, recurring } = useFinance();
  const hasSalary = recurring.some(r => r.active && isIncomeRule(r));
  const untilPayday = cycle.mode === 'income' && cycle.nextIncome;
  const savingsPct = Math.round(safe.savingsRate * 100);
  const { money: m, minus: mm, currency, rate } = useMoney();
  const money = (v: number) => m(v, { maxFrac: 0 });
  const minus = (v: number) => mm(v, { maxFrac: 0 });
  const loaded = useProgressLoad();
  const hero = useCountUp(Math.max(0, safe.todayLeft) * rate, 1300, viewKey + viewDay);
  const [open, setOpen] = useState(false);
  const [editPct, setEditPct] = useState(false);

  const over = safe.status === 'over';
  const tone = safe.status === 'ok' ? 'ok' : safe.status === 'tight' ? 'warn' : 'bad';
  const label = safe.status === 'ok' ? t('onTrack') : safe.status === 'tight' ? t('tight') : t('overBudget');
  const overToday = safe.todayLeft < 0;
  const todayPct = safe.todayUsedPct;
  // "{a} left of {b}" with the amount {a} styled
  const strongMono = { fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--color-ink)' } as const;

  return (
    <Card>
      <SectionHeader
        title={isToday ? t('safeToday') : isFuture ? t('safeForecast', { d: fmtDate(isoDay(period, viewDay)) }) : t('safeOnDay', { d: fmtDate(isoDay(period, viewDay)) })}
        right={<StatusPill tone={tone}>{label}</StatusPill>}
      />
      <div style={{ margin: '-4px 0 10px' }}><DaySwitcher /></div>
      {!isToday && <div style={{ fontSize: 11, color: 'var(--color-ink-3)', marginBottom: 6 }}>{isFuture ? t('futureDayNote') : t('pastDayNote')}</div>}

      {/* The day — the main answer */}
      <div className="hero-amount" style={{
        fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 64, fontWeight: 500, lineHeight: 1,
        letterSpacing: '-0.035em', whiteSpace: 'nowrap', margin: '2px 0 4px',
        color: overToday || over ? 'var(--color-negative)' : 'var(--color-ink)',
      }}>
        {fmtCurrency(hero, currency)}
      </div>
      <div style={{ fontSize: 13, color: 'var(--color-ink-2)', marginBottom: 14 }}>{isToday ? t('leftToday') : isFuture ? t('canOnDay') : t('leftOnDay')}</div>

      <div style={{ height: 8, background: 'var(--color-surface)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: loaded ? `${Math.min(100, todayPct)}%` : '0%', borderRadius: 8,
          background: overToday ? 'var(--color-negative)' : 'var(--color-ink)', transition: 'width 0.9s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </div>
      {/* "Spent A of the B limit" — the limit is the same number the calendar uses */}
      <div style={{ fontSize: 12, marginTop: 7, color: 'var(--color-ink-2)' }}>
        {(() => {
          const [pre, mid, post] = t('spentOfLimit', { a: '\u0000', b: '\u0001' }).split(/[\u0000\u0001]/);
          return <>{pre}<b style={strongMono}>{money(safe.spentToday)}</b>{mid}<b style={strongMono}>{money(safe.todayLimit)}</b>{post}</>;
        })()}
      </div>
      {overToday && (
        <div style={{ fontSize: 12, color: 'var(--color-negative)', marginTop: 6 }}>
          {isToday ? t('overToday', { x: money(-safe.todayLeft) }) : t('overOnDay', { x: money(-safe.todayLeft) })}
        </div>
      )}

      {/* Until payday / month end — the total the daily limit comes from */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-3)' }}>
            {untilPayday ? t('untilPayday') : t('untilMonthEnd')} · {t(isToday ? 'daysIncl' : 'daysInclDay', { n: safe.daysLeft, days: daysWord(safe.daysLeft) })}
          </div>
          <div style={{ fontSize: 13, color: over ? 'var(--color-negative)' : 'var(--color-ink-2)', marginTop: 2 }}>
            {over
              ? t('shortNote', { x: money(safe.shortfall) })
              : (() => {
                  const [pre, post] = t('canSpendTotal', { x: '\u0000' }).split('\u0000');
                  return <>{pre}<b style={strongMono}>{money(Math.max(0, safe.spendable))}</b>{post} <span style={{ color: 'var(--color-ink-3)' }}>{t('perDayIs', { x: money(safe.todayLimit) })}</span></>;
                })()}
          </div>
          {untilPayday && <div style={{ fontSize: 11, color: 'var(--color-ink-3)' }}>{t('nextIncomeOn', { d: fmtDate(cycle.nextIncome!) })}</div>}
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

      {!hasSalary && safe.daysLeft <= 7 && !over && (
        <div style={{ fontSize: 11, color: 'var(--color-ink-3)', marginTop: 10, lineHeight: 1.45 }}>
          {t('bigLimitHint', { n: safe.daysLeft, days: daysWord(safe.daysLeft) })}
        </div>
      )}

      {open && (
        <div style={{ marginTop: 14 }} className="view-enter">
          <MonthSplitBar safe={safe} money={money} />
          <div style={{ marginTop: 12 }}>
            <LedgerRow label={t('balanceNow')} detail={t('balanceNowDetail')} amount={money(safe.liquidBalance)} />
            {safe.expectedIncome > 0 && <LedgerRow label={t('incomeDueTodayRow')} amount={`+${money(safe.expectedIncome)}`} />}
            <LedgerRow label={untilPayday ? t('billsBeforePayday') : t('billsToPay')} amount={minus(safe.upcomingBills)}>
              {cycle.bills.length > 0 && (
                <div style={{ margin: '8px 0 2px 12px', borderLeft: '2px solid var(--line)', paddingLeft: 12 }}>
                  {cycle.bills.map(b => (
                    <div key={`${b.rule.id}-${b.date}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0', color: 'var(--color-ink-2)' }}>
                      <span>
                        {descLabel(b.rule.name)}
                        <span style={{ color: 'var(--color-ink-3)', marginLeft: 8 }}>{t('dueDay', { d: fmtDate(b.date) })}</span>
                      </span>
                      <span style={{ fontFamily: "var(--font-mono)" }}>{money(b.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </LedgerRow>
            {(safe.goalsLeft > 0 || safe.goalsDone > 0) && (
              <LedgerRow
                label={t('goalsToSetAside')}
                detail={t('goalsDetail', { x: money(safe.goalsDone), y: money(safe.goalsDone + safe.goalsLeft) })}
                amount={minus(safe.goalsLeft)}
              />
            )}
            <LedgerRow
              label={savingsPct > 0 ? t('savingsRow', { p: savingsPct }) : t('savingsRowZero')}
              detail={
                <>
                  {savingsPct > 0 && t('savingsDetail', { x: money(safe.savingsMoved), y: money(safe.savingsTarget) })}
                  {!editPct && !readOnly && (
                    <button className="link-btn" onClick={() => setEditPct(true)} style={{ marginLeft: 8, padding: '0 8px', fontSize: 11 }}>{t('change')}</button>
                  )}
                </>
              }
              amount={<span style={{ color: 'var(--color-ink-3)' }}>—</span>}
            >
              {savingsPct > 0 && (
                <div style={{ fontSize: 11, color: 'var(--color-ink-3)', marginTop: 2, lineHeight: 1.45 }}>
                  {safe.savingsLeft > 0
                    ? t('savingsTargetLeft', { x: money(safe.savingsLeft) })
                    : safe.savingsProgressPct > 100
                      ? <span style={{ color: 'var(--color-positive)' }}>{t('savingsOverDone', { p: safe.savingsProgressPct, over: safe.savingsProgressPct - 100, x: money(safe.savingsMoved - safe.savingsTarget) })}</span>
                      : t('savingsTargetDone')}
                </div>
              )}
              {editPct && (
                <div className="view-enter" style={{ margin: '10px 0 2px' }}>
                  <SavingsRatePicker onPicked={() => setEditPct(false)} />
                  <div style={{ fontSize: 11, color: 'var(--color-ink-3)', marginTop: 6, lineHeight: 1.45 }}>{t('savingsPctHint')}</div>
                </div>
              )}
            </LedgerRow>
            <LedgerRow
              strong
              label={over ? (untilPayday ? t('shortUntilPayday') : t('shortMonth')) : (untilPayday ? t('canSpendUntilPayday') : t('canSpendMonth'))}
              amount={<span style={{ color: over ? 'var(--color-negative)' : undefined }}>{money(over ? safe.shortfall : safe.spendable)}</span>}
            />
            <div style={{ fontSize: 11, color: 'var(--color-ink-3)', paddingTop: 6 }}>
              {t('limitExplain', { a: money(Math.max(0, safe.spendable)), b: money(safe.spentToday), n: safe.daysLeft, days: daysWord(safe.daysLeft), c: money(safe.todayLimit) })}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
