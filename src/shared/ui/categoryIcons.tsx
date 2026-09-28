// Small line icons per category — the "distinctive mark" of a row

import type { ReactNode } from 'react';
import { colorOf } from '../categories';

const P = ({ children }: { children: ReactNode }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

const ICONS: Record<string, ReactNode> = {
  Housing:         <P><path d="M2.5 7.5 8 3l5.5 4.5V13a.5.5 0 0 1-.5.5H9.5v-3.5h-3v3.5H3a.5.5 0 0 1-.5-.5z"/></P>,
  Utilities:       <P><path d="M9 1.5 3.5 9H8l-1 5.5L12.5 7H8z"/></P>,
  Subscriptions:   <P><rect x="2" y="3.5" width="12" height="9" rx="2"/><path d="m7 6.3 2.8 1.7L7 9.7z" fill="currentColor"/></P>,
  Health:          <P><path d="M8 13.5S2.5 10.2 2.5 6.3A2.8 2.8 0 0 1 8 5a2.8 2.8 0 0 1 5.5 1.3C13.5 10.2 8 13.5 8 13.5z"/></P>,
  'Work & Tools':  <P><rect x="2" y="5" width="12" height="8" rx="1.5"/><path d="M5.5 5V3.5h5V5M2 8.5h12"/></P>,
  Transport:       <P><path d="M3 10.5V7l1.3-3h7.4L13 7v3.5M3 10.5h10M3 10.5V12M13 10.5V12"/><circle cx="5.5" cy="8.8" r=".6" fill="currentColor"/><circle cx="10.5" cy="8.8" r=".6" fill="currentColor"/></P>,
  Groceries:       <P><path d="M2 3h2l1.5 7.5h7L14 5H5"/><circle cx="6.5" cy="13" r=".8"/><circle cx="11.5" cy="13" r=".8"/></P>,
  Dining:          <P><path d="M5 2v5a1.5 1.5 0 0 0 3 0V2M6.5 7v7M11 2c-1.5 1-2 3-2 5h2v7"/></P>,
  Shopping:        <P><path d="M3 5h10l-.8 8.5H3.8zM5.5 5a2.5 2.5 0 0 1 5 0"/></P>,
  'Personal Care': <P><path d="M8 2c2 2.5 4 4.8 4 7a4 4 0 0 1-8 0c0-2.2 2-4.5 4-7z"/></P>,
  'Family & Gifts': <P><rect x="2.5" y="6" width="11" height="7.5" rx="1"/><path d="M2 6h12M8 6v7.5M8 6C6.5 3 4 3.5 4.8 5.2 5.3 6 8 6 8 6zm0 0c1.5-3 4-2.5 3.2-.8C10.7 6 8 6 8 6z"/></P>,
  Other:           <P><circle cx="4" cy="8" r=".9" fill="currentColor"/><circle cx="8" cy="8" r=".9" fill="currentColor"/><circle cx="12" cy="8" r=".9" fill="currentColor"/></P>,
  Income:          <P><path d="M8 13V3M4 7l4-4 4 4"/></P>,
};

/** Rounded tile with the category icon, tinted with the category color */
export function CategoryBadge({ category, size = 36 }: { category: string; size?: number }) {
  const color = colorOf(category);
  return (
    <span style={{
      width: size, height: size, borderRadius: size * 0.32, flexShrink: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      color, background: `color-mix(in srgb, ${color} 13%, white)`,
      border: `1px solid color-mix(in srgb, ${color} 22%, white)`,
    }}>
      {ICONS[category] ?? <span style={{ fontSize: size * 0.4, fontWeight: 600 }}>{category.charAt(0)}</span>}
    </span>
  );
}
