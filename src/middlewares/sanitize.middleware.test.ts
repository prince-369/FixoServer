import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it } from 'vitest';
import { sanitizeRequest } from './sanitize.middleware';

// Proves the NoSQL-injection sanitizer (finding #5) strips Mongo operator keys
// ($...) and dotted paths from every input surface while leaving clean data.

const run = (
  body: Record<string, unknown>,
  query: Record<string, unknown> = {},
  params: Record<string, unknown> = {}
): Request => {
  const req = { body, query, params } as unknown as Request;
  let nextCalled = false;
  const next: NextFunction = () => {
    nextCalled = true;
  };
  sanitizeRequest(req, {} as Response, next);
  expect(nextCalled).toBe(true);
  return req;
};

describe('sanitizeRequest', () => {
  it('strips $-prefixed operator keys from the body', () => {
    const req = run({ phone: { $ne: null }, name: 'ok' });
    expect(req.body.phone).toEqual({});
    expect(req.body.name).toBe('ok');
  });

  it('strips dotted keys', () => {
    const req = run({ 'a.b': 1, plain: 2 });
    expect(req.body['a.b']).toBeUndefined();
    expect(req.body.plain).toBe(2);
  });

  it('recurses into nested objects and arrays', () => {
    const req = run({ list: [{ $where: 'evil', ok: 1 }], nested: { $gt: 5, keep: 3 } });
    expect(req.body.list[0].$where).toBeUndefined();
    expect(req.body.list[0].ok).toBe(1);
    expect(req.body.nested.$gt).toBeUndefined();
    expect(req.body.nested.keep).toBe(3);
  });

  it('sanitizes query and params too', () => {
    const req = run({}, { $gt: '1', q: 'x' }, { $set: 'y', id: 'z' });
    expect((req.query as Record<string, unknown>).$gt).toBeUndefined();
    expect((req.query as Record<string, unknown>).q).toBe('x');
    expect((req.params as Record<string, unknown>).$set).toBeUndefined();
    expect((req.params as Record<string, unknown>).id).toBe('z');
  });

  it('leaves clean payloads untouched', () => {
    const req = run({ a: 1, b: { c: 2 } });
    expect(req.body).toEqual({ a: 1, b: { c: 2 } });
  });
});
