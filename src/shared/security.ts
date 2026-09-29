// ─── Account security helpers (pure, unit-tested) ─────────────────────────────

/** Sign out after this long without any activity (finance data on a shared/lost device) */
export const IDLE_LIMIT_MS = 30 * 60 * 1000;

export const MIN_PASSWORD = 10;

const COMMON = ['password', 'qwerty', '123456', '12345678', '1234567890', 'qwerty123', 'password1', 'iloveyou', 'admin', 'letmein', 'pome'];

export type PasswordProblem = 'short' | 'weak' | 'personal' | 'common' | null;

/** Rules for a NEW password: ≥10 chars, letters and digits, not the email name, not a well-known password */
export function passwordProblem(password: string, email = ''): PasswordProblem {
  if (password.length < MIN_PASSWORD) return 'short';
  const lower = password.toLowerCase();
  if (COMMON.some(c => lower.includes(c) && lower.length - c.length < 4)) return 'common';
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) return 'weak';
  const name = email.split('@')[0]?.toLowerCase() ?? '';
  if (name.length >= 3 && lower.includes(name)) return 'personal';
  return null;
}

/** true when the last activity was longer ago than the idle limit */
export const isIdleExpired = (lastActive: number, now: number, limit = IDLE_LIMIT_MS) => lastActive > 0 && now - lastActive > limit;

/** Email OTP codes are 6 digits; keep only digits while typing */
export const sanitizeCode = (s: string) => s.replace(/\D/g, '').slice(0, 6);

export type AuthErrorKey = 'errBadLogin' | 'errNotVerified' | 'errUserExists' | 'errBadCode' | 'errCodeExpired' | 'errTooMany' | 'pwShort' | null;

/** Better Auth error code/message → a friendly message key (null = show the raw text) */
export function authErrorKey(err: string): AuthErrorKey {
  const e = err.toUpperCase();
  if (e.includes('INVALID_EMAIL_OR_PASSWORD') || e.includes('INVALID EMAIL OR PASSWORD')) return 'errBadLogin';
  if (e.includes('EMAIL_NOT_VERIFIED') || e.includes('EMAIL NOT VERIFIED')) return 'errNotVerified';
  if (e.includes('USER_ALREADY_EXISTS') || e.includes('ALREADY EXISTS')) return 'errUserExists';
  if (e.includes('OTP_EXPIRED') || e.includes('OTP EXPIRED')) return 'errCodeExpired';
  if (e.includes('INVALID_OTP') || e.includes('INVALID OTP')) return 'errBadCode';
  if (e.includes('TOO_MANY') || e.includes('TOO MANY')) return 'errTooMany';
  if (e.includes('PASSWORD_TOO_SHORT')) return 'pwShort';
  return null;
}
