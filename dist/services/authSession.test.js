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
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
let store = [];
let seq = 0;
const matches = (doc, filter) => Object.entries(filter).every(([key, want]) => {
    if (key === '$or') {
        return want.some((sub) => matches(doc, sub));
    }
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
    for (const [key, delta] of Object.entries(update.$inc || {})) {
        doc[key] += delta;
    }
};
vitest_1.vi.mock('../models/AuthSession', () => ({
    default: {
        create: vitest_1.vi.fn(async (data) => {
            const doc = {
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
            };
            store.push(doc);
            return doc;
        }),
        findOne: vitest_1.vi.fn(async (filter) => store.find((d) => matches(d, filter)) || null),
        find: vitest_1.vi.fn((filter) => {
            const rows = store.filter((d) => matches(d, filter));
            const chain = {
                sort: () => chain,
                limit: () => chain,
                select: () => chain,
                lean: async () => rows,
                then: (resolve) => Promise.resolve(rows).then(resolve),
            };
            return chain;
        }),
        findOneAndUpdate: vitest_1.vi.fn(async (filter, update) => {
            const doc = store.find((d) => matches(d, filter));
            if (!doc)
                return null;
            applyUpdate(doc, update);
            return doc;
        }),
        updateOne: vitest_1.vi.fn(async (filter, update) => {
            const doc = store.find((d) => matches(d, filter));
            if (!doc)
                return { modifiedCount: 0 };
            applyUpdate(doc, update);
            return { modifiedCount: 1 };
        }),
        updateMany: vitest_1.vi.fn(async (filter, update) => {
            const docs = store.filter((d) => matches(d, filter));
            docs.forEach((d) => applyUpdate(d, update));
            return { modifiedCount: docs.length };
        }),
        deleteMany: vitest_1.vi.fn(async (filter) => {
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
vitest_1.vi.mock('../models/User', () => ({ default: { findById: findByIdStub } }));
vitest_1.vi.mock('../models/Worker', () => ({ default: { findById: findByIdStub } }));
vitest_1.vi.mock('../models/Admin', () => ({ default: { findById: findByIdStub } }));
let svc;
(0, vitest_1.beforeAll)(async () => {
    process.env.JWT_SECRET = 'ci-test-jwt-secret';
    process.env.REFRESH_TOKEN_HASH_SECRET = 'ci-test-hash-secret';
    process.env.REFRESH_TOKEN_TTL = '30d';
    process.env.ACCESS_TOKEN_TTL = '15m';
    process.env.REFRESH_REUSE_GRACE_MS = '60000';
    svc = await Promise.resolve().then(() => __importStar(require('./authSession.service')));
});
(0, vitest_1.beforeEach)(() => {
    store = [];
    seq = 0;
    accountUsable.value = true;
});
const device = { clientType: 'web', userAgent: 'vitest', ipAddress: '127.0.0.1' };
(0, vitest_1.describe)('refresh token hashing', () => {
    (0, vitest_1.it)('never stores the raw token — only a keyed hash', async () => {
        const { refreshToken } = await svc.createSession('user-1', 'customer', device);
        (0, vitest_1.expect)(store).toHaveLength(1);
        (0, vitest_1.expect)(store[0].refreshTokenHash).not.toBe(refreshToken);
        (0, vitest_1.expect)(store[0].refreshTokenHash).toMatch(/^[0-9a-f]{64}$/);
        // The raw token must appear nowhere in the persisted document.
        (0, vitest_1.expect)(JSON.stringify(store[0])).not.toContain(refreshToken);
    });
    (0, vitest_1.it)('is deterministic for the same token', () => {
        (0, vitest_1.expect)(svc.hashRefreshToken('abc')).toBe(svc.hashRefreshToken('abc'));
        (0, vitest_1.expect)(svc.hashRefreshToken('abc')).not.toBe(svc.hashRefreshToken('abd'));
    });
    (0, vitest_1.it)('issues a high-entropy token that is never repeated', async () => {
        const tokens = new Set();
        for (let i = 0; i < 25; i += 1) {
            const { refreshToken } = await svc.createSession('user-1', 'customer', device);
            (0, vitest_1.expect)(refreshToken.length).toBeGreaterThanOrEqual(43); // 256 bits, base64url
            tokens.add(refreshToken);
        }
        (0, vitest_1.expect)(tokens.size).toBe(25);
    });
});
(0, vitest_1.describe)('rotation', () => {
    (0, vitest_1.it)('issues a NEW refresh token on every refresh', async () => {
        const { refreshToken: t1 } = await svc.createSession('user-1', 'customer', device);
        const r1 = await svc.rotateSession(t1, device);
        (0, vitest_1.expect)(r1.ok).toBe(true);
        if (!r1.ok)
            return;
        (0, vitest_1.expect)(r1.refreshToken).not.toBe(t1);
        const r2 = await svc.rotateSession(r1.refreshToken, device);
        (0, vitest_1.expect)(r2.ok).toBe(true);
        if (!r2.ok)
            return;
        (0, vitest_1.expect)(r2.refreshToken).not.toBe(r1.refreshToken);
        (0, vitest_1.expect)(r2.session.rotationCount).toBe(2);
    });
    (0, vitest_1.it)('keeps the session (and its family) stable across rotations', async () => {
        const { refreshToken, session } = await svc.createSession('user-1', 'customer', device);
        const rotated = await svc.rotateSession(refreshToken, device);
        (0, vitest_1.expect)(rotated.ok).toBe(true);
        if (!rotated.ok)
            return;
        (0, vitest_1.expect)(String(rotated.session._id)).toBe(String(session._id));
        (0, vitest_1.expect)(rotated.session.tokenFamilyId).toBe(session.tokenFamilyId);
        // One row per device — rotation must not multiply sessions.
        (0, vitest_1.expect)(store).toHaveLength(1);
    });
    (0, vitest_1.it)('rejects an unknown token', async () => {
        const result = await svc.rotateSession('not-a-real-token', device);
        (0, vitest_1.expect)(result).toMatchObject({ ok: false, failure: 'not_found' });
    });
    (0, vitest_1.it)('rejects a missing token', async () => {
        (0, vitest_1.expect)(await svc.rotateSession(null, device)).toMatchObject({ ok: false, failure: 'no_token' });
    });
    (0, vitest_1.it)('rejects an expired session', async () => {
        const { refreshToken } = await svc.createSession('user-1', 'customer', device);
        store[0].expiresAt = new Date(Date.now() - 1000);
        (0, vitest_1.expect)(await svc.rotateSession(refreshToken, device)).toMatchObject({
            ok: false,
            failure: 'expired',
        });
    });
    (0, vitest_1.it)('rejects a revoked session', async () => {
        const { refreshToken } = await svc.createSession('user-1', 'customer', device);
        store[0].revokedAt = new Date();
        (0, vitest_1.expect)(await svc.rotateSession(refreshToken, device)).toMatchObject({
            ok: false,
            failure: 'revoked',
        });
    });
    (0, vitest_1.it)('rejects refresh for an account that is no longer usable', async () => {
        const { refreshToken } = await svc.createSession('user-1', 'customer', device);
        accountUsable.value = false;
        const result = await svc.rotateSession(refreshToken, device);
        (0, vitest_1.expect)(result).toMatchObject({ ok: false, failure: 'account_unusable' });
        // ...and the session is torn down, so it cannot resume if the account returns.
        (0, vitest_1.expect)(store[0].revokedAt).not.toBeNull();
    });
});
(0, vitest_1.describe)('reuse detection', () => {
    (0, vitest_1.it)('revokes the whole family when a retired token is replayed after the grace window', async () => {
        const { refreshToken: stolen } = await svc.createSession('user-1', 'customer', device);
        const legit = await svc.rotateSession(stolen, device);
        (0, vitest_1.expect)(legit.ok).toBe(true);
        // Push the rotation outside the retry grace window.
        store[0].previousTokenRotatedAt = new Date(Date.now() - 5 * 60000);
        const replay = await svc.rotateSession(stolen, device);
        (0, vitest_1.expect)(replay).toMatchObject({ ok: false, failure: 'reuse_detected' });
        (0, vitest_1.expect)(store[0].revokedAt).not.toBeNull();
        (0, vitest_1.expect)(store[0].revokedReason).toBe('rotated_reuse_detected');
        // The token the legitimate client holds is dead too — the family is gone.
        if (legit.ok) {
            (0, vitest_1.expect)(await svc.rotateSession(legit.refreshToken, device)).toMatchObject({ ok: false });
        }
    });
    (0, vitest_1.it)('treats an immediate replay as a benign client retry, not theft', async () => {
        // A client whose rotation response was lost to a flaky network retries with the
        // same token. Revoking the family there would log a real user out for no reason.
        const { refreshToken } = await svc.createSession('user-1', 'customer', device);
        const first = await svc.rotateSession(refreshToken, device);
        (0, vitest_1.expect)(first.ok).toBe(true);
        const retry = await svc.rotateSession(refreshToken, device);
        (0, vitest_1.expect)(retry.ok).toBe(true);
        (0, vitest_1.expect)(store[0].revokedAt).toBeNull();
    });
});
(0, vitest_1.describe)('revocation', () => {
    (0, vitest_1.it)('logout kills the session so the refresh token cannot restore it', async () => {
        const { refreshToken } = await svc.createSession('user-1', 'customer', device);
        (0, vitest_1.expect)(await svc.revokeSessionByToken(refreshToken, 'logout')).toBe(true);
        (0, vitest_1.expect)(await svc.rotateSession(refreshToken, device)).toMatchObject({ ok: false });
    });
    (0, vitest_1.it)('logout-all revokes every session for the identity', async () => {
        const a = await svc.createSession('user-1', 'customer', { ...device, deviceId: 'phone' });
        const b = await svc.createSession('user-1', 'customer', { ...device, deviceId: 'laptop' });
        const count = await svc.revokeAllSessions('user-1', 'customer', 'logout_all');
        (0, vitest_1.expect)(count).toBe(2);
        (0, vitest_1.expect)(await svc.rotateSession(a.refreshToken, device)).toMatchObject({ ok: false });
        (0, vitest_1.expect)(await svc.rotateSession(b.refreshToken, device)).toMatchObject({ ok: false });
    });
    (0, vitest_1.it)('can spare the acting session (password change keeps you signed in here)', async () => {
        const here = await svc.createSession('user-1', 'customer', { ...device, deviceId: 'laptop' });
        const elsewhere = await svc.createSession('user-1', 'customer', { ...device, deviceId: 'phone' });
        await svc.revokeAllSessions('user-1', 'customer', 'password_changed', String(here.session._id));
        (0, vitest_1.expect)(await svc.rotateSession(here.refreshToken, device)).toMatchObject({ ok: true });
        (0, vitest_1.expect)(await svc.rotateSession(elsewhere.refreshToken, device)).toMatchObject({ ok: false });
    });
});
(0, vitest_1.describe)('multi-device', () => {
    (0, vitest_1.it)('keeps one independent session per device', async () => {
        const phone = await svc.createSession('user-1', 'customer', { ...device, deviceId: 'phone' });
        const laptop = await svc.createSession('user-1', 'customer', { ...device, deviceId: 'laptop' });
        // Logging in on a second device must not disturb the first.
        (0, vitest_1.expect)(await svc.rotateSession(phone.refreshToken, device)).toMatchObject({ ok: true });
        (0, vitest_1.expect)(await svc.rotateSession(laptop.refreshToken, device)).toMatchObject({ ok: true });
        (0, vitest_1.expect)(phone.session.tokenFamilyId).not.toBe(laptop.session.tokenFamilyId);
    });
    (0, vitest_1.it)('re-login on a known device replaces that device session instead of stacking', async () => {
        await svc.createSession('user-1', 'customer', { ...device, deviceId: 'phone' });
        await svc.createSession('user-1', 'customer', { ...device, deviceId: 'phone' });
        (0, vitest_1.expect)(store.filter((s) => s.deviceId === 'phone')).toHaveLength(1);
    });
});
(0, vitest_1.describe)('transport', () => {
    (0, vitest_1.it)('reads the refresh token from cookie, header or body', () => {
        const cookieName = process.env.REFRESH_COOKIE_NAME || 'fixo_rt';
        (0, vitest_1.expect)(svc.readRefreshToken({ cookies: { [cookieName]: 'c' }, headers: {} })).toBe('c');
        (0, vitest_1.expect)(svc.readRefreshToken({ cookies: {}, headers: { 'x-refresh-token': 'h' } })).toBe('h');
        (0, vitest_1.expect)(svc.readRefreshToken({ cookies: {}, headers: {}, body: { refreshToken: 'b' } })).toBe('b');
        (0, vitest_1.expect)(svc.readRefreshToken({ cookies: {}, headers: {} })).toBeNull();
    });
    (0, vitest_1.it)('still recognises the legacy cookie so existing users are not logged out', () => {
        (0, vitest_1.expect)(svc.readRefreshToken({ cookies: { refreshToken: 'legacy' }, headers: {} })).toBe('legacy');
    });
    (0, vitest_1.it)('classifies native clients so only they receive the token in a body', () => {
        (0, vitest_1.expect)(svc.isNativeClient({ headers: { 'x-client-type': 'native' } })).toBe(true);
        (0, vitest_1.expect)(svc.isNativeClient({ headers: { 'x-client-type': 'web' } })).toBe(false);
        (0, vitest_1.expect)(svc.isNativeClient({ headers: {} })).toBe(false);
    });
    (0, vitest_1.it)('sets an HttpOnly refresh cookie scoped to the auth path', () => {
        const cookie = vitest_1.vi.fn();
        svc.setRefreshCookie({ cookie }, 'tok');
        const [, value, options] = cookie.mock.calls[0];
        (0, vitest_1.expect)(value).toBe('tok');
        (0, vitest_1.expect)(options.httpOnly).toBe(true);
        (0, vitest_1.expect)(options.path).toBe('/api/auth');
        (0, vitest_1.expect)(['lax', 'strict', 'none']).toContain(options.sameSite);
    });
});
//# sourceMappingURL=authSession.test.js.map