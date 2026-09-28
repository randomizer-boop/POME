import { useState, type FormEvent } from 'react';
import { t, catLabel } from '../../shared/i18n';
import { currencySymbol, monthName, parseAmount, sanitizeAmountInput } from '../../shared/format';
import { EXPENSE_CATEGORIES, colorOf } from '../../shared/categories';
import { DeleteButton } from '../../shared/ui/DeleteButton';
import { useProgressLoad } from '../../shared/hooks';
import { Card, Dot, Label, Page, PageHeader, PaceLegend, ProgressBar, SectionHeader, StatusPill } from '../../shared/ui/primitives';
import { useMoney } from '../../store/Settings';
import { useFinance } from '../../store/FinanceStore';
import { useMonthSummary } from '../../store/useMonthSummary';
import { MonthRuler } from './MonthRuler';

const COLS = '1.2fr 1.6fr 100px 64px';

const PencilIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8.2 1.8l2 2L4 10H2v-2z" />
  </svg>
);

/** Amount field in the display currency */
function MoneyInput({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  const { currency } = useMoney();
  return (
    <div style={{ position: 'relative' }}>
      <input autoFocus={autoFocus} inputMode="decimal" value={value} placeholder="0" onChange={e => onChange(sanitizeAmountInput(e.target.value, currency))}
        style={{ width: '100%', height: 32, border: '1px solid var(--line-strong)', borderRadius: 8, padding: '0 26px 0 10px', fontFamily: 'var(--font-mono)', fontSize: 13, background: 'var(--color-card)' }} />
      <span style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--color-ink-3)', fontFamily: 'var(--font-mono)' }}>{currencySymbol(currency)}</span>
    </div>
  );
}

/** Row at the bottom: pick a category that has no limit yet + set its limit */
function AddCategoryRow({ used, onDone }: { used: string[]; onDone: () => void }) {
  const { setAllocation } = useFinance();
  const { rate } = useMoney();
  const free = EXPENSE_CATEGORIES.filter(c => !used.includes(c));
  const [category, setCategory] = useState(free[0] ?? '');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (free.length === 0) return <div style={{ padding: '14px 0', fontSize: 13, color: 'var(--color-ink-3)' }}>{t('allCategoriesUsed')}</div>;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const planned = parseAmount(value) / rate;
    if (!(planned > 0)) { setError(t('errLimit')); return; }
    if (setAllocation(category, planned)) onDone();
  };
  return (
    <form onSubmit={submit} className="view-enter m-2col" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr auto auto', gap: 10, alignItems: 'center', padding: '14px 0', borderBottom: '1px solid var(--color-border-light)' }}>
      <select value={category} onChange={e => setCategory(e.target.value)}
        style={{ height: 32, border: '1px solid var(--line-strong)', borderRadius: 8, padding: '0 8px', fontSize: 13, background: 'var(--color-card)' }}>
        {free.map(c => <option key={c} value={c}>{catLabel(c)}</option>)}
      </select>
      <MoneyInput value={value} onChange={v => { setValue(v); setError(null); }} autoFocus />
      <button type="submit" className="link-btn">{t('add')}</button>
      <button type="button" className="link-btn" onClick={onDone}>{t('cancel')}</button>
      {error && <div style={{ gridColumn: '1 / -1', fontSize: 12, color: 'var(--color-negative)' }}>{error}</div>}
    </form>
  );
}

export function BudgetPage() {
  const { period, setAllocation, removeAllocation, guard } = useFinance();
  const { rate, currency } = useMoney();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const startEdit = (name: string, allocated: number) => {
    if (guard()) return;
    setEditing(name);
    setDraft(sanitizeAmountInput(String(Math.round(allocated * rate)), currency));
  };
  const saveEdit = (e: FormEvent) => {
    e.preventDefault();
    const planned = parseAmount(draft) / rate;
    if (!editing || !(planned > 0)) return;
    if (setAllocation(editing, planned)) setEditing(null);
  };
  const { budget, budgetSum } = useMonthSummary();
  const { money } = useMoney();
  const loaded = useProgressLoad();
  const monthPct = (period.current / period.total) * 100;
  const overallPct = budgetSum.usedPct;
  const mono = (s: string) => <b style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--color-ink)' }}>{s}</b>;
  const [pre, mid, post] = t('spentOf', { a: '\u0000', b: '\u0000' }).split('\u0000');

  return (
    <Page maxWidth={1000}>
      <PageHeader eyebrow={`${monthName(period)} ${period.year}`} title={t('monthlyBudget')}>
        <div style={{ fontSize: 14, color: 'var(--color-ink-2)' }}>{pre}{mono(money(budgetSum.spent))}{mid}{mono(money(budgetSum.planned))}{post}</div>
        {!adding && <button className="link-btn" onClick={() => { if (!guard()) setAdding(true); }} style={{ marginTop: 12 }}>+ {t('addCategoryBtn')}</button>}
      </PageHeader>

      <Card style={{ marginBottom: 16 }}>
        <SectionHeader title={t('overall')} right={
          <StatusPill tone={overallPct <= monthPct ? 'ok' : 'warn'}>{t('usedOfMonth', { p: Math.round(overallPct), m: Math.round(monthPct) })}</StatusPill>
        } />
        <MonthRuler budgetPct={overallPct} period={period} loaded={loaded} />
      </Card>

      <Card style={{ padding: '8px 24px 12px' }}>
        <div className="m-hide" style={{ display: 'grid', gridTemplateColumns: COLS, gap: 20, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--line-strong)' }}>
          <Label>{t('category')}</Label>
          <PaceLegend />
          <div style={{ textAlign: 'right' }}><Label>{t('left')}</Label></div>
          <span />
        </div>
        {adding && <AddCategoryRow used={budget.map(c => c.name)} onDone={() => setAdding(false)} />}
        {budget.length === 0 && !adding && <div style={{ padding: '28px 0', textAlign: 'center', fontSize: 13, color: 'var(--color-ink-3)' }}>{t('emptyBudget')}</div>}
        {budget.map((cat, i) => {
          const pct = cat.usedPct;
          const remaining = cat.remaining;
          return (
            <div key={cat.name} className="row-hover reveal-on-hover row-budget" style={{
              display: 'grid', gridTemplateColumns: COLS, gap: 20, alignItems: 'center',
              padding: '14px 8px', margin: '0 -8px', borderBottom: '1px solid var(--color-border-light)',
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}><Dot color={colorOf(cat.name)} />{catLabel(cat.name)}</div>
                {editing === cat.name ? (
                  <form onSubmit={saveEdit} style={{ display: 'flex', gap: 6, alignItems: 'center', margin: '6px 0 0 16px' }}>
                    <div style={{ width: 130 }}><MoneyInput value={draft} onChange={setDraft} autoFocus /></div>
                    <button type="submit" className="confirm-btn">{t('save')}</button>
                    <button type="button" className="confirm-btn" onClick={() => setEditing(null)}>{t('cancel')}</button>
                  </form>
                ) : (
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-ink-3)', marginLeft: 16 }}>
                    {t('aOfB', { a: money(cat.spent, { maxFrac: 0 }), b: money(cat.allocated, { maxFrac: 0 }) })}
                  </div>
                )}
              </div>
              <div>
                <ProgressBar pct={pct} loaded={loaded} delay={i} marker={monthPct} />
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-ink-3)', marginTop: 5 }}>{Math.round(pct)}%</div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-mono)', color: remaining < 0 ? 'var(--color-negative)' : 'var(--color-ink)' }}>
                {remaining < 0 ? '−' : '+'}{money(Math.abs(remaining), { maxFrac: 0 })}
              </div>
              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                {editing !== cat.name && (
                  <button className="icon-btn soft-btn" onClick={() => startEdit(cat.name, cat.allocated)} aria-label={t('editLimit')} title={t('editLimit')} style={{ width: 26, height: 26 }}>
                    <PencilIcon />
                  </button>
                )}
                <DeleteButton onConfirm={() => removeAllocation(cat.name)} label={t('removeFromBudget')} />
              </div>
            </div>
          );
        })}
        <div className="row-budget" style={{ display: 'grid', gridTemplateColumns: COLS, gap: 20, padding: '14px 0 4px' }}>
          <span style={{ fontSize: 14, fontWeight: 500 }}>{t('total')}</span>
          <span />
          <span style={{ textAlign: 'right', fontSize: 14, fontWeight: 500, fontFamily: 'var(--font-mono)', color: budgetSum.left >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}>
            {budgetSum.left >= 0 ? '+' : '−'}{money(Math.abs(budgetSum.left), { maxFrac: 0 })}
          </span>
          <span />
        </div>
      </Card>
    </Page>
  );
}
