import { describe, it, expect } from 'vitest';
import { maskEmail, maskPhone } from './mask';

describe('maskEmail()', () => {
  it('masks the local part, keeps the domain', () => {
    expect(maskEmail('prince@example.com')).toBe('p*****@example.com');
  });
  it('handles empty/invalid safely (never throws, never leaks)', () => {
    expect(maskEmail('')).toBe('[none]');
    expect(maskEmail(null)).toBe('[none]');
    expect(maskEmail(undefined)).toBe('[none]');
    expect(maskEmail('no-at-sign')).toBe('[masked]');
  });
});

describe('maskPhone()', () => {
  it('keeps only the last 4 digits', () => {
    expect(maskPhone('9876543210')).toBe('******3210');
    expect(maskPhone('+91 98765 43210')).toBe('********3210');
  });
  it('handles empty/short safely', () => {
    expect(maskPhone('')).toBe('[none]');
    expect(maskPhone(null)).toBe('[none]');
    expect(maskPhone('12')).toBe('[masked]');
  });
});
