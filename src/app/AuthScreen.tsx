// ─── Sign-in / sign-up screen + entry to the read-only demo ──────────────────

import { useEffect, useState, type FormEvent } from 'react';
import { authErrorKey, passwordProblem, sanitizeCode, type AuthErrorKey, type PasswordProblem } from '../shared/security';
import { LANGS, t } from '../shared/i18n';
import { Field, fieldStyle } from '../shared/ui/primitives';
import { PomeMark } from '../shared/ui/icons';
import { PomegranateTree } from '../shared/ui/PomegranateTree';
import { Deer } from '../shared/ui/Deer';
import { useSession } from '../store/Session';
import { useSettings } from '../store/Settings';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PW_TEXT: Record<Exclude<PasswordProblem, null>, 'pwShort' | 'pwWeak' | 'pwPersonal' | 'pwCommon'> = {
  short: 'pwShort', weak: 'pwWeak', personal: 'pwPersonal', common: 'pwCommon',
};
const RESEND_AFTER = 60; // seconds
type Mode = 'signIn' | 'signUp' | 'code' | 'reset';

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.2 5.2C37 38.2 44 33 44 24c0-1.3-.1-2.4-.4-3.5z"/>
  </svg>
);

export function AuthScreen() {
  const { canSignIn, signInWithGoogle, signInWithEmail, signUpWithEmail, sendEmailCode, signInWithCode,
    sendResetCode, resetPassword, verifyEmailAndSignIn, signedOutForIdle, enterDemo } = useSession();
  const { lang, setLang } = useSettings();
  // signIn: email + password · signUp · code: passwordless · reset: forgot / set a password
  const [mode, setMode] = useState<Mode>('signIn');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  /** where the code went; null = not sent yet. After sign-up the code confirms the email */
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState<{ text: string; key: AuthErrorKey } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = window.setTimeout(() => setResendIn(n => n - 1), 1000);
    return () => window.clearTimeout(id);
  }, [resendIn]);

  const fail = (err: string) => {
    const key = authErrorKey(err);
    setError({ key, text: key ? t(key) : t('authFailed', { x: err }) });
  };
  const localError = (text: string) => setError({ text, key: null });
  const [info, setInfo] = useState<string | null>(null);
  // switching screens never carries a typed password over (e.g. into "new password")
  const go = (m: Mode) => { setMode(m); setError(null); setInfo(null); setCodeSentTo(null); setCode(''); setVerifying(false); setPassword(''); };

  const sendCode = async (kind: 'sign-in' | 'reset', to = email.trim()) => {
    if (!EMAIL_RE.test(to)) return localError(t('errEmail'));
    setBusy(true); setError(null);
    const err = kind === 'reset' ? await sendResetCode(to) : await sendEmailCode(to);
    setBusy(false);
    if (err) return fail(err);
    setCodeSentTo(to); setCode(''); setResendIn(RESEND_AFTER);
  };

  const run = async (p: Promise<string | null>) => {
    setBusy(true); setError(null);
    const err = await p;
    setBusy(false);
    if (err) fail(err);
    return err;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const mail = email.trim();
    // a code was sent → check it
    if (codeSentTo) {
      if (code.length !== 6) return localError(t('errCode'));
      if (mode === 'reset') {
        const problem = passwordProblem(password, codeSentTo);
        if (problem) return localError(t(PW_TEXT[problem]));
        const err = await run(resetPassword(codeSentTo, code, password));
        if (!err) { const mail = codeSentTo; go('signIn'); setEmail(mail); setInfo(t('passwordSaved')); }
        return;
      }
      if (verifying) return void run(verifyEmailAndSignIn(codeSentTo, code, password));
      return void run(signInWithCode(codeSentTo, code));
    }
    if (mode === 'code') return sendCode('sign-in');
    if (mode === 'reset') return sendCode('reset');

    if (mode === 'signUp' && !name.trim()) return localError(t('errYourName'));
    if (!EMAIL_RE.test(mail)) return localError(t('errEmail'));
    if (mode === 'signUp') {
      const problem = passwordProblem(password, mail);
      if (problem) return localError(t(PW_TEXT[problem]));
      setBusy(true); setError(null);
      const err = await signUpWithEmail(name.trim(), mail, password);
      setBusy(false);
      if (err === 'NEEDS_VERIFICATION') { setVerifying(true); setCodeSentTo(mail); setResendIn(RESEND_AFTER); return; }
      if (err) fail(err);
      return;
    }
    if (password.length < 8) return localError(t('errPassword'));
    void run(signInWithEmail(mail, password));
  };

  const google = async () => {
    setBusy(true);
    const err = await signInWithGoogle();
    if (err) { setBusy(false); fail(err); }
  };

  const linkBtn = { border: 'none', background: 'none', padding: 0, color: 'var(--color-accent)', cursor: 'pointer', fontSize: 13, textDecoration: 'underline', textUnderlineOffset: 2 } as const;
  const title = mode === 'signUp' ? t('signUp') : mode === 'reset' ? t('resetTitle') : t('signIn');
  const submitLabel = codeSentTo
    ? (mode === 'reset' ? t('savePasswordAndSignIn') : verifying ? t('confirmEmail') : t('signIn'))
    : mode === 'code' || mode === 'reset' ? t('sendCode') : mode === 'signUp' ? t('signUp') : t('signIn');
  const showPassword = mode === 'signIn' || (mode === 'signUp' && !verifying) || (mode === 'reset' && !!codeSentTo);

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
        {/* mascot: the deer resting by the tree */}
        <Deer className="auth-deer" style={{ position: 'absolute', left: 'calc(50% + 11%)', bottom: 14, height: '19%', width: 'auto' }} />
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
            {title}
          </h1>

          {signedOutForIdle && (
            <div role="status" style={{ fontSize: 13, color: 'var(--color-ink-2)', background: 'var(--color-accent-soft)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px', marginBottom: 16, lineHeight: 1.45 }}>
              {t('idleSignedOut')}
            </div>
          )}

          {!canSignIn && (
            <div style={{ fontSize: 13, color: 'var(--color-caution)', background: 'var(--color-card)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px', marginBottom: 16 }}>
              {t('backendMissing')}
            </div>
          )}

          {mode !== 'reset' && (
            <>
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
            </>
          )}
          {mode === 'reset' && !codeSentTo && (
            <p style={{ fontSize: 13, color: 'var(--color-ink-2)', margin: '-8px 0 16px', lineHeight: 1.5 }}>{t('resetHint')}</p>
          )}

          <form onSubmit={submit} noValidate>
            {mode === 'signUp' && !verifying && (
              <Field label={t('yourName')} style={{ marginBottom: 12 }}>
                <input maxLength={80} value={name} onChange={e => { setName(e.target.value); setError(null); }} autoComplete="name" style={fieldStyle} />
              </Field>
            )}
            <Field label={t('emailLabel')} style={{ marginBottom: 12 }}>
              <input type="email" maxLength={254} value={email} onChange={e => { setEmail(e.target.value); setError(null); if (codeSentTo) { setCodeSentTo(null); setVerifying(false); } }} autoComplete="email" style={fieldStyle} />
            </Field>

            {codeSentTo && (
              <>
                <div style={{ fontSize: 12, color: 'var(--color-ink-2)', margin: '-2px 0 10px', lineHeight: 1.45 }}>{t(verifying ? 'verifySent' : 'codeSent', { e: codeSentTo })}</div>
                <Field label={t('codeLabel')} style={{ marginBottom: 8 }}>
                  <input autoFocus inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e => { setCode(sanitizeCode(e.target.value)); setError(null); }}
                    style={{ ...fieldStyle, fontFamily: 'var(--font-mono)', letterSpacing: '0.3em', fontSize: 18 }} />
                </Field>
                {!verifying && (
                  <div style={{ fontSize: 12, marginBottom: 14 }}>
                    {resendIn > 0
                      ? <span style={{ color: 'var(--color-ink-3)' }}>{t('resendIn', { n: resendIn })}</span>
                      : <button type="button" onClick={() => sendCode(mode === 'reset' ? 'reset' : 'sign-in', codeSentTo)} disabled={busy} style={{ ...linkBtn, fontSize: 12 }}>{t('resendCode')}</button>}
                  </div>
                )}
              </>
            )}

            {showPassword && (
              <Field label={mode === 'reset' ? t('newPassword') : t('password')} style={{ marginBottom: mode === 'signIn' ? 6 : 6 }}>
                <input type="password" maxLength={128} value={password} onChange={e => { setPassword(e.target.value); setError(null); }}
                  name={mode === 'signIn' ? 'password' : 'new-password'}
                  autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'} style={fieldStyle} />
              </Field>
            )}
            {showPassword && mode !== 'signIn' && <div style={{ fontSize: 11, color: 'var(--color-ink-3)', marginBottom: 14 }}>{t('pwHint')}</div>}
            {mode === 'signIn' && (
              <div style={{ textAlign: 'right', marginBottom: 14 }}>
                <button type="button" onClick={() => go('reset')} style={{ ...linkBtn, fontSize: 12, color: 'var(--color-ink-2)' }}>{t('forgotPassword')}</button>
              </div>
            )}

            {info && !error && <div role="status" style={{ fontSize: 13, color: 'var(--color-positive)', marginBottom: 12, lineHeight: 1.45 }}>{info}</div>}
            {error && (
              <div role="alert" style={{ fontSize: 13, color: 'var(--color-negative)', marginBottom: 12, lineHeight: 1.45 }}>
                {error.text}
                {error.key === 'errNotVerified' && (
                  <div style={{ marginTop: 6 }}>
                    <button type="button" onClick={() => { go('code'); void sendCode('sign-in'); }} style={linkBtn}>{t('sendCode')}</button>
                  </div>
                )}
                {error.key === 'errUserExists' && (
                  <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                    <button type="button" onClick={() => go('signIn')} style={linkBtn}>{t('signIn')}</button>
                    <button type="button" onClick={() => go('reset')} style={linkBtn}>{t('setPassword')}</button>
                  </div>
                )}
              </div>
            )}
            <button type="submit" disabled={!canSignIn || busy} style={{
              width: '100%', padding: '11px 14px', borderRadius: 12, border: '1px solid var(--color-ink)', background: 'var(--color-ink)',
              color: '#fff', fontSize: 14, fontWeight: 500, cursor: canSignIn ? 'pointer' : 'not-allowed', opacity: canSignIn && !busy ? 1 : 0.6,
            }}>
              {submitLabel}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
            {(mode === 'signIn' || mode === 'code') && (
              <button type="button" onClick={() => go(mode === 'code' ? 'signIn' : 'code')} style={{ ...linkBtn, color: 'var(--color-ink-2)' }}>
                {mode === 'code' ? t('signInWithPasswordLink') : t('signInWithCodeLink')}
              </button>
            )}
            {mode === 'reset' && <button type="button" onClick={() => go('signIn')} style={{ ...linkBtn, color: 'var(--color-ink-2)' }}>← {t('signIn')}</button>}
            {mode !== 'reset' && (
              <div style={{ fontSize: 13, color: 'var(--color-ink-2)' }}>
                {mode === 'signUp' ? t('haveAccount') : t('noAccount')}{' '}
                <button onClick={() => go(mode === 'signUp' ? 'signIn' : 'signUp')} style={linkBtn}>{mode === 'signUp' ? t('signIn') : t('signUp')}</button>
              </div>
            )}
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
