// ─── Sign-in / sign-up screen + entry to the read-only demo ──────────────────

import { useState, type FormEvent } from 'react';
import { LANGS, t } from '../shared/i18n';
import { Field, fieldStyle } from '../shared/ui/primitives';
import { PomeMark } from '../shared/ui/icons';
import { PomegranateTree } from '../shared/ui/PomegranateTree';
import { useSession } from '../store/Session';
import { useSettings } from '../store/Settings';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.2 5.2C37 38.2 44 33 44 24c0-1.3-.1-2.4-.4-3.5z"/>
  </svg>
);

export function AuthScreen() {
  const { canSignIn, signInWithGoogle, signInWithEmail, signUpWithEmail, enterDemo } = useSession();
  const { lang, setLang } = useSettings();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'signUp' && !name.trim()) return setError(t('errYourName'));
    if (!EMAIL_RE.test(email.trim())) return setError(t('errEmail'));
    if (password.length < 8) return setError(t('errPassword'));
    setBusy(true);
    setError(null);
    const err = mode === 'signIn'
      ? await signInWithEmail(email.trim(), password)
      : await signUpWithEmail(name.trim(), email.trim(), password);
    setBusy(false);
    if (err) setError(t('authFailed', { x: err }));
  };

  const google = async () => {
    setBusy(true);
    const err = await signInWithGoogle();
    if (err) { setBusy(false); setError(t('authFailed', { x: err })); }
  };

  return (
    <div className="auth-grid" style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(360px, 1fr)', background: 'var(--color-bg)' }}>
      {/* brand side */}
      <div className="auth-brand" style={{ position: 'relative', overflow: 'hidden', borderRight: '1px solid var(--line)', background: 'var(--color-sidebar)' }}>
        <div style={{ position: 'absolute', top: 32, left: 36, display: 'flex', alignItems: 'center', gap: 10, zIndex: 1 }}>
          <PomeMark size={36} />
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 600, letterSpacing: '0.14em' }}>POME</span>
        </div>
        <p style={{
          position: 'absolute', top: 96, left: 36, right: 36, zIndex: 1, margin: 0, maxWidth: 440,
          fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 26, lineHeight: 1.3, color: 'var(--color-ink)',
        }}>
          {t('authTagline')}
        </p>
        <PomegranateTree groundLeft={600} groundRight={600} style={{ position: 'absolute', left: '50%', bottom: -6, transform: 'translateX(-50%)', height: '74%', opacity: 0.9 }} />
      </div>

      {/* form side */}
      <div className="auth-form" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 48px', position: 'relative' }}>
        <div role="radiogroup" aria-label={t('language')} style={{ position: 'absolute', top: 24, right: 24, display: 'flex', border: '1px solid var(--line-strong)', borderRadius: 8, overflow: 'hidden' }}>
          {LANGS.map((l, i) => (
            <button key={l} role="radio" aria-checked={lang === l} onClick={() => setLang(l)} style={{
              padding: '4px 10px', border: 'none', borderLeft: i ? '1px solid var(--line-strong)' : 'none', fontSize: 11,
              fontFamily: 'var(--font-mono)', cursor: 'pointer', background: lang === l ? 'var(--color-ink)' : 'var(--color-card)',
              color: lang === l ? '#fff' : 'var(--color-ink-2)',
            }}>{l.toUpperCase()}</button>
          ))}
        </div>

        <div style={{ width: '100%', maxWidth: 380, margin: '0 auto' }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 34, fontWeight: 500, margin: '0 0 22px' }}>
            {mode === 'signIn' ? t('signIn') : t('signUp')}
          </h1>

          {!canSignIn && (
            <div style={{ fontSize: 13, color: 'var(--color-caution)', background: 'var(--color-card)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px', marginBottom: 16 }}>
              {t('backendMissing')}
            </div>
          )}

          <button type="button" onClick={google} disabled={!canSignIn || busy} style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '11px 14px',
            borderRadius: 12, border: '1px solid var(--line-strong)', background: 'var(--color-card)', fontSize: 14, fontWeight: 500,
            cursor: canSignIn ? 'pointer' : 'not-allowed', opacity: canSignIn ? 1 : 0.55, color: 'var(--color-ink)',
          }}>
            <GoogleIcon />{t('continueGoogle')}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0', fontSize: 12, color: 'var(--color-ink-3)' }}>
            <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />{t('orWord')}<span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
          </div>

          <form onSubmit={submit} noValidate>
            {mode === 'signUp' && (
              <Field label={t('yourName')} style={{ marginBottom: 12 }}>
                <input value={name} onChange={e => { setName(e.target.value); setError(null); }} autoComplete="name" style={fieldStyle} />
              </Field>
            )}
            <Field label={t('emailLabel')} style={{ marginBottom: 12 }}>
              <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError(null); }} autoComplete="email" style={fieldStyle} />
            </Field>
            <Field label={t('password')} style={{ marginBottom: 16 }}>
              <input type="password" value={password} onChange={e => { setPassword(e.target.value); setError(null); }}
                autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'} style={fieldStyle} />
            </Field>
            {error && <div role="alert" style={{ fontSize: 13, color: 'var(--color-negative)', marginBottom: 12 }}>{error}</div>}
            <button type="submit" disabled={!canSignIn || busy} style={{
              width: '100%', padding: '11px 14px', borderRadius: 12, border: '1px solid var(--color-ink)', background: 'var(--color-ink)',
              color: '#fff', fontSize: 14, fontWeight: 500, cursor: canSignIn ? 'pointer' : 'not-allowed', opacity: canSignIn && !busy ? 1 : 0.6,
            }}>
              {mode === 'signIn' ? t('signIn') : t('signUp')}
            </button>
          </form>

          <div style={{ fontSize: 13, color: 'var(--color-ink-2)', marginTop: 14, textAlign: 'center' }}>
            {mode === 'signIn' ? t('noAccount') : t('haveAccount')}{' '}
            <button onClick={() => { setMode(m => (m === 'signIn' ? 'signUp' : 'signIn')); setError(null); }} style={{
              border: 'none', background: 'none', padding: 0, color: 'var(--color-accent)', cursor: 'pointer', fontSize: 13, textDecoration: 'underline', textUnderlineOffset: 2,
            }}>
              {mode === 'signIn' ? t('signUp') : t('signIn')}
            </button>
          </div>

          <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--line)', textAlign: 'center' }}>
            <button onClick={enterDemo} className="link-btn" style={{ padding: '8px 18px', fontSize: 13 }}>{t('tryDemo')} →</button>
            <div style={{ fontSize: 11, color: 'var(--color-ink-3)', marginTop: 6 }}>{t('demoHint')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
