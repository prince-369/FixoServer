import jwt from 'jsonwebtoken';
import { beforeAll, describe, expect, it } from 'vitest';

// Proves the Socket.IO auth bypass (finding #2) is closed: identity is derived
// ONLY from a verified access token, never from client-supplied handshake data,
// and unauthenticated / forged tokens are rejected.

type AuthenticateHandshake = typeof import('./index')['authenticateHandshake'];
type GenerateAccessToken = typeof import('../utils/generateToken')['generateAccessToken'];

let authenticateHandshake: AuthenticateHandshake;
let generateAccessToken: GenerateAccessToken;

beforeAll(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'ci-test-jwt-secret';
  ({ authenticateHandshake } = await import('./index'));
  ({ generateAccessToken } = await import('../utils/generateToken'));
});

describe('socket authenticateHandshake', () => {
  it('rejects a handshake with no token (unauthenticated socket)', () => {
    expect(authenticateHandshake({ auth: {}, headers: {} })).toBeNull();
  });

  it('rejects an invalid/garbage token', () => {
    expect(authenticateHandshake({ auth: { token: 'not-a-jwt' }, headers: {} })).toBeNull();
  });

  it('rejects a token signed with the wrong secret', () => {
    const forged = jwt.sign({ id: 'x', role: 'admin' }, 'attacker-secret');
    expect(authenticateHandshake({ auth: { token: forged }, headers: {} })).toBeNull();
  });

  it('rejects a token with alg:none (algorithm pinning, finding #6)', () => {
    const noneToken = jwt.sign({ id: 'x', role: 'admin' }, '', { algorithm: 'none' });
    expect(authenticateHandshake({ auth: { token: noneToken }, headers: {} })).toBeNull();
  });

  it('accepts a valid token from handshake.auth and returns the verified identity', () => {
    const token = generateAccessToken({ id: 'user-123', role: 'worker' });
    expect(authenticateHandshake({ auth: { token }, headers: {} })).toEqual({
      id: 'user-123',
      role: 'worker',
    });
  });

  it('accepts a valid Bearer token from the Authorization header', () => {
    const token = generateAccessToken({ id: 'admin-1', role: 'admin' });
    expect(authenticateHandshake({ headers: { authorization: `Bearer ${token}` } })).toEqual({
      id: 'admin-1',
      role: 'admin',
    });
  });

  it('does NOT trust client-supplied userId/role — only the token grants identity', () => {
    // Attacker presents no token but tries to smuggle an admin identity in the
    // handshake payload. This is exactly the old bypass and must be rejected.
    const spoofed = { auth: { userId: 'victim', role: 'admin' }, headers: {} } as {
      auth?: { token?: unknown };
      headers?: Record<string, unknown>;
    };
    expect(authenticateHandshake(spoofed)).toBeNull();
  });
});
