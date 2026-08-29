import { beforeEach, describe, expect, it, vi, beforeAll } from 'vitest';

/**
 * Covers the security-critical half of the session layer: token hashing, rotation,
 * reuse detection, the retry grace window, and the cookie/body transport split.
 *
 * AuthSession is backed by a small in-memory fake rather than a real Mongo instance,
 * so the rotation state machine is tested deterministically and without adding a
 * database dependency to the test suite.
 */

interface FakeSession {
  _id: string;
  userId: string;
  role: 'customer' | 'worker' | 'admin';
  refreshTokenHash: string;
  previousTokenHash: string | null;
  previousTokenRotatedAt: Date | null;
  tokenFamilyId: string;
  rotationCount: number;
  deviceId: string | null;
  clientType: string;
  lastUsedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  revokedReason: string | null;
  createdAt: Date;
}

let store: FakeSession[] = [];
let seq = 0;

const matches = (doc: FakeSession, filter: Record<string, any>): boolean =>
  Object.entries(filter).every(([key, want]) => {
    if (key === '$or') {
      return (want as Record<string, any>[]).some((sub) => matches(doc, sub));
    }
    const have = (doc as any)[key];
    if (want && typeof want === 'object' && !(want instanceof Date)) {
      if ('$ne' in want) return String(have) !== String(want.$ne);
      if ('$gt' in want) return have > want.$gt;
      if ('$in' in want) return (want.$in as unknown[]).map(String).includes(String(have));
    }
    if (want === null) return have === null || have === undefined;
    return String(have) === String(want);
  });

const applyUpdate = (doc: FakeSession, update: Record<string, any>): void => {
  Object.assign(doc, update.$set || {});
  for (const [key, delta] of Object.entries(update.$inc || {})) {
    (doc as any)[key] += delta as number;
  }
};

vi.mock('../models/AuthSession', () => ({
  default: {
    create: vi.fn(async (data: Partial<FakeSession>) => {
      const doc: FakeSession = {
        // ObjectId-shaped: `revokeAllSessions` validates the id it is asked to spare.
        _id: `64b7f0000000000000000${(++seq).toString(16).padStart(3, '0')}`,
        previousTokenHash: null,
        previousTokenRotatedAt: null,
        rotationCount: 0,
        deviceId: null,
        clientType: 'unknown',
        revokedAt: null,
        revokedReason: null,
        createdAt: new Date(),
        lastUsedAt: new Date(),
        ...data,
      } as FakeSession;
      store.push(doc);
      return doc;
    }),
    findOne: vi.fn(async (filter: Record<string, any>) => store.find((d) => matches(d, filter)) || null),
    find: vi.fn((filter: Record<string, any>) => {
      const rows = store.filter((d) => matches(d, filter));
      const chain: any = {
        sort: () => chain,
        limit: () => chain,
        select: () => chain,
        lean: async () => rows,
        then: (resolve: (v: FakeSession[]) => unknown) => Promise.resolve(rows).then(resolve),
      };
      return chain;
    }),
    findOneAndUpdate: vi.fn(async (filter: Record<string, any>, update: Record<string, any>) => {
      const doc = store.find((d) => matches(d, filter));
      if (!doc) return null;
      applyUpdate(doc, update);
      return doc;
    }),
    updateOne: vi.fn(async (filter: Record<string, any>, update: Record<string, any>) => {
      const doc = store.find((d) => matches(d, filter));
      if (!doc) return { modifiedCount: 0 };
      applyUpdate(doc, update);
      return { modifiedCount: 1 };
    }),
    updateMany: vi.fn(async (filter: Record<string, any>, update: Record<string, any>) => {
      const docs = store.filter((d) => matches(d, filter));
      docs.forEach((d) => applyUpdate(d, update));
      return { modifiedCount: docs.length };
    }),
    deleteMany: vi.fn(async (filter: Record<string, any>) => {
      store = store.filter((d) => !matches(d, filter));
      return { deletedCount: 0 };
    }),
  },
}));

// Identity lookups: every account is a healthy customer unless a test says otherwise.
const accountUsable = { value: true };
const findByIdStub = () => ({
  select: () => Promise.resolve(accountUsable.value ? { _id: 'user-1', isActive: true } : null),
});
vi.mock('../models/User', () => ({ default: { findById: findByIdStub } }));
vi.mock('../models/Worker', () => ({ default: { findById: findByIdStub } }));
vi.mock('../models/Admin', () => ({ default: { findById: findByIdStub } }));

type Service = typeof import('./authSession.service');
let svc: Service;

beforeAll(async () => {
  process.env.JWT_SECRET = 'ci-test-jwt-secret';
  process.env.REFRESH_TOKEN_HASH_SECRET = 'ci-test-hash-secret';
  process.env.REFRESH_TOKEN_TTL = '30d';
  process.env.ACCESS_TOKEN_TTL = '15m';
  process.env.REFRESH_REUSE_GRACE_MS = '60000';
  svc = await import('./authSession.service');
});

beforeEach(() => {
  store = [];
  seq = 0;
  accountUsable.value = true;
});

const device = { clientType: 'web' as const, userAgent: 'vitest', ipAddress: '127.0.0.1' };

describe('refresh token hashing', () => {
  it('never stores the raw token — only a keyed hash', async () => {
    const { refreshToken } = await svc.createSession('user-1', 'customer', device);

    expect(store).toHaveLength(1);
    expect(store[0].refreshTokenHash).not.toBe(refreshToken);
    expect(store[0].refreshTokenHash).toMatch(/^[0-9a-f]{64}$/);
    // The raw token must appear nowhere in the persisted document.
    expect(JSON.stringify(store[0])).not.toContain(refreshToken);
  });

  it('is deterministic for the same token', () => {
    expect(svc.hashRefreshToken('abc')).toBe(svc.hashRefreshToken('abc'));
    expect(svc.hashRefreshToken('abc')).not.toBe(svc.hashRefreshToken('abd'));
  });

  it('issues a high-entropy token that is never repeated', async () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 25; i += 1) {
      const { refreshToken } = await svc.createSession('user-1', 'customer', device);
      expect(refreshToken.length).toBeGreaterThanOrEqual(43); // 256 bits, base64url
      tokens.add(refreshToken);
    }
    expect(tokens.size).toBe(25);
  });
});

describe('rotation', () => {
  it('issues a NEW refresh token on every refresh', async () => {
    const { refreshToken: t1 } = await svc.createSession('user-1', 'customer', device);

    const r1 = await svc.rotateSession(t1, device);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    expect(r1.refreshToken).not.toBe(t1);

    const r2 = await svc.rotateSession(r1.refreshToken, device);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.refreshToken).not.toBe(r1.refreshToken);
    expect(r2.session.rotationCount).toBe(2);
  });

  it('keeps the session (and its family) stable across rotations', async () => {
    const { refreshToken, session } = await svc.createSession('user-1', 'customer', device);
    const rotated = await svc.rotateSession(refreshToken, device);

    expect(rotated.ok).toBe(true);
    if (!rotated.ok) return;
    expect(String(rotated.session._id)).toBe(String(session._id));
    expect(rotated.session.tokenFamilyId).toBe(session.tokenFamilyId);
    // One row per device — rotation must not multiply sessions.
    expect(store).toHaveLength(1);
  });

  it('rejects an unknown token', async () => {
    const result = await svc.rotateSession('not-a-real-token', device);
    expect(result).toMatchObject({ ok: false, failure: 'not_found' });
  });

  it('rejects a missing token', async () => {
    expect(await svc.rotateSession(null, device)).toMatchObject({ ok: false, failure: 'no_token' });
  });

  it('rejects an expired session', async () => {
    const { refreshToken } = await svc.createSession('user-1', 'customer', device);
    store[0].expiresAt = new Date(Date.now() - 1000);

    expect(await svc.rotateSession(refreshToken, device)).toMatchObject({
      ok: false,
      failure: 'expired',
    });
  });

  it('rejects a revoked session', async () => {
    const { refreshToken } = await svc.createSession('user-1', 'customer', device);
    store[0].revokedAt = new Date();

    expect(await svc.rotateSession(refreshToken, device)).toMatchObject({
      ok: false,
      failure: 'revoked',
    });
  });

  it('rejects refresh for an account that is no longer usable', async () => {
    const { refreshToken } = await svc.createSession('user-1', 'customer', device);
    accountUsable.value = false;

    const result = await svc.rotateSession(refreshToken, device);
    expect(result).toMatchObject({ ok: false, failure: 'account_unusable' });
    // ...and the session is torn down, so it cannot resume if the account returns.
    expect(store[0].revokedAt).not.toBeNull();
  });
});

describe('reuse detection', () => {
  it('revokes the whole family when a retired token is replayed after the grace window', async () => {
    const { refreshToken: stolen } = await svc.createSession('user-1', 'customer', device);

    const legit = await svc.rotateSession(stolen, device);
    expect(legit.ok).toBe(true);

    // Push the rotation outside the retry grace window.
    store[0].previousTokenRotatedAt = new Date(Date.now() - 5 * 60_000);

    const replay = await svc.rotateSession(stolen, device);
    expect(replay).toMatchObject({ ok: false, failure: 'reuse_detected' });
    expect(store[0].revokedAt).not.toBeNull();
    expect(store[0].revokedReason).toBe('rotated_reuse_detected');

    // The token the legitimate client holds is dead too — the family is gone.
    if (legit.ok) {
      expect(await svc.rotateSession(legit.refreshToken, device)).toMatchObject({ ok: false });
    }
  });

  it('treats an immediate replay as a benign client retry, not theft', async () => {
    // A client whose rotation response was lost to a flaky network retries with the
    // same token. Revoking the family there would log a real user out for no reason.
    const { refreshToken } = await svc.createSession('user-1', 'customer', device);

    const first = await svc.rotateSession(refreshToken, device);
    expect(first.ok).toBe(true);

    const retry = await svc.rotateSession(refreshToken, device);
    expect(retry.ok).toBe(true);
    expect(store[0].revokedAt).toBeNull();
  });
});

describe('revocation', () => {
  it('logout kills the session so the refresh token cannot restore it', async () => {
    const { refreshToken } = await svc.createSession('user-1', 'customer', device);

    expect(await svc.revokeSessionByToken(refreshToken, 'logout')).toBe(true);
    expect(await svc.rotateSession(refreshToken, device)).toMatchObject({ ok: false });
  });

  it('logout-all revokes every session for the identity', async () => {
    const a = await svc.createSession('user-1', 'customer', { ...device, deviceId: 'phone' });
    const b = await svc.createSession('user-1', 'customer', { ...device, deviceId: 'laptop' });

    const count = await svc.revokeAllSessions('user-1', 'customer', 'logout_all');
    expect(count).toBe(2);

    expect(await svc.rotateSession(a.refreshToken, device)).toMatchObject({ ok: false });
    expect(await svc.rotateSession(b.refreshToken, device)).toMatchObject({ ok: false });
  });

  it('can spare the acting session (password change keeps you signed in here)', async () => {
    const here = await svc.createSession('user-1', 'customer', { ...device, deviceId: 'laptop' });
    const elsewhere = await svc.createSession('user-1', 'customer', { ...device, deviceId: 'phone' });

    await svc.revokeAllSessions('user-1', 'customer', 'password_changed', String(here.session._id));

    expect(await svc.rotateSession(here.refreshToken, device)).toMatchObject({ ok: true });
    expect(await svc.rotateSession(elsewhere.refreshToken, device)).toMatchObject({ ok: false });
  });
});

describe('multi-device', () => {
  it('keeps one independent session per device', async () => {
    const phone = await svc.createSession('user-1', 'customer', { ...device, deviceId: 'phone' });
    const laptop = await svc.createSession('user-1', 'customer', { ...device, deviceId: 'laptop' });

    // Logging in on a second device must not disturb the first.
    expect(await svc.rotateSession(phone.refreshToken, device)).toMatchObject({ ok: true });
    expect(await svc.rotateSession(laptop.refreshToken, device)).toMatchObject({ ok: true });
    expect(phone.session.tokenFamilyId).not.toBe(laptop.session.tokenFamilyId);
  });

  it('re-login on a known device replaces that device session instead of stacking', async () => {
    await svc.createSession('user-1', 'customer', { ...device, deviceId: 'phone' });
    await svc.createSession('user-1', 'customer', { ...device, deviceId: 'phone' });
    expect(store.filter((s) => s.deviceId === 'phone')).toHaveLength(1);
  });
});

describe('transport', () => {
  it('reads the refresh token from cookie, header or body', () => {
    const cookieName = process.env.REFRESH_COOKIE_NAME || 'fixo_rt';
    expect(svc.readRefreshToken({ cookies: { [cookieName]: 'c' }, headers: {} } as any)).toBe('c');
    expect(svc.readRefreshToken({ cookies: {}, headers: { 'x-refresh-token': 'h' } } as any)).toBe('h');
    expect(svc.readRefreshToken({ cookies: {}, headers: {}, body: { refreshToken: 'b' } } as any)).toBe('b');
    expect(svc.readRefreshToken({ cookies: {}, headers: {} } as any)).toBeNull();
  });

  it('still recognises the legacy cookie so existing users are not logged out', () => {
    expect(svc.readRefreshToken({ cookies: { refreshToken: 'legacy' }, headers: {} } as any)).toBe('legacy');
  });

  it('classifies native clients so only they receive the token in a body', () => {
    expect(svc.isNativeClient({ headers: { 'x-client-type': 'native' } } as any)).toBe(true);
    expect(svc.isNativeClient({ headers: { 'x-client-type': 'web' } } as any)).toBe(false);
    expect(svc.isNativeClient({ headers: {} } as any)).toBe(false);
  });

  it('sets an HttpOnly refresh cookie scoped to the auth path', () => {
    const cookie = vi.fn();
    svc.setRefreshCookie({ cookie } as any, 'tok');

    const [, value, options] = cookie.mock.calls[0];
    expect(value).toBe('tok');
    expect(options.httpOnly).toBe(true);
    expect(options.path).toBe('/api/auth');
    expect(['lax', 'strict', 'none']).toContain(options.sameSite);
  });
});
