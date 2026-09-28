import { useEffect, useState } from 'react';
import { t } from '../shared/i18n';

const TIPS = ['loadTip1', 'loadTip2', 'loadTip3', 'loadTip4'] as const;
const SEEDS: [number, number][] = [[24, 34], [32, 30], [40, 34], [20, 42], [28, 41], [36, 41], [44, 42], [24, 50], [32, 49], [40, 50]];

/** A pomegranate that "ripens": the fruit fills up, seeds pop in, tips rotate underneath */
export function LoadingScreen({ fullScreen = false }: { fullScreen?: boolean }) {
  const [tip, setTip] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTip(i => (i + 1) % TIPS.length), 1800);
    return () => clearInterval(id);
  }, []);

  return (
    <div role="status" aria-live="polite" style={{
      height: fullScreen ? '100vh' : '100%', minHeight: 320, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 18, background: fullScreen ? 'var(--color-bg)' : 'transparent',
    }}>
      <svg width="104" height="104" viewBox="0 0 64 64" aria-hidden="true" className="pome-bob">
        <defs>
          <clipPath id="pome-fruit"><circle cx="32" cy="40" r="19" /></clipPath>
        </defs>
        {/* crown */}
        <path d="M26.5 23 C25.5 18.5 23.5 14.5 21.5 11.5 C25 12.5 27.5 14.2 29 16 L32 9.5 L35 16 C36.5 14.2 39 12.5 42.5 11.5 C40.5 14.5 38.5 18.5 37.5 23 Z" fill="var(--color-brand)" />
        {/* empty fruit + the colour rising inside it */}
        <circle cx="32" cy="40" r="19" fill="var(--color-brand-flesh)" stroke="var(--color-brand)" strokeWidth="1.5" />
        <g clipPath="url(#pome-fruit)">
          <rect className="pome-fill" x="12" y="21" width="40" height="38" fill="var(--color-brand)" opacity="0.18" />
        </g>
        {SEEDS.map(([cx, cy], i) => (
          <ellipse key={i} className="pome-seed" cx={cx} cy={cy} rx="2.6" ry="3.2" fill="var(--color-brand-seed)" style={{ animationDelay: `${i * 0.14}s` }} />
        ))}
        <ellipse cx="25" cy="30" rx="3" ry="5" fill="#fff" opacity="0.35" transform="rotate(25 25 30)" />
      </svg>

      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 600, letterSpacing: '0.18em' }}>POME</div>

      <div style={{ width: 160, height: 3, borderRadius: 3, background: 'var(--color-surface)', overflow: 'hidden' }}>
        <div className="pome-bar" style={{ width: '40%', height: '100%', borderRadius: 3, background: 'var(--color-brand)' }} />
      </div>

      <div key={tip} className="pome-tip" style={{ fontSize: 13, color: 'var(--color-ink-2)', minHeight: 18 }}>{t(TIPS[tip])}</div>
    </div>
  );
}
