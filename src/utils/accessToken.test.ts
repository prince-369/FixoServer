import jwt from 'jsonwebtoken';
import { beforeAll, describe, expect, it } from 'vitest';

// Covers the access-token contract: minimal claims, session binding, algorithm
// pinning, and rejection of anything that is not an access token.

type GenerateAccessToken = typeof import('./generateToken')['generateAccessToken'];
type VerifyAccessToken = typeof import('./generateToken')['verifyAccessToken'];

let generateAccessToken: GenerateAccessToken;
let verifyAccessToken: VerifyAccessToken;
const SECRET = 'ci-test-jwt-secret';

beforeAll(async () => {
  process.env.JWT_SECRET = SECRET;
  process.env.ACCESS_TOKEN_TTL = '15m';
  ({ generateAccessToken, verifyAccessToken } = await import('./generateToken'));
});

describe('access token', () => {
  it('round-trips id, role and session id', () => {
    const token = generateAccessToken({ id: 'user-1', role: 'worker', sid: 'sess-1' });
    expect(verifyAccessToken(token)).toEqual({ id: 'user-1', role: 'worker', sid: 'sess-1' });
  });

  it('carries only minimal claims — no PII', () => {
    const token = generateAccessToken({ id: 'user-1', role: 'customer', sid: 'sess-1' });
    const decoded = jwt.decode(token) as Record<string, unknown>;

    expect(Object.keys(decoded).sort()).toEqual(['exp', 'iat', 'id', 'role', 'sid', 'tokenType']);
    // Explicitly assert the things that must never be in a token.
    for (const forbidden of ['password', 'email', 'phone', 'name']) {
      expect(decoded).not.toHaveProperty(forbidden);
    }
  });

  it('is short-lived (<= 1 hour), so it is not a substitute for a session', () => {
    const token = generateAccessToken({ id: 'u', role: 'customer' });
    const { iat, exp } = jwt.decode(token) as { iat: number; exp: number };
    expect(exp - iat).toBeLessThanOrEqual(3600);
  });

  it('rejects a token signed with a different secret', () => {
    const forged = jwt.sign({ id: 'u', role: 'admin', tokenType: 'access' }, 'attacker-secret');
    expect(() => verifyAccessToken(forged)).toThrow();
  });

  it('rejects alg=none (algorithm confusion)', () => {
    const forged = jwt.sign({ id: 'u', role: 'admin', tokenType: 'access' }, '', {
      algorithm: 'none',
    });
    expect(() => verifyAccessToken(forged)).toThrow();
  });

  it('rejects a correctly-signed token that is not an access token', () => {
    const refreshShaped = jwt.sign({ id: 'u', role: 'admin', tokenType: 'refresh' }, SECRET);
    expect(() => verifyAccessToken(refreshShaped)).toThrow(/Invalid token type/);
  });

  it('still accepts legacy tokens that predate the tokenType claim', () => {
    // Guards the rollout: deploying must not invalidate in-flight access tokens.
    const legacy = jwt.sign({ id: 'u', role: 'customer' }, SECRET);
    expect(verifyAccessToken(legacy)).toEqual({ id: 'u', role: 'customer', sid: undefined });
  });

  it('rejects a well-signed but malformed payload', () => {
    const noRole = jwt.sign({ id: 'u', tokenType: 'access' }, SECRET);
    expect(() => verifyAccessToken(noRole)).toThrow(/Malformed/);
  });
});
