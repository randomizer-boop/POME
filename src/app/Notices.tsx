import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../shared/i18n';
import { useFinance } from '../store/FinanceStore';
import { useSession } from '../store/Session';

/** Slim bar on top of the content in demo mode */
export function DemoBanner() {
  const { status, exitDemo } = useSession();
  if (status !== 'demo') return null;
  return (
    <div className="demo-banner" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '8px 16px', fontSize: 13,
      background: 'var(--color-accent-soft)', color: 'var(--color-ink)', borderBottom: '1px solid var(--line)', position: 'relative', zIndex: 1,
    }}>
      <span className="m-hide">{t('demoBanner')}</span>
      <span className="m-only">{t('demoBannerShort')}</span>
      <button className="link-btn" onClick={exitDemo} style={{ background: 'var(--color-card)' }}>{t('signUp')}</button>
    </div>
  );
}

/** Toast for "demo is read-only" and save errors */
export function NoticeToast() {
  const { notice, dismissNotice } = useFinance();
  const { exitDemo } = useSession();

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(dismissNotice, 6000);
    return () => clearTimeout(id);
  }, [notice, dismissNotice]);

  if (!notice) return null;
  return createPortal(
    <div role="status" className="toast" style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 60, display: 'flex', alignItems: 'center', gap: 14,
      padding: '10px 12px 10px 16px', borderRadius: 12, fontSize: 13, boxShadow: 'var(--shadow-hover)', maxWidth: 'calc(100vw - 32px)',
      background: notice.kind === 'error' ? 'var(--color-negative)' : 'var(--color-ink)', color: '#fff',
    }}>
      <span>{notice.kind === 'readOnly' ? t('readOnlyNotice') : t('saveFailed', { x: notice.message })}</span>
      {notice.kind === 'readOnly' && (
        <button onClick={() => { dismissNotice(); exitDemo(); }} style={{ border: '1px solid rgba(255,255,255,0.35)', background: 'transparent', color: '#fff', borderRadius: 8, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>
          {t('signUp')}
        </button>
      )}
      <button onClick={dismissNotice} aria-label={t('close')} style={{ border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 14 }}>✕</button>
    </div>,
    document.body,
  );
}
