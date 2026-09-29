// ─── Session: who is using the app ────────────────────────────────────────────
//   loading   → checking for an existing sign-in
//   signedOut → show the sign-in screen
//   user      → real account, data from Neon
//   demo      → read-only sample data, no account needed

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { neon } from '../lib/neon';
import { IDLE_LIMIT_MS, isIdleExpired } from '../shared/security';

export interface SessionUser { id: string; email: string; name: string; image?: string | null }
export type SessionStatus = 'loading' | 'signedOut' | 'user' | 'demo';

interface SessionValue {
  status: SessionStatus;
  user: SessionUser | null;
  /** Backend env is set — sign-in is possible */
  canSignIn: boolean;
  enterDemo: () => void;
  exitDemo: () => void;
  signInWithGoogle: () => Promise<string | null>;
  signInWithEmail: (email: string, password: string) => Promise<string | null>;
  signUpWithEmail: (name: string, email: string, password: string) => Promise<string | null>;
  /** Passwordless: a 6-digit code is emailed (Neon Auth Email OTP) */
  sendEmailCode: (email: string) => Promise<string | null>;
  signInWithCode: (email: string, code: string) => Promise<string | null>;
  /** "Forgot password": code to email, then a new password (also adds one to a Google-only account). Doesn't sign in. */
  sendResetCode: (email: string) => Promise<string | null>;
  resetPassword: (email: string, code: string, password: string) => Promise<string | null>;
  /** Confirms the email with the code sent at sign-up, then signs in with the password */
  verifyEmailAndSignIn: (email: string, code: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  /** Ends every session of this account (other phones/computers too) */
  signOutEverywhere: () => Promise<void>;
  /** Signed out automatically after inactivity — shown once on the sign-in screen */
  signedOutForIdle: boolean;
}

const Ctx = createContext<SessionValue | null>(null);
const DEMO_KEY = 'pome.demo';
const ACTIVE_KEY = 'pome.lastActive';   // shared by all tabs
const readActive = () => { try { return Number(localStorage.getItem(ACTIVE_KEY)) || 0; } catch { return 0; } };
const writeActive = (v: number) => { try { localStorage.setItem(ACTIVE_KEY, String(v)); } catch { /* ignore */ } };

const readDemoFlag = () => {
  try { return sessionStorage.getItem(DEMO_KEY) === '1' || new URLSearchParams(location.search).has('demo'); }
  catch { return false; }
};

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [signedOutForIdle, setSignedOutForIdle] = useState(false);

  const refresh = useCallback(async () => {
    if (!neon) { setStatus(readDemoFlag() ? 'demo' : 'signedOut'); return; }
    try {
      const { data } = await neon.auth.getSession();
      const u = data?.user;
      if (u) {
        // reopened after a long break (e.g. a phone left signed in) → sign out instead of showing the data
        if (isIdleExpired(readActive(), Date.now())) {
          await neon.auth.signOut().catch(() => undefined);
          writeActive(0);
          setSignedOutForIdle(true);
          throw new Error('idle');
        }
        writeActive(Date.now());
        setUser({ id: u.id, email: u.email, name: u.name || u.email.split('@')[0], image: u.image });
        setStatus('user');
        return;
      }
    } catch { /* network / not configured → fall through */ }
    setUser(null);
    setStatus(readDemoFlag() ? 'demo' : 'signedOut');
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
  /** Better Auth error → its code (INVALID_EMAIL_OR_PASSWORD, EMAIL_NOT_VERIFIED…) or message; the UI translates it */
  const errCode = (e: { code?: string; message?: string } | null | undefined) => e?.code || e?.message || 'error';

  const endSession = useCallback(async (everywhere = false) => {
    // Leave the app right away; end the server session(s) in the background (max 5 s)
    try { sessionStorage.removeItem(DEMO_KEY); } catch { /* ignore */ }
    writeActive(0);
    setUser(null);
    setStatus('signedOut');
    if (neon) {
      const db = neon;
      const work = (everywhere ? db.auth.revokeSessions().catch(() => undefined) : Promise.resolve())
        .then(() => db.auth.signOut().catch(() => undefined));
      await Promise.race([work, new Promise(r => setTimeout(r, 5000))]);
    }
  }, []);

  // Idle sign-out: any activity keeps the session; 30 min without it → sign out (checked every minute
  // and whenever the tab becomes visible again)
  useEffect(() => {
    if (status !== 'user') return;
    let last = 0;
    const touch = () => { const now = Date.now(); if (now - last > 15_000) { last = now; writeActive(now); } };
    const check = () => {
      if (isIdleExpired(readActive(), Date.now(), IDLE_LIMIT_MS)) { setSignedOutForIdle(true); void endSession(); }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;
    events.forEach(e => window.addEventListener(e, touch, { passive: true, capture: true }));
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(check, 60_000);
    touch();
    return () => {
      events.forEach(e => window.removeEventListener(e, touch, { capture: true }));
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [status, endSession]);

  const value = useMemo<SessionValue>(() => ({
    status, user, canSignIn: !!neon,
    enterDemo: () => { try { sessionStorage.setItem(DEMO_KEY, '1'); } catch { /* ignore */ } setStatus('demo'); },
    exitDemo: () => { try { sessionStorage.removeItem(DEMO_KEY); } catch { /* ignore */ } setStatus('signedOut'); },
    signInWithGoogle: async () => {
      if (!neon) return 'not-configured';
      writeActive(Date.now());   // so the fresh sign-in isn't taken for an expired one after the redirect
      const { error } = await neon.auth.signIn.social({ provider: 'google', callbackURL: window.location.origin });
      return error ? errCode(error) : null; // on success the browser is redirected to Google
    },
    signInWithEmail: async (email, password) => {
      if (!neon) return 'not-configured';
      try {
        const { error } = await neon.auth.signIn.email({ email, password });
        if (error) return errCode(error);
        setSignedOutForIdle(false);
        writeActive(Date.now());
        await refresh();
        return null;
      } catch (e) { return errorText(e); }
    },
    signUpWithEmail: async (name, email, password) => {
      if (!neon) return 'not-configured';
      try {
        const { error } = await neon.auth.signUp.email({ name, email, password });
        if (error) return errCode(error);
        writeActive(Date.now());
        // with "Verify at sign-up" there's no session yet: a code was emailed
        const { data } = await neon.auth.getSession();
        if (!data?.user) return 'NEEDS_VERIFICATION';
        await refresh();
        return null;
      } catch (e) { return errorText(e); }
    },
    sendEmailCode: async (email) => {
      if (!neon) return 'not-configured';
      try {
        const { error } = await neon.auth.emailOtp.sendVerificationOtp({ email, type: 'sign-in' });
        return error ? errCode(error) : null;
      } catch (e) { return errorText(e); }
    },
    signInWithCode: async (email, code) => {
      if (!neon) return 'not-configured';
      try {
        const { error } = await neon.auth.signIn.emailOtp({ email, otp: code });
        if (error) return errCode(error);
        setSignedOutForIdle(false);
        writeActive(Date.now());
        await refresh();
        return null;
      } catch (e) { return errorText(e); }
    },
    sendResetCode: async (email) => {
      if (!neon) return 'not-configured';
      try {
        const { error } = await neon.auth.emailOtp.sendVerificationOtp({ email, type: 'forget-password' });
        return error ? errCode(error) : null;
      } catch (e) { return errorText(e); }
    },
    resetPassword: async (email, code, password) => {
      if (!neon) return 'not-configured';
      try {
        const { error } = await neon.auth.emailOtp.resetPassword({ email, otp: code, password });
        if (error) return errCode(error);
        // no automatic sign-in: the person signs in with the new password themselves
        return null;
      } catch (e) { return errorText(e); }
    },
    verifyEmailAndSignIn: async (email, code, password) => {
      if (!neon) return 'not-configured';
      try {
        const { error } = await neon.auth.emailOtp.verifyEmail({ email, otp: code });
        if (error) return errCode(error);
        const { data } = await neon.auth.getSession();   // some setups sign in right after verification
        if (!data?.user) {
          const res = await neon.auth.signIn.email({ email, password });
          if (res.error) return errCode(res.error);
        }
        writeActive(Date.now());
        await refresh();
        return null;
      } catch (e) { return errorText(e); }
    },
    signOut: () => endSession(false),
    signOutEverywhere: () => endSession(true),
    signedOutForIdle,
  }), [status, user, refresh, endSession, signedOutForIdle]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}
