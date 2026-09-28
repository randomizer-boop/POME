import { useState, type JSX } from 'react';
import type { Currency, View } from '../shared/types';
import { CURRENCIES } from '../shared/config';
import { LANGS, currencyName, locale, t } from '../shared/i18n';
import { currencySymbol, monthName } from '../shared/format';
import {
  IconAccounts, IconAnalytics, IconBudget, IconForecast, IconGoals, IconOverview, IconRecurring, IconTransactions, PomeMark,
} from '../shared/ui/icons';
import { useSettings } from '../store/Settings';
import { useFinance } from '../store/FinanceStore';

// Order follows the data flow: accounts → transactions → budget → goals → recurring → analytics → forecast
export const NAV: { id: View; icon: JSX.Element }[] = [
  { id: 'overview',     icon: <IconOverview /> },
  { id: 'accounts',     icon: <IconAccounts /> },
  { id: 'transactions', icon: <IconTransactions /> },
  { id: 'budget',       icon: <IconBudget /> },
  { id: 'goals',        icon: <IconGoals /> },
  { id: 'recurring',    icon: <IconRecurring /> },
  { id: 'analytics',    icon: <IconAnalytics /> },
  { id: 'forecast',     icon: <IconForecast /> },
];

export function Sidebar({ active, onNav, mobileOpen = false }: { active: View; onNav: (v: View) => void; mobileOpen?: boolean }) {
  const { currency, setCurrency, lang, setLang, ratesUpdatedAt, ratesLive, rates } = useSettings();
  const rateOf = (c: Currency) => rates[c];
  const fmtRate = (v: number) => v.toLocaleString(locale(), { maximumFractionDigits: v < 10 ? 2 : 0 });
  const { period, isCurrentMonth } = useFinance();
  const [open, setOpen] = useState(false);
  const monthPct = (period.current / period.total) * 100;

  return (
    <aside className={`sidebar${mobileOpen ? ' open' : ''}`} style={{
      width: 232, flexShrink: 0, height: '100%', background: 'var(--color-sidebar)',
      borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '24px 20px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <PomeMark size={34} />
        <div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600, letterSpacing: '0.14em', lineHeight: 1 }}>POME</div>
          <div style={{ fontSize: 10, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--color-ink-3)', marginTop: 5 }}>
            {monthName(period)} {period.year}
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: '14px 12px', overflowY: 'auto' }}>
        {NAV.map(item => {
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              className={isActive ? undefined : 'nav-btn'}
              onClick={() => onNav(item.id)}
              aria-current={isActive ? 'page' : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '8px 12px', marginBottom: 2,
                borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: isActive ? 500 : 400, textAlign: 'left',
                color: isActive ? 'var(--color-ink)' : 'var(--color-ink-2)',
                background: isActive ? 'var(--color-card)' : 'transparent',
                border: isActive ? '1px solid var(--line)' : '1px solid transparent',
                boxShadow: isActive ? 'var(--shadow-card)' : 'none',
              }}
            >
              <span style={{ display: 'flex', color: isActive ? 'var(--color-accent)' : 'var(--color-ink-3)' }}>{item.icon}</span>
              {t(`nav.${item.id}` as const)}
            </button>
          );
        })}
      </nav>

      <div style={{ padding: '16px 16px 22px', borderTop: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7, fontSize: 11 }}>
          <span style={{ letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-3)' }}>{t('month')}</span>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-ink-2)' }}>{isCurrentMonth ? t('dayOf', { d: period.current, n: period.total }) : t('monthClosed')}</span>
        </div>
        <div style={{ height: 4, background: 'var(--line)', borderRadius: 4, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ height: '100%', width: `${monthPct}%`, background: 'var(--color-ink-2)', borderRadius: 4 }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-3)' }}>{t('language')}</span>
          <div role="radiogroup" aria-label={t('language')} style={{ display: 'flex', border: '1px solid var(--line-strong)', borderRadius: 8, overflow: 'hidden', background: 'var(--color-card)' }}>
            {LANGS.map((l, i) => (
              <button key={l} role="radio" aria-checked={lang === l} onClick={() => setLang(l)} style={{
                padding: '4px 10px', border: 'none', borderLeft: i ? '1px solid var(--line-strong)' : 'none',
                fontSize: 11, fontWeight: 500, fontFamily: 'var(--font-mono)', cursor: 'pointer',
                background: lang === l ? 'var(--color-ink)' : 'transparent', color: lang === l ? '#fff' : 'var(--color-ink-2)',
              }}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div style={{ position: 'relative' }}>
          <button onClick={() => setOpen(p => !p)} aria-expanded={open} style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px',
            border: '1px solid var(--line-strong)', borderRadius: 10, background: 'var(--color-card)',
            cursor: 'pointer', fontSize: 13, color: 'var(--color-ink)',
          }}>
            <span style={{ width: 20, fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}>{currencySymbol(currency)}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{currency}</span>
            <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--color-ink-3)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}>▼</span>
          </button>
          {open && (
            <div className="cur-menu" style={{
              position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, right: -150, background: 'var(--color-card)',
              border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--shadow-hover)', zIndex: 50,
            }}>
              {CURRENCIES.map((c, i) => (
                <button key={c} className="row-hover" onClick={() => { setCurrency(c); setOpen(false); }} style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px', border: 'none',
                  borderTop: i ? '1px solid var(--color-border-light)' : 'none',
                  background: c === currency ? 'var(--color-bg)' : 'transparent',
                  cursor: 'pointer', fontSize: 13, color: 'var(--color-ink)', textAlign: 'left',
                }}>
                  <span style={{ width: 20, fontFamily: 'var(--font-mono)', color: 'var(--color-ink-2)' }}>{currencySymbol(c)}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, width: 34 }}>{c}</span>
                  <span style={{ fontSize: 12, color: 'var(--color-ink-3)', whiteSpace: 'nowrap' }}>{currencyName(c)}</span>
                  <span style={{ marginLeft: 'auto', paddingLeft: 12, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-ink-3)', whiteSpace: 'nowrap' }}>
                    {c !== 'USD' && `1 $ = ${fmtRate(rateOf(c))} ${currencySymbol(c)}`}
                  </span>
                  <span style={{ width: 12, color: 'var(--color-accent)' }}>{c === currency ? '✓' : ''}</span>
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--color-ink-3)', marginTop: 6, paddingLeft: 2 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: ratesLive ? 'var(--color-positive)' : 'var(--color-ink-3)' }} />
            {t(ratesLive ? 'ratesLive' : 'ratesFixed', { d: new Date(ratesUpdatedAt).toLocaleDateString(locale(), { day: 'numeric', month: 'short' }) })}
          </div>
        </div>
      </div>
    </aside>
  );
}
