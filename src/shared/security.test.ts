import { describe, expect, it } from 'vitest';
import { authErrorKey, isIdleExpired, passwordProblem, sanitizeCode, IDLE_LIMIT_MS } from './security';

describe('passwordProblem', () => {
  it('needs 10+ characters', () => expect(passwordProblem('abc12345')).toBe('short'));
  it('needs letters and digits', () => {
    expect(passwordProblem('abcdefghijk')).toBe('weak');
    expect(passwordProblem('1234567890')).toBe('common');
    expect(passwordProblem('98765432109')).toBe('weak');
  });
  it('rejects well-known passwords', () => expect(passwordProblem('Password123')).toBe('common'));
  it('rejects the email name inside the password', () => expect(passwordProblem('bayan2026xx', 'bayan@mail.kz')).toBe('personal'));
  it('accepts a decent password (Cyrillic too)', () => {
    expect(passwordProblem('гранат-сад-42', 'bayan@mail.kz')).toBeNull();
    expect(passwordProblem('river7stone9', 'x@y.z')).toBeNull();
  });
});

describe('idle sign-out', () => {
  it('expires only after the limit', () => {
    expect(isIdleExpired(1000, 1000 + IDLE_LIMIT_MS)).toBe(false);
    expect(isIdleExpired(1000, 1001 + IDLE_LIMIT_MS)).toBe(true);
    expect(isIdleExpired(0, Date.now())).toBe(false);   // never recorded
  });
});

it('sanitizeCode keeps 6 digits', () => expect(sanitizeCode('12 34-567a')).toBe('123456'));

it('authErrorKey maps Better Auth codes and messages', () => {
  expect(authErrorKey('INVALID_EMAIL_OR_PASSWORD')).toBe('errBadLogin');
  expect(authErrorKey('Invalid email or password')).toBe('errBadLogin');
  expect(authErrorKey('EMAIL_NOT_VERIFIED')).toBe('errNotVerified');
  expect(authErrorKey('USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL')).toBe('errUserExists');
  expect(authErrorKey('INVALID_OTP')).toBe('errBadCode');
  expect(authErrorKey('OTP_EXPIRED')).toBe('errCodeExpired');
  expect(authErrorKey('TOO_MANY_ATTEMPTS')).toBe('errTooMany');
  expect(authErrorKey('Network down')).toBeNull();
});
