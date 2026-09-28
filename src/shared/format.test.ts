import { describe, expect, it } from 'vitest';
import { parseAmount, sanitizeAmountInput } from './format';

describe('sanitizeAmountInput', () => {
  it('drops letters and extra separators', () => {
    expect(sanitizeAmountInput('1m')).toBe('1');
    expect(sanitizeAmountInput('abc')).toBe('');
    expect(sanitizeAmountInput('1.2.3')).toBe('1.23');
    expect(sanitizeAmountInput('12,345')).toBe('12,34');
    expect(sanitizeAmountInput(',5')).toBe('0,5');
  });
  it('allows no decimals for tenge and tugrik', () => {
    expect(sanitizeAmountInput('1500,75', 'KZT')).toBe('1 500');
    expect(sanitizeAmountInput('1500,75', 'USD')).toBe('1 500,75');
  });

  it('groups thousands with spaces while typing', () => {
    expect(sanitizeAmountInput('1500000', 'KZT')).toBe('1 500 000');
    expect(sanitizeAmountInput('1 500 0001', 'KZT')).toBe('15 000 001');
    expect(sanitizeAmountInput('007')).toBe('7');
    expect(parseAmount(sanitizeAmountInput('1234567,5'))).toBe(1234567.5);
  });
});
