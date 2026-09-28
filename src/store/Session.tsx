// ─── Session: who is using the app ────────────────────────────────────────────
//   loading   → checking for an existing sign-in
//   signedOut → show the sign-in screen
//   user      → real account, data from Neon
//   demo      → read-only sample data, no account needed

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { neon } from '../lib/neon';

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
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionValue | null>(null);
const DEMO_KEY = 'pome.demo';

const readDemoFlag = () => {
  try { return sessionStorage.getItem(DEMO_KEY) === '1' || new URLSearchParams(location.search).has('demo'); }
  catch { return false; }
};

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);

  const refresh = useCallback(async () => {
    if (!neon) { setStatus(readDemoFlag() ? 'demo' : 'signedOut'); return; }
    try {
      const { data } = await neon.auth.getSession();
      const u = data?.user;
      if (u) {
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

  const value = useMemo<SessionValue>(() => ({
    status, user, canSignIn: !!neon,
    enterDemo: () => { try { sessionStorage.setItem(DEMO_KEY, '1'); } catch { /* ignore */ } setStatus('demo'); },
    exitDemo: () => { try { sessionStorage.removeItem(DEMO_KEY); } catch { /* ignore */ } setStatus('signedOut'); },
    signInWithGoogle: async () => {
      if (!neon) return 'not-configured';
      const { error } = await neon.auth.signIn.social({ provider: 'google', callbackURL: window.location.origin });
      return error ? error.message ?? 'error' : null; // on success the browser is redirected to Google
    },
    signInWithEmail: async (email, password) => {
      if (!neon) return 'not-configured';
      try {
        const { error } = await neon.auth.signIn.email({ email, password });
        if (error) return error.message ?? 'error';
        await refresh();
        return null;
      } catch (e) { return errorText(e); }
    },
    signUpWithEmail: async (name, email, password) => {
      if (!neon) return 'not-configured';
      try {
        const { error } = await neon.auth.signUp.email({ name, email, password });
        if (error) return error.message ?? 'error';
        await refresh();
        return null;
      } catch (e) { return errorText(e); }
    },
    signOut: async () => {
      // Leave the app right away; end the server session in the background (max 5 s)
      try { sessionStorage.removeItem(DEMO_KEY); } catch { /* ignore */ }
      setUser(null);
      setStatus('signedOut');
      if (neon) {
        await Promise.race([neon.auth.signOut().catch(() => undefined), new Promise(r => setTimeout(r, 5000))]);
      }
    },
  }), [status, user, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}
