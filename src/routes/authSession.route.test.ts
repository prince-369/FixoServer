import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * HTTP-level coverage of the session endpoints: cookie attributes, the cookie vs
 * body transport split, CSRF origin enforcement, and the fact that /auth/refresh
 * returns 401 (not 500) for a bad token and never leaks token material.
 *
 * The persistence layer is faked so this runs without a MongoDB instance; the
 * rotation state machine itself is covered in services/authSession.test.ts.
 */

interface Row {
  _id: string;
  userId: string;
  role: string;
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

let rows: Row[] = [];
let seq = 0;

const matches = (doc: Row, filter: Record<string, any>): boolean =>
  Object.entries(filter).every(([key, want]) => {
    if (key === '$or') return (want as Record<string, any>[]).some((sub) => matches(doc, sub));
    const have = (doc as any)[key];
    if (want && typeof want === 'object' && !(want instanceof Date)) {
      if ('$ne' in want) return String(have) !== String(want.$ne);
      if ('$gt' in want) return have > want.$gt;
      if ('$in' in want) return (want.$in as unknown[]).map(String).includes(String(have));
    }
    if (want === null) return have === null || have === undefined;
    return String(have) === String(want);
  });

const applyUpdate = (doc: Row, update: Record<string, any>): void => {
  Object.assign(doc, update.$set || {});
  for (const [k, d] of Object.entries(update.$inc || {})) (doc as any)[k] += d as number;
};

vi.mock('../models/AuthSession', () => ({
  default: {
    create: vi.fn(async (data: Partial<Row>) => {
      const doc = {
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
      } as Row;
      rows.push(doc);
      return doc;
    }),
    findOne: vi.fn(async (f: any) => rows.find((d) => matches(d, f)) || null),
    find: vi.fn((f: any) => {
      const out = rows.filter((d) => matches(d, f));
      const chain: any = {
        sort: () => chain,
        limit: () => chain,
        select: () => chain,
        lean: async () => out,
        then: (r: (v: Row[]) => unknown) => Promise.resolve(out).then(r),
      };
      return chain;
    }),
    findOneAndUpdate: vi.fn(async (f: any, u: any) => {
      const d = rows.find((x) => matches(x, f));
      if (!d) return null;
      applyUpdate(d, u);
      return d;
    }),
    updateOne: vi.fn(async (f: any, u: any) => {
      const d = rows.find((x) => matches(x, f));
      if (!d) return { modifiedCount: 0 };
      applyUpdate(d, u);
      return { modifiedCount: 1 };
    }),
    updateMany: vi.fn(async (f: any, u: any) => {
      const ds = rows.filter((x) => matches(x, f));
      ds.forEach((d) => applyUpdate(d, u));
      return { modifiedCount: ds.length };
    }),
    deleteMany: vi.fn(async (f: any) => {
      rows = rows.filter((d) => !matches(d, f));
      return { deletedCount: 0 };
    }),
  },
}));

// No legacy rows in these scenarios.
vi.mock('../models/RefreshToken', () => ({
  default: {
    findOne: async () => null,
    deleteOne: async () => ({ deletedCount: 0 }),
    deleteMany: async () => ({ deletedCount: 0 }),
  },
}));

const userDoc = {
  _id: 'user-1',
  isActive: true,
  block: {},
  toObject: () => ({ _id: 'user-1' }),
  save: async () => undefined,
};
const chain = (value: unknown) => {
  const c: any = {
    select: () => c,
    populate: () => c,
    lean: async () => value,
    then: (r: (v: unknown) => unknown) => Promise.resolve(value).then(r),
  };
  return c;
};
vi.mock('../models/User', () => ({ default: { findById: () => chain(userDoc) } }));
vi.mock('../models/Worker', () => ({ default: { findById: () => chain(userDoc) } }));
vi.mock('../models/Admin', () => ({ default: { findById: () => chain(null) } }));

let app: any;
let svc: typeof import('../services/authSession.service');

const ORIGIN = 'http://localhost:3000';
const COOKIE = 'fixo_rt';

/** Node sends `set-cookie` as an array; supertest's types say `string`. */
const setCookies = (res: { headers: Record<string, unknown> }): string[] => {
  const raw = res.headers['set-cookie'];
  if (Array.isArray(raw)) return raw as string[];
  return raw ? [String(raw)] : [];
};

beforeAll(async () => {
  process.env.JWT_SECRET = 'ci-test-jwt-secret';
  process.env.REFRESH_TOKEN_HASH_SECRET = 'ci-test-hash-secret';
  process.env.ACCESS_TOKEN_TTL = '15m';
  process.env.REFRESH_TOKEN_TTL = '30d';
  process.env.REFRESH_COOKIE_NAME = COOKIE;
  process.env.REFRESH_COOKIE_PATH = '/api/auth';
  process.env.REFRESH_COOKIE_SECURE = 'true';
  process.env.REFRESH_COOKIE_SAMESITE = 'lax';
  process.env.CLIENT_URL = ORIGIN;

  svc = await import('../services/authSession.service');
  app = (await import('../app')).default;
});

beforeEach(() => {
  rows = [];
  seq = 0;
});

const seedSession = async (clientType: 'web' | 'native' = 'web') => {
  const { refreshToken, accessToken } = await svc.createSession('user-1', 'customer', {
    clientType,
    userAgent: 'vitest',
    ipAddress: '127.0.0.1',
  });
  return { refreshToken, accessToken };
};

describe('POST /api/auth/refresh — web (cookie transport)', () => {
  it('rotates the cookie and never puts the refresh token in the body', async () => {
    const { refreshToken } = await seedSession();

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Origin', ORIGIN)
      .set('Cookie', `${COOKIE}=${refreshToken}`);

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.role).toBe('customer');
    // The browser must receive the refresh token ONLY as a cookie.
    expect(res.body.refreshToken).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain(refreshToken);

    const setCookie = setCookies(res).join(';');
    expect(setCookie).toContain(`${COOKIE}=`);
    // A NEW token — rotation actually happened.
    expect(setCookie).not.toContain(refreshToken);
  });

  it('sets HttpOnly, Secure, SameSite and a scoped Path on the cookie', async () => {
    const { refreshToken } = await seedSession();

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Origin', ORIGIN)
      .set('Cookie', `${COOKIE}=${refreshToken}`);

    const cookie = setCookies(res).find((c) => c.startsWith(`${COOKIE}=`))!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\/api\/auth/i);
    // 30 days, give or take a second of request time.
    const maxAge = Number(/Max-Age=(\d+)/i.exec(cookie)?.[1]);
    expect(maxAge).toBeGreaterThan(29 * 86400);
  });

  it('returns the user profile so restore is a single round trip', async () => {
    const { refreshToken } = await seedSession();

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Origin', ORIGIN)
      .set('Cookie', `${COOKIE}=${refreshToken}`);

    expect(res.body).toHaveProperty('user');
    expect(res.body).toHaveProperty('block');
  });

  it('401s with a machine-readable code when no token is presented', async () => {
    const res = await request(app).post('/api/auth/refresh').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('NO_SESSION');
  });

  it('401s — not 500 — for a garbage token, and clears the cookie', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Origin', ORIGIN)
      .set('Cookie', `${COOKIE}=totally-invalid`);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('SESSION_INVALID');
    expect(setCookies(res).join(';')).toMatch(/fixo_rt=;/);
  });

  it('reports SESSION_REVOKED when a retired token is replayed', async () => {
    const { refreshToken } = await seedSession();

    await request(app).post('/api/auth/refresh').set('Origin', ORIGIN).set('Cookie', `${COOKIE}=${refreshToken}`);
    // Age the rotation past the retry grace window.
    rows[0].previousTokenRotatedAt = new Date(Date.now() - 10 * 60_000);

    const replay = await request(app)
      .post('/api/auth/refresh')
      .set('Origin', ORIGIN)
      .set('Cookie', `${COOKIE}=${refreshToken}`);

    expect(replay.status).toBe(401);
    expect(replay.body.code).toBe('SESSION_REVOKED');
  });
});

describe('POST /api/auth/refresh — native (body transport)', () => {
  it('returns the refresh token in the body and sets no cookie', async () => {
    const { refreshToken } = await seedSession('native');

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('X-Client-Type', 'native')
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(typeof res.body.refreshToken).toBe('string');
    expect(res.body.refreshToken).not.toBe(refreshToken); // rotated
    // No refresh cookie is issued to a native client.
    const setCookie = setCookies(res);
    expect(setCookie.some((c) => c.startsWith(`${COOKIE}=` ) && !c.includes(`${COOKIE}=;`))).toBe(false);
  });

  it('accepts the token from the X-Refresh-Token header too', async () => {
    const { refreshToken } = await seedSession('native');

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('X-Client-Type', 'native')
      .set('X-Refresh-Token', refreshToken);

    expect(res.status).toBe(200);
  });
});

describe('logout', () => {
  it('revokes the session so the token cannot restore it', async () => {
    const { refreshToken } = await seedSession();

    const out = await request(app)
      .post('/api/auth/logout')
      .set('Origin', ORIGIN)
      .set('Cookie', `${COOKIE}=${refreshToken}`);
    expect(out.status).toBe(200);
    expect(setCookies(out).join(';')).toMatch(/fixo_rt=;/);

    const after = await request(app)
      .post('/api/auth/refresh')
      .set('Origin', ORIGIN)
      .set('Cookie', `${COOKIE}=${refreshToken}`);
    expect(after.status).toBe(401);
  });

  it('succeeds even with no session, so a client is never stuck signed in', async () => {
    const res = await request(app).post('/api/auth/logout').set('Origin', ORIGIN);
    expect(res.status).toBe(200);
  });
});

describe('CSRF origin guard', () => {
  it('rejects a refresh from an untrusted origin', async () => {
    const { refreshToken } = await seedSession();

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Origin', 'https://evil.example')
      .set('Cookie', `${COOKIE}=${refreshToken}`);

    expect(res.status).toBe(403);
  });

  it('allows a request with no Origin (native app / server-to-server)', async () => {
    const { refreshToken } = await seedSession('native');
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('X-Client-Type', 'native')
      .send({ refreshToken });

    expect(res.status).toBe(200);
  });
});

describe('protected session routes', () => {
  it('requires authentication for logout-all and the session list', async () => {
    expect((await request(app).post('/api/auth/logout-all').set('Origin', ORIGIN)).status).toBe(401);
    expect((await request(app).get('/api/auth/sessions')).status).toBe(401);
  });

  it('lists sessions without exposing any token hash', async () => {
    const { accessToken } = await seedSession();

    const res = await request(app)
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.sessions)).toBe(true);
    expect(res.body.sessions[0]).toHaveProperty('deviceName');
    expect(res.body.sessions[0].current).toBe(true);

    const dumped = JSON.stringify(res.body);
    expect(dumped).not.toContain('refreshTokenHash');
    expect(dumped).not.toContain('previousTokenHash');
  });

  it('logout-all revokes every session for the caller', async () => {
    const a = await seedSession();
    await seedSession();

    const res = await request(app)
      .post('/api/auth/logout-all')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${a.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.sessionsRevoked).toBe(2);
    expect(rows.every((r) => r.revokedAt !== null)).toBe(true);
  });
});
