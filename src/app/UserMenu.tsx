import { useEffect, useRef, useState } from 'react';
import { t } from '../shared/i18n';
import { useSession } from '../store/Session';
import { showGuide } from '../modules/onboarding/OnboardingGuide';

/** Header: account avatar + sign out; in demo — a badge and a sign-up button */
export function UserMenu({ onGoHome }: { onGoHome?: () => void }) {
  const { status, user, signOut, signOutEverywhere, exitDemo } = useSession();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // close on click outside / Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  if (status === 'demo') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-accent)', border: '1px solid var(--color-accent)', borderRadius: 6, padding: '2px 8px' }}>
          {t('demoBadge')}
        </span>
        <button className="link-btn m-hide" onClick={exitDemo}>{t('signUp')}</button>
      </div>
    );
  }
  if (!user) return null;

  const initials = user.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div ref={box} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} style={{ display: 'flex', alignItems: 'center', gap: 10, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>
        <span className="m-hide" style={{ fontSize: 13, color: 'var(--color-ink-2)' }}>{user.name}</span>
        {user.image
          ? <img src={user.image} alt="" width={32} height={32} style={{ borderRadius: '50%', border: '1px solid var(--line-strong)' }} referrerPolicy="no-referrer" />
          : <span style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--line-strong)', background: 'var(--color-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 500, color: 'var(--color-ink)' }}>{initials}</span>}
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', minWidth: 220, background: 'var(--color-card)', border: '1px solid var(--line)', borderRadius: 12, boxShadow: 'var(--shadow-hover)', zIndex: 40, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--color-ink-3)', borderBottom: '1px solid var(--line)' }}>{user.email}</div>
          <button className="row-hover" onClick={() => { setOpen(false); showGuide(user.id); onGoHome?.(); }} style={{ width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', borderBottom: '1px solid var(--line)', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--color-ink)' }}>
            {t('howToStart')}
          </button>
          <button className="row-hover" onClick={() => { setOpen(false); void signOut(); }} style={{ width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', borderBottom: '1px solid var(--line)', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--color-ink)' }}>
            {t('signOut')}
          </button>
          <button className="row-hover" onClick={() => { setOpen(false); void signOutEverywhere(); }} style={{ width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--color-negative)' }}>
            {t('signOutAll')}
          </button>
        </div>
      )}
    </div>
  );
}
