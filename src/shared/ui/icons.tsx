import type { ReactNode } from 'react';

const Svg = ({ children }: { children: ReactNode }) => (
  <svg width="16" height="16" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

export const IconOverview = () => (
  <Svg>
    <rect x="1" y="1" width="5.5" height="5.5" rx="1.5"/><rect x="8.5" y="1" width="5.5" height="5.5" rx="1.5"/>
    <rect x="1" y="8.5" width="5.5" height="5.5" rx="1.5"/><rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1.5"/>
  </Svg>
);
export const IconAccounts = () => <Svg><rect x="1" y="3" width="13" height="9.5" rx="2"/><path d="M1 6h13M10 9.25h1.5"/></Svg>;
export const IconTransactions = () => <Svg><path d="M2 4.5h11M2 7.5h7M2 10.5h5"/></Svg>;
export const IconBudget = () => <Svg><path d="M1 3.5h13M1 7.5h13M1 11.5h13"/><path d="M4 2v3M9 6v3M6 10v3"/></Svg>;
export const IconGoals = () => <Svg><circle cx="7.5" cy="7.5" r="6"/><circle cx="7.5" cy="7.5" r="3"/></Svg>;
export const IconRecurring = () => <Svg><path d="M12.5 5.5A5.5 5.5 0 0 0 2.4 5M2.5 9.5a5.5 5.5 0 0 0 10.1.5"/><path d="M12.8 2.5v3h-3M2.2 12.5v-3h3"/></Svg>;
export const IconAnalytics = () => <Svg><path d="M1.5 11V5M5.5 11V8M9.5 11V6M13.5 11V9.5M0.75 12.5h13.5"/></Svg>;
export const IconForecast = () => <Svg><path d="M1 12l4-4 3 2 6-6"/><path d="M10 4h4v4"/></Svg>;

/** Brand mark — pomegranate */
export function PomeMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M26.5 21 C25.5 16.5 23.5 12.5 21.5 9.5 C25 10.5 27.5 12.2 29 14 L32 7.5 L35 14 C36.5 12.2 39 10.5 42.5 9.5 C40.5 12.5 38.5 16.5 37.5 21 Z" fill="var(--color-brand)" />
      <circle cx="32" cy="37" r="20" fill="var(--color-brand)" />
      <path d="M37 22.5 C47.5 25 52 36 49.5 45 C47.5 52 40.5 55.5 36.5 53 C31 46 31 31 37 22.5 Z" fill="var(--color-brand-flesh)" />
      <ellipse cx="41.5" cy="31" rx="3" ry="3.6" fill="var(--color-brand-seed)" />
      <ellipse cx="46" cy="38.5" rx="2.6" ry="3.4" fill="var(--color-brand-seed)" />
      <ellipse cx="39.5" cy="39.5" rx="3" ry="3.6" fill="var(--color-brand-seed)" />
      <ellipse cx="42.5" cy="47.5" rx="3" ry="3.2" fill="var(--color-brand-seed)" />
    </svg>
  );
}
