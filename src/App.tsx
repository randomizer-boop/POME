// ─── App shell: providers + layout + view switch ──────────────────────────────
// Features live in src/modules/<feature>/ (logic.ts = pure functions, *Page.tsx = UI).
// Data lives in src/store (FinanceStore = state/actions, useMonthSummary = derived numbers).

import { useCallback, useEffect, useState, type CSSProperties, type JSX, type ReactNode } from 'react';
import type { View } from './shared/types';
import { t } from './shared/i18n';
import { SettingsProvider, useSettings } from './store/Settings';
import { FinanceProvider, useFinance } from './store/FinanceStore';
import { SessionProvider, useSession } from './store/Session';
import { AuthScreen } from './app/AuthScreen';
import { UserMenu } from './app/UserMenu';
import { DemoBanner, NoticeToast } from './app/Notices';
import { LoadingScreen } from './app/LoadingScreen';
import { MonthSwitcher } from './app/MonthSwitcher';
import { Sidebar } from './app/Sidebar';
import { PomegranateTree } from './shared/ui/PomegranateTree';
import { QuickAdd } from './modules/transactions/QuickAdd';
import { OverviewPage } from './modules/overview/OverviewPage';
import { AccountsPage } from './modules/accounts/AccountsPage';
import { TransactionsPage } from './modules/transactions/TransactionsPage';
import { BudgetPage } from './modules/budget/BudgetPage';
import { GoalsPage } from './modules/goals/GoalsPage';
import { RecurringPage } from './modules/recurring/RecurringPage';
import { AnalyticsPage } from './modules/analytics/AnalyticsPage';
import { ForecastPage } from './modules/forecast/ForecastPage';

const PAGES: Record<View, (props: { viewKey: number; onNav: (v: View) => void }) => JSX.Element> = {
  overview: OverviewPage,
  accounts: AccountsPage,
  transactions: TransactionsPage,
  budget: BudgetPage,
  goals: GoalsPage,
  recurring: RecurringPage,
  analytics: AnalyticsPage,
  forecast: ForecastPage,
};

const TREE_STYLE: CSSProperties = { position: 'absolute', right: -30, bottom: -8, height: '92%', maxHeight: 960, opacity: 0.55, zIndex: 0 };

function Shell() {
  // Subscribing to settings makes the whole shell re-render on language/currency change
  useSettings();
  const [view, setView] = useState<View>('overview');
  const [viewKey, setViewKey] = useState(0);
  const [navOpen, setNavOpen] = useState(false);
  const onNav = useCallback((v: View) => { setView(v); setViewKey(k => k + 1); setNavOpen(false); }, []);
  const Page = PAGES[view];
  const { loading, loadError, reload } = useFinance();

  return (
    <div className="app-root" style={{ display: 'flex', overflow: 'hidden', background: 'var(--color-bg)' }}>
      <Sidebar active={view} onNav={onNav} mobileOpen={navOpen} />
      {navOpen && <div className="nav-backdrop m-only" onClick={() => setNavOpen(false)} aria-hidden="true" />}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        <DemoBanner />
        {/* brand motif behind the content; cards are frosted glass so it shows through softly */}
        <PomegranateTree style={TREE_STYLE} groundLeft={1600} className="bg-tree" />
        {/* above <main>: the account menu drops down over the page */}
        <header className="app-header" style={{
          position: 'relative', zIndex: 20,
          height: 56, flexShrink: 0, borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 36px',
        }}>
          <div style={{ fontSize: 13, color: 'var(--color-ink-3)', display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <button className="icon-btn m-only" onClick={() => setNavOpen(true)} aria-label={t('menu')} style={{ width: 34, height: 34 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            </button>
            <span className="m-hide">POME <span style={{ margin: '0 6px' }}>/</span></span>
            <span style={{ color: 'var(--color-ink)', fontWeight: 500 }}>{t(`nav.${view}` as const)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MonthSwitcher />
            <QuickAdd />
            <span className="m-hide" style={{ width: 1, height: 20, background: 'var(--line)', margin: '0 6px' }} />
            <UserMenu onGoHome={() => onNav('overview')} />
          </div>
        </header>
        <main key={viewKey} style={{ flex: 1, overflowY: 'auto', position: 'relative', zIndex: 1 }}>
          {loading ? <LoadingScreen />
            : loadError ? (
              <Centered>
                <div>{t('loadFailed')}</div>
                <div style={{ fontSize: 12, color: 'var(--color-ink-3)', maxWidth: 420 }}>{loadError}</div>
                <button className="link-btn" onClick={reload}>{t('retry')}</button>
              </Centered>
            ) : <Page viewKey={viewKey} onNav={onNav} />}
        </main>
        <NoticeToast />
      </div>
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div style={{ height: '100%', minHeight: 240, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, textAlign: 'center', padding: 24, fontSize: 14, color: 'var(--color-ink-2)' }}>
      {children}
    </div>
  );
}

/** Signed out → login; demo or signed in → the app */
function Root() {
  useSettings();
  const { status } = useSession();
  // keep the splash at least ~0.9 s so it doesn't just flash
  const [minShown, setMinShown] = useState(false);
  useEffect(() => { const id = setTimeout(() => setMinShown(true), 900); return () => clearTimeout(id); }, []);
  if (status === 'loading' || !minShown) return <LoadingScreen fullScreen />;
  if (status === 'signedOut') return <AuthScreen />;
  return <Shell />;
}

export default function App() {
  return (
    <SettingsProvider>
      <SessionProvider>
        <FinanceProvider>
          <Root />
        </FinanceProvider>
      </SessionProvider>
    </SettingsProvider>
  );
}
