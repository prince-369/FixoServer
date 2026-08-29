"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const vitest_1 = require("vitest");
let rows = [];
let seq = 0;
const matches = (doc, filter) => Object.entries(filter).every(([key, want]) => {
    if (key === '$or')
        return want.some((sub) => matches(doc, sub));
    const have = doc[key];
    if (want && typeof want === 'object' && !(want instanceof Date)) {
        if ('$ne' in want)
            return String(have) !== String(want.$ne);
        if ('$gt' in want)
            return have > want.$gt;
        if ('$in' in want)
            return want.$in.map(String).includes(String(have));
    }
    if (want === null)
        return have === null || have === undefined;
    return String(have) === String(want);
});
const applyUpdate = (doc, update) => {
    Object.assign(doc, update.$set || {});
    for (const [k, d] of Object.entries(update.$inc || {}))
        doc[k] += d;
};
vitest_1.vi.mock('../models/AuthSession', () => ({
    default: {
        create: vitest_1.vi.fn(async (data) => {
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
            };
            rows.push(doc);
            return doc;
        }),
        findOne: vitest_1.vi.fn(async (f) => rows.find((d) => matches(d, f)) || null),
        find: vitest_1.vi.fn((f) => {
            const out = rows.filter((d) => matches(d, f));
            const chain = {
                sort: () => chain,
                limit: () => chain,
                select: () => chain,
                lean: async () => out,
                then: (r) => Promise.resolve(out).then(r),
            };
            return chain;
        }),
        findOneAndUpdate: vitest_1.vi.fn(async (f, u) => {
            const d = rows.find((x) => matches(x, f));
            if (!d)
                return null;
            applyUpdate(d, u);
            return d;
        }),
        updateOne: vitest_1.vi.fn(async (f, u) => {
            const d = rows.find((x) => matches(x, f));
            if (!d)
                return { modifiedCount: 0 };
            applyUpdate(d, u);
            return { modifiedCount: 1 };
        }),
        updateMany: vitest_1.vi.fn(async (f, u) => {
            const ds = rows.filter((x) => matches(x, f));
            ds.forEach((d) => applyUpdate(d, u));
            return { modifiedCount: ds.length };
        }),
        deleteMany: vitest_1.vi.fn(async (f) => {
            rows = rows.filter((d) => !matches(d, f));
            return { deletedCount: 0 };
        }),
    },
}));
// No legacy rows in these scenarios.
vitest_1.vi.mock('../models/RefreshToken', () => ({
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
const chain = (value) => {
    const c = {
        select: () => c,
        populate: () => c,
        lean: async () => value,
        then: (r) => Promise.resolve(value).then(r),
    };
    return c;
};
vitest_1.vi.mock('../models/User', () => ({ default: { findById: () => chain(userDoc) } }));
vitest_1.vi.mock('../models/Worker', () => ({ default: { findById: () => chain(userDoc) } }));
vitest_1.vi.mock('../models/Admin', () => ({ default: { findById: () => chain(null) } }));
let app;
let svc;
const ORIGIN = 'http://localhost:3000';
const COOKIE = 'fixo_rt';
/** Node sends `set-cookie` as an array; supertest's types say `string`. */
const setCookies = (res) => {
    const raw = res.headers['set-cookie'];
    if (Array.isArray(raw))
        return raw;
    return raw ? [String(raw)] : [];
};
(0, vitest_1.beforeAll)(async () => {
    process.env.JWT_SECRET = 'ci-test-jwt-secret';
    process.env.REFRESH_TOKEN_HASH_SECRET = 'ci-test-hash-secret';
    process.env.ACCESS_TOKEN_TTL = '15m';
    process.env.REFRESH_TOKEN_TTL = '30d';
    process.env.REFRESH_COOKIE_NAME = COOKIE;
    process.env.REFRESH_COOKIE_PATH = '/api/auth';
    process.env.REFRESH_COOKIE_SECURE = 'true';
    process.env.REFRESH_COOKIE_SAMESITE = 'lax';
    process.env.CLIENT_URL = ORIGIN;
    svc = await Promise.resolve().then(() => __importStar(require('../services/authSession.service')));
    app = (await Promise.resolve().then(() => __importStar(require('../app')))).default;
});
(0, vitest_1.beforeEach)(() => {
    rows = [];
    seq = 0;
});
const seedSession = async (clientType = 'web') => {
    const { refreshToken, accessToken } = await svc.createSession('user-1', 'customer', {
        clientType,
        userAgent: 'vitest',
        ipAddress: '127.0.0.1',
    });
    return { refreshToken, accessToken };
};
(0, vitest_1.describe)('POST /api/auth/refresh — web (cookie transport)', () => {
    (0, vitest_1.it)('rotates the cookie and never puts the refresh token in the body', async () => {
        const { refreshToken } = await seedSession();
        const res = await (0, supertest_1.default)(app)
            .post('/api/auth/refresh')
            .set('Origin', ORIGIN)
            .set('Cookie', `${COOKIE}=${refreshToken}`);
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.accessToken).toBeTruthy();
        (0, vitest_1.expect)(res.body.role).toBe('customer');
        // The browser must receive the refresh token ONLY as a cookie.
        (0, vitest_1.expect)(res.body.refreshToken).toBeUndefined();
        (0, vitest_1.expect)(JSON.stringify(res.body)).not.toContain(refreshToken);
        const setCookie = setCookies(res).join(';');
        (0, vitest_1.expect)(setCookie).toContain(`${COOKIE}=`);
        // A NEW token — rotation actually happened.
        (0, vitest_1.expect)(setCookie).not.toContain(refreshToken);
    });
    (0, vitest_1.it)('sets HttpOnly, Secure, SameSite and a scoped Path on the cookie', async () => {
        const { refreshToken } = await seedSession();
        const res = await (0, supertest_1.default)(app)
            .post('/api/auth/refresh')
            .set('Origin', ORIGIN)
            .set('Cookie', `${COOKIE}=${refreshToken}`);
        const cookie = setCookies(res).find((c) => c.startsWith(`${COOKIE}=`));
        (0, vitest_1.expect)(cookie).toMatch(/HttpOnly/i);
        (0, vitest_1.expect)(cookie).toMatch(/Secure/i);
        (0, vitest_1.expect)(cookie).toMatch(/SameSite=Lax/i);
        (0, vitest_1.expect)(cookie).toMatch(/Path=\/api\/auth/i);
        // 30 days, give or take a second of request time.
        const maxAge = Number(/Max-Age=(\d+)/i.exec(cookie)?.[1]);
        (0, vitest_1.expect)(maxAge).toBeGreaterThan(29 * 86400);
    });
    (0, vitest_1.it)('returns the user profile so restore is a single round trip', async () => {
        const { refreshToken } = await seedSession();
        const res = await (0, supertest_1.default)(app)
            .post('/api/auth/refresh')
            .set('Origin', ORIGIN)
            .set('Cookie', `${COOKIE}=${refreshToken}`);
        (0, vitest_1.expect)(res.body).toHaveProperty('user');
        (0, vitest_1.expect)(res.body).toHaveProperty('block');
    });
    (0, vitest_1.it)('401s with a machine-readable code when no token is presented', async () => {
        const res = await (0, supertest_1.default)(app).post('/api/auth/refresh').set('Origin', ORIGIN);
        (0, vitest_1.expect)(res.status).toBe(401);
        (0, vitest_1.expect)(res.body.code).toBe('NO_SESSION');
    });
    (0, vitest_1.it)('401s — not 500 — for a garbage token, and clears the cookie', async () => {
        const res = await (0, supertest_1.default)(app)
            .post('/api/auth/refresh')
            .set('Origin', ORIGIN)
            .set('Cookie', `${COOKIE}=totally-invalid`);
        (0, vitest_1.expect)(res.status).toBe(401);
        (0, vitest_1.expect)(res.body.code).toBe('SESSION_INVALID');
        (0, vitest_1.expect)(setCookies(res).join(';')).toMatch(/fixo_rt=;/);
    });
    (0, vitest_1.it)('reports SESSION_REVOKED when a retired token is replayed', async () => {
        const { refreshToken } = await seedSession();
        await (0, supertest_1.default)(app).post('/api/auth/refresh').set('Origin', ORIGIN).set('Cookie', `${COOKIE}=${refreshToken}`);
        // Age the rotation past the retry grace window.
        rows[0].previousTokenRotatedAt = new Date(Date.now() - 10 * 60000);
        const replay = await (0, supertest_1.default)(app)
            .post('/api/auth/refresh')
            .set('Origin', ORIGIN)
            .set('Cookie', `${COOKIE}=${refreshToken}`);
        (0, vitest_1.expect)(replay.status).toBe(401);
        (0, vitest_1.expect)(replay.body.code).toBe('SESSION_REVOKED');
    });
});
(0, vitest_1.describe)('POST /api/auth/refresh — native (body transport)', () => {
    (0, vitest_1.it)('returns the refresh token in the body and sets no cookie', async () => {
        const { refreshToken } = await seedSession('native');
        const res = await (0, supertest_1.default)(app)
            .post('/api/auth/refresh')
            .set('X-Client-Type', 'native')
            .send({ refreshToken });
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.accessToken).toBeTruthy();
        (0, vitest_1.expect)(typeof res.body.refreshToken).toBe('string');
        (0, vitest_1.expect)(res.body.refreshToken).not.toBe(refreshToken); // rotated
        // No refresh cookie is issued to a native client.
        const setCookie = setCookies(res);
        (0, vitest_1.expect)(setCookie.some((c) => c.startsWith(`${COOKIE}=`) && !c.includes(`${COOKIE}=;`))).toBe(false);
    });
    (0, vitest_1.it)('accepts the token from the X-Refresh-Token header too', async () => {
        const { refreshToken } = await seedSession('native');
        const res = await (0, supertest_1.default)(app)
            .post('/api/auth/refresh')
            .set('X-Client-Type', 'native')
            .set('X-Refresh-Token', refreshToken);
        (0, vitest_1.expect)(res.status).toBe(200);
    });
});
(0, vitest_1.describe)('logout', () => {
    (0, vitest_1.it)('revokes the session so the token cannot restore it', async () => {
        const { refreshToken } = await seedSession();
        const out = await (0, supertest_1.default)(app)
            .post('/api/auth/logout')
            .set('Origin', ORIGIN)
            .set('Cookie', `${COOKIE}=${refreshToken}`);
        (0, vitest_1.expect)(out.status).toBe(200);
        (0, vitest_1.expect)(setCookies(out).join(';')).toMatch(/fixo_rt=;/);
        const after = await (0, supertest_1.default)(app)
            .post('/api/auth/refresh')
            .set('Origin', ORIGIN)
            .set('Cookie', `${COOKIE}=${refreshToken}`);
        (0, vitest_1.expect)(after.status).toBe(401);
    });
    (0, vitest_1.it)('succeeds even with no session, so a client is never stuck signed in', async () => {
        const res = await (0, supertest_1.default)(app).post('/api/auth/logout').set('Origin', ORIGIN);
        (0, vitest_1.expect)(res.status).toBe(200);
    });
});
(0, vitest_1.describe)('CSRF origin guard', () => {
    (0, vitest_1.it)('rejects a refresh from an untrusted origin', async () => {
        const { refreshToken } = await seedSession();
        const res = await (0, supertest_1.default)(app)
            .post('/api/auth/refresh')
            .set('Origin', 'https://evil.example')
            .set('Cookie', `${COOKIE}=${refreshToken}`);
        (0, vitest_1.expect)(res.status).toBe(403);
    });
    (0, vitest_1.it)('allows a request with no Origin (native app / server-to-server)', async () => {
        const { refreshToken } = await seedSession('native');
        const res = await (0, supertest_1.default)(app)
            .post('/api/auth/refresh')
            .set('X-Client-Type', 'native')
            .send({ refreshToken });
        (0, vitest_1.expect)(res.status).toBe(200);
    });
});
(0, vitest_1.describe)('protected session routes', () => {
    (0, vitest_1.it)('requires authentication for logout-all and the session list', async () => {
        (0, vitest_1.expect)((await (0, supertest_1.default)(app).post('/api/auth/logout-all').set('Origin', ORIGIN)).status).toBe(401);
        (0, vitest_1.expect)((await (0, supertest_1.default)(app).get('/api/auth/sessions')).status).toBe(401);
    });
    (0, vitest_1.it)('lists sessions without exposing any token hash', async () => {
        const { accessToken } = await seedSession();
        const res = await (0, supertest_1.default)(app)
            .get('/api/auth/sessions')
            .set('Authorization', `Bearer ${accessToken}`);
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(Array.isArray(res.body.sessions)).toBe(true);
        (0, vitest_1.expect)(res.body.sessions[0]).toHaveProperty('deviceName');
        (0, vitest_1.expect)(res.body.sessions[0].current).toBe(true);
        const dumped = JSON.stringify(res.body);
        (0, vitest_1.expect)(dumped).not.toContain('refreshTokenHash');
        (0, vitest_1.expect)(dumped).not.toContain('previousTokenHash');
    });
    (0, vitest_1.it)('logout-all revokes every session for the caller', async () => {
        const a = await seedSession();
        await seedSession();
        const res = await (0, supertest_1.default)(app)
            .post('/api/auth/logout-all')
            .set('Origin', ORIGIN)
            .set('Authorization', `Bearer ${a.accessToken}`);
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.sessionsRevoked).toBe(2);
        (0, vitest_1.expect)(rows.every((r) => r.revokedAt !== null)).toBe(true);
    });
});
//# sourceMappingURL=authSession.route.test.js.map