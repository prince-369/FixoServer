import { describe, it, expect } from 'vitest';
import { redact } from './logger';

describe('logger redact()', () => {
  it('redacts sensitive top-level keys', () => {
    const out = redact({
      email: 'a@b.com',
      password: 'hunter2',
      otp: '123456',
      accessToken: 'jwt.token.here',
      refreshToken: 'refresh',
      authorization: 'Bearer x',
      aadhaarNumber: '1234',
      cvv: '999',
    }) as Record<string, unknown>;

    expect(out.email).toBe('a@b.com');
    expect(out.password).toBe('[REDACTED]');
    expect(out.otp).toBe('[REDACTED]');
    expect(out.accessToken).toBe('[REDACTED]');
    expect(out.refreshToken).toBe('[REDACTED]');
    expect(out.authorization).toBe('[REDACTED]');
    expect(out.aadhaarNumber).toBe('[REDACTED]');
    expect(out.cvv).toBe('[REDACTED]');
  });

  it('redacts snake_case and mixed variants', () => {
    const out = redact({ api_secret: 'x', client_secret: 'y', razorpay_signature: 'z' }) as Record<string, unknown>;
    expect(out.api_secret).toBe('[REDACTED]');
    expect(out.client_secret).toBe('[REDACTED]');
    expect(out.razorpay_signature).toBe('[REDACTED]');
  });

  it('redacts nested sensitive keys', () => {
    const out = redact({ user: { name: 'A', password: 'p' }, meta: { token: 't' } }) as any;
    expect(out.user.name).toBe('A');
    expect(out.user.password).toBe('[REDACTED]');
    expect(out.meta.token).toBe('[REDACTED]');
  });

  it('leaves non-sensitive values untouched', () => {
    expect(redact('hello')).toBe('hello');
    expect(redact(42)).toBe(42);
    expect(redact(true)).toBe(true);
    expect(redact(null)).toBe(null);
    expect(redact(undefined)).toBe(undefined);
  });

  it('serialises Error (name/message/stack/code) and Date', () => {
    const err = redact(new Error('boom')) as any;
    expect(err.name).toBe('Error');
    expect(err.message).toBe('boom');
    expect(typeof err.stack).toBe('string');
    const withCode = redact(Object.assign(new Error('dup'), { code: 11000 })) as any;
    expect(withCode.code).toBe(11000);
    const d = new Date('2026-01-01T00:00:00.000Z');
    expect(redact(d)).toBe('2026-01-01T00:00:00.000Z');
  });

  it('does NOT copy unsafe Error properties (axios config/response)', () => {
    const e: any = new Error('request failed');
    e.config = { headers: { authorization: 'Bearer secret' } };
    e.response = { data: { otp: '123456' } };
    const out = redact(e) as any;
    expect(out.config).toBeUndefined();
    expect(out.response).toBeUndefined();
    expect(JSON.stringify(out)).not.toContain('secret');
    expect(JSON.stringify(out)).not.toContain('123456');
  });

  it('handles circular references without throwing', () => {
    const a: any = { name: 'x' };
    a.self = a;
    expect(() => redact(a)).not.toThrow();
    const out = redact(a) as any;
    expect(out.name).toBe('x');
    expect(out.self).toBe('[Circular]');
  });

  it('caps depth', () => {
    const deep = { a: { b: { c: { d: { e: { f: 'too deep' } } } } } };
    const out = redact(deep) as any;
    // At MAX_DEPTH the value becomes a truncation marker rather than recursing forever.
    expect(JSON.stringify(out)).toContain('[Truncated]');
  });
});
