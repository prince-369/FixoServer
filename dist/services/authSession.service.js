"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listSessions = exports.revokeAllSessions = exports.revokeFamily = exports.revokeSessionById = exports.revokeSessionByToken = exports.rotateSession = exports.createSession = exports.checkAccountUsable = exports.readRefreshToken = exports.clearRefreshCookie = exports.setRefreshCookie = exports.readDeviceContext = exports.isNativeClient = exports.resolveClientType = exports.hashRefreshToken = void 0;
const crypto_1 = __importDefault(require("crypto"));
const mongoose_1 = __importDefault(require("mongoose"));
const AuthSession_1 = __importDefault(require("../models/AuthSession"));
const User_1 = __importDefault(require("../models/User"));
const Worker_1 = __importDefault(require("../models/Worker"));
const Admin_1 = __importDefault(require("../models/Admin"));
const adminPermissions_1 = require("../config/adminPermissions");
const generateToken_1 = require("../utils/generateToken");
const env_1 = __importDefault(require("../config/env"));
const logger_1 = __importDefault(require("../utils/logger"));
/* ────────────────────────────────────────────────────────────────────────────
 * Token material
 * ────────────────────────────────────────────────────────────────────────── */
/**
 * 256 bits of CSPRNG entropy, base64url-encoded. Opaque — it carries no claims, so
 * it cannot be used as a bearer credential anywhere and is only meaningful when
 * matched against a stored hash.
 */
const generateRefreshTokenString = () => crypto_1.default.randomBytes(32).toString('base64url');
/**
 * Keyed (HMAC) hash, not a bare digest: a database dump alone is not enough to
 * pre-compute matches without also holding REFRESH_TOKEN_HASH_SECRET.
 *
 * A slow KDF (bcrypt/argon2) is deliberately NOT used here. These tokens are full
 * 256-bit random values, not user-chosen passwords, so there is nothing to brute
 * force — and /auth/refresh is on the hot path for every client.
 */
const hashRefreshToken = (token) => crypto_1.default.createHmac('sha256', env_1.default.REFRESH_TOKEN_HASH_SECRET).update(token).digest('hex');
exports.hashRefreshToken = hashRefreshToken;
/**
 * Native clients (the Expo apps) cannot use cookies, so they announce themselves
 * and receive the refresh token in the response body instead. Everything else is
 * treated as a browser and gets an HttpOnly cookie.
 */
const resolveClientType = (req) => {
    const raw = String(req.headers['x-client-type'] || '').trim().toLowerCase();
    if (raw === 'native' || raw === 'mobile')
        return 'native';
    if (raw === 'web')
        return 'web';
    return 'unknown';
};
exports.resolveClientType = resolveClientType;
const isNativeClient = (req) => (0, exports.resolveClientType)(req) === 'native';
exports.isNativeClient = isNativeClient;
const truncate = (value, max) => value ? value.slice(0, max) : undefined;
const readDeviceContext = (req) => ({
    deviceId: truncate(String(req.headers['x-device-id'] || '').trim() || undefined, 128),
    deviceName: truncate(String(req.headers['x-device-name'] || '').trim() || undefined, 128),
    clientType: (0, exports.resolveClientType)(req),
    userAgent: truncate(req.headers['user-agent'], 512),
    ipAddress: truncate(req.ip, 64),
});
exports.readDeviceContext = readDeviceContext;
/* ────────────────────────────────────────────────────────────────────────────
 * Refresh-token transport (cookie for web, body for native)
 * ────────────────────────────────────────────────────────────────────────── */
/**
 * Cookie attributes are fully env-driven so the same build serves both supported
 * topologies without a code change:
 *
 *   proxy / same-origin      REFRESH_COOKIE_DOMAIN=""              (host-only)
 *   shared-apex subdomains   REFRESH_COOKIE_DOMAIN=".fixoservice.in"
 *
 * Path is scoped to the auth routes, so the refresh token is not attached to every
 * ordinary API call — it only travels where it is actually needed.
 */
const baseCookieOptions = () => ({
    httpOnly: true,
    secure: env_1.default.REFRESH_COOKIE_SECURE,
    sameSite: env_1.default.REFRESH_COOKIE_SAMESITE,
    path: env_1.default.REFRESH_COOKIE_PATH,
    ...(env_1.default.REFRESH_COOKIE_DOMAIN ? { domain: env_1.default.REFRESH_COOKIE_DOMAIN } : {}),
});
const setRefreshCookie = (res, token) => {
    res.cookie(env_1.default.REFRESH_COOKIE_NAME, token, {
        ...baseCookieOptions(),
        maxAge: env_1.default.REFRESH_TOKEN_TTL_MS,
    });
};
exports.setRefreshCookie = setRefreshCookie;
const clearRefreshCookie = (res) => {
    // Attributes must match the ones used to set it, or the browser keeps the cookie.
    res.clearCookie(env_1.default.REFRESH_COOKIE_NAME, baseCookieOptions());
    // Legacy cookie from the pre-rotation implementation (name "refreshToken",
    // Path=/). Cleared on every logout/failed refresh so old deployments drain.
    res.clearCookie('refreshToken', { httpOnly: true, path: '/' });
};
exports.clearRefreshCookie = clearRefreshCookie;
/** Reads the presented refresh token from whichever transport the client used. */
const readRefreshToken = (req) => {
    const fromCookie = req.cookies?.[env_1.default.REFRESH_COOKIE_NAME];
    if (typeof fromCookie === 'string' && fromCookie)
        return fromCookie;
    const fromHeader = req.headers['x-refresh-token'];
    if (typeof fromHeader === 'string' && fromHeader.trim())
        return fromHeader.trim();
    const fromBody = req.body?.refreshToken;
    if (typeof fromBody === 'string' && fromBody.trim())
        return fromBody.trim();
    // Legacy cookie — lets sessions created by the previous implementation be
    // recognised so those users are migrated rather than logged out. See
    // `adoptLegacyRefreshToken` in auth.controller.
    const legacy = req.cookies?.refreshToken;
    if (typeof legacy === 'string' && legacy)
        return legacy;
    return null;
};
exports.readRefreshToken = readRefreshToken;
/**
 * Single source of truth for "may this identity still hold a session?", applied on
 * every login AND every refresh — so an admin block takes effect within one access
 * token lifetime (default 15 minutes) rather than never.
 */
const checkAccountUsable = async (userId, role) => {
    switch (role) {
        case 'customer': {
            const user = await User_1.default.findById(userId).select('isActive');
            if (!user)
                return { usable: false, reason: 'Account no longer exists' };
            if (user.isActive === false)
                return { usable: false, reason: 'Account is deactivated' };
            return { usable: true };
        }
        case 'worker': {
            const worker = await Worker_1.default.findById(userId).select('_id');
            if (!worker)
                return { usable: false, reason: 'Account no longer exists' };
            // Deliberately NOT checked here:
            //   • `isActive`        — that is the worker's own online/offline toggle.
            //   • `verificationStatus` / `accountStatus` ('test' | 'live') — professional
            //     verification is a separate concern from identity. An unverified worker
            //     needs a session precisely so they can finish onboarding.
            //   • `block`           — an admin block is temporary and the apps render a
            //     dedicated block screen with a countdown, which requires a live session.
            //     Killing the session here would replace that UX with a logout.
            return { usable: true };
        }
        case 'admin': {
            const admin = await Admin_1.default.findById(userId).select('isActive role email');
            if (!admin)
                return { usable: false, reason: 'Account no longer exists' };
            const superAdmin = admin.role === 'super_admin' || admin.role === 'superadmin' || (0, adminPermissions_1.isSuperAdminEmail)(admin.email);
            if (!superAdmin && admin.isActive === false) {
                return { usable: false, reason: 'Your staff account has been disabled' };
            }
            return { usable: true };
        }
        default:
            return { usable: false, reason: 'Unknown role' };
    }
};
exports.checkAccountUsable = checkAccountUsable;
/**
 * Creates a session and its first token pair. This is the ONLY place a session is
 * born, and it is intentionally decoupled from *how* identity was proven — password,
 * Google, or (later) phone OTP all call this once they know who the user is.
 */
const createSession = async (userId, role, device) => {
    const refreshToken = generateRefreshTokenString();
    const now = Date.now();
    // Re-login from a known device replaces that device's session rather than adding
    // a second one, so the session list stays a true device list.
    if (device.deviceId) {
        await AuthSession_1.default.deleteMany({ userId, deviceId: device.deviceId });
    }
    const session = await AuthSession_1.default.create({
        userId,
        role,
        refreshTokenHash: (0, exports.hashRefreshToken)(refreshToken),
        tokenFamilyId: crypto_1.default.randomUUID(),
        rotationCount: 0,
        deviceId: device.deviceId ?? null,
        deviceName: device.deviceName ?? null,
        clientType: device.clientType,
        userAgent: device.userAgent ?? null,
        ipAddress: device.ipAddress ?? null,
        lastUsedAt: new Date(now),
        expiresAt: new Date(now + env_1.default.REFRESH_TOKEN_TTL_MS),
    });
    await enforceSessionLimit(userId, role);
    const accessToken = (0, generateToken_1.generateAccessToken)({
        id: userId,
        role,
        sid: String(session._id),
    });
    return { accessToken, refreshToken, session };
};
exports.createSession = createSession;
/**
 * Caps concurrent sessions per identity so a credential-stuffing run cannot mint
 * unbounded refresh tokens. Oldest-used sessions are dropped first, which is the
 * least disruptive choice for a genuine multi-device user.
 */
const enforceSessionLimit = async (userId, role) => {
    const active = await AuthSession_1.default.find({ userId, role, revokedAt: null })
        .sort({ lastUsedAt: -1 })
        .select('_id')
        .lean();
    if (active.length <= env_1.default.MAX_SESSIONS_PER_USER)
        return;
    const excess = active.slice(env_1.default.MAX_SESSIONS_PER_USER).map((s) => s._id);
    await AuthSession_1.default.updateMany({ _id: { $in: excess } }, { $set: { revokedAt: new Date(), revokedReason: 'session_limit' } });
};
/**
 * Validates a presented refresh token and rotates it.
 *
 * Rotation is unconditional on success: the presented token is retired and a fresh
 * one issued, so no refresh token is ever valid twice (outside the deliberate retry
 * grace window below).
 */
const rotateSession = async (presentedToken, device) => {
    if (!presentedToken) {
        return { ok: false, failure: 'no_token', message: 'No refresh token' };
    }
    const presentedHash = (0, exports.hashRefreshToken)(presentedToken);
    const now = new Date();
    let session = await AuthSession_1.default.findOne({ refreshTokenHash: presentedHash });
    let matchedPrevious = false;
    if (!session) {
        session = await AuthSession_1.default.findOne({ previousTokenHash: presentedHash });
        matchedPrevious = !!session;
    }
    if (!session) {
        return { ok: false, failure: 'not_found', message: 'Invalid refresh token' };
    }
    if (matchedPrevious) {
        const rotatedAt = session.previousTokenRotatedAt?.getTime() ?? 0;
        const withinGrace = Date.now() - rotatedAt <= env_1.default.REFRESH_REUSE_GRACE_MS;
        if (!withinGrace || session.revokedAt) {
            // Genuine replay of a retired token. The current token may already be in an
            // attacker's hands, so the whole family dies — every descendant of this login.
            await (0, exports.revokeFamily)(session.tokenFamilyId, 'rotated_reuse_detected');
            logger_1.default.warn('Refresh token reuse detected — family revoked', {
                // Never log token material. Identifiers only.
                sessionId: String(session._id),
                tokenFamilyId: session.tokenFamilyId,
                userId: String(session.userId),
                role: session.role,
                ipAddress: device.ipAddress,
            });
            return { ok: false, failure: 'reuse_detected', message: 'Session revoked for security reasons' };
        }
        // Inside the grace window: a legitimate client that never received the response
        // to its previous rotation. Fall through and rotate again.
    }
    if (session.revokedAt) {
        return { ok: false, failure: 'revoked', message: 'Session has been revoked' };
    }
    if (session.expiresAt.getTime() <= Date.now()) {
        await AuthSession_1.default.updateOne({ _id: session._id }, { $set: { revokedAt: now, revokedReason: 'expired' } });
        return { ok: false, failure: 'expired', message: 'Session expired' };
    }
    const status = await (0, exports.checkAccountUsable)(String(session.userId), session.role);
    if (!status.usable) {
        await AuthSession_1.default.updateOne({ _id: session._id }, { $set: { revokedAt: now, revokedReason: 'account_blocked' } });
        return { ok: false, failure: 'account_unusable', message: status.reason || 'Account unavailable' };
    }
    const nextToken = generateRefreshTokenString();
    // Sliding expiry: an actively used session keeps renewing up to the full TTL, so a
    // daily user is never logged out, while an abandoned session still dies on schedule.
    const updated = await AuthSession_1.default.findOneAndUpdate({ _id: session._id, refreshTokenHash: session.refreshTokenHash }, {
        $set: {
            refreshTokenHash: (0, exports.hashRefreshToken)(nextToken),
            previousTokenHash: session.refreshTokenHash,
            previousTokenRotatedAt: now,
            lastUsedAt: now,
            expiresAt: new Date(Date.now() + env_1.default.REFRESH_TOKEN_TTL_MS),
            // Keep device metadata fresh so the session list reflects reality.
            ...(device.userAgent ? { userAgent: device.userAgent } : {}),
            ...(device.ipAddress ? { ipAddress: device.ipAddress } : {}),
            ...(device.clientType !== 'unknown' ? { clientType: device.clientType } : {}),
        },
        $inc: { rotationCount: 1 },
    }, { new: true });
    if (!updated) {
        // Lost an optimistic race with a concurrent rotation of the same session. The
        // other request won and the client has a valid new token; this one must not
        // trigger reuse handling.
        return { ok: false, failure: 'not_found', message: 'Invalid refresh token' };
    }
    const accessToken = (0, generateToken_1.generateAccessToken)({
        id: String(updated.userId),
        role: updated.role,
        sid: String(updated._id),
    });
    return { ok: true, accessToken, refreshToken: nextToken, session: updated };
};
exports.rotateSession = rotateSession;
/* ────────────────────────────────────────────────────────────────────────────
 * Revocation
 * ────────────────────────────────────────────────────────────────────────── */
const revokeSessionByToken = async (presentedToken, reason = 'logout') => {
    if (!presentedToken)
        return false;
    const hash = (0, exports.hashRefreshToken)(presentedToken);
    const result = await AuthSession_1.default.updateOne({ $or: [{ refreshTokenHash: hash }, { previousTokenHash: hash }], revokedAt: null }, { $set: { revokedAt: new Date(), revokedReason: reason } });
    return result.modifiedCount > 0;
};
exports.revokeSessionByToken = revokeSessionByToken;
const revokeSessionById = async (sessionId, userId, reason = 'logout') => {
    if (!mongoose_1.default.isValidObjectId(sessionId))
        return false;
    const result = await AuthSession_1.default.updateOne({ _id: sessionId, userId, revokedAt: null }, { $set: { revokedAt: new Date(), revokedReason: reason } });
    return result.modifiedCount > 0;
};
exports.revokeSessionById = revokeSessionById;
const revokeFamily = async (tokenFamilyId, reason) => {
    const result = await AuthSession_1.default.updateMany({ tokenFamilyId, revokedAt: null }, { $set: { revokedAt: new Date(), revokedReason: reason } });
    return result.modifiedCount;
};
exports.revokeFamily = revokeFamily;
/**
 * Revokes every session for an identity. `exceptSessionId` lets "change password"
 * keep the acting device signed in while ending every other session.
 */
const revokeAllSessions = async (userId, role, reason, exceptSessionId) => {
    const filter = { userId, role, revokedAt: null };
    if (exceptSessionId && mongoose_1.default.isValidObjectId(exceptSessionId)) {
        filter._id = { $ne: new mongoose_1.default.Types.ObjectId(exceptSessionId) };
    }
    const result = await AuthSession_1.default.updateMany(filter, { $set: { revokedAt: new Date(), revokedReason: reason } });
    if (result.modifiedCount > 0) {
        logger_1.default.info('Auth sessions revoked', { userId, role, reason, count: result.modifiedCount });
    }
    return result.modifiedCount;
};
exports.revokeAllSessions = revokeAllSessions;
/** Best-effort human label, derived server-side so clients stay dumb. */
const describeDevice = (session) => {
    if (session.deviceName)
        return session.deviceName;
    const ua = session.userAgent || '';
    if (!ua)
        return session.clientType === 'native' ? 'Mobile app' : 'Unknown device';
    const browser = /Edg\//.test(ua) ? 'Edge'
        : /OPR\//.test(ua) ? 'Opera'
            : /Chrome\//.test(ua) ? 'Chrome'
                : /Safari\//.test(ua) ? 'Safari'
                    : /Firefox\//.test(ua) ? 'Firefox'
                        : 'Browser';
    const os = /Windows/.test(ua) ? 'Windows'
        : /Android/.test(ua) ? 'Android'
            : /iPhone|iPad|iOS/.test(ua) ? 'iOS'
                : /Mac OS X/.test(ua) ? 'macOS'
                    : /Linux/.test(ua) ? 'Linux'
                        : '';
    return os ? `${browser} · ${os}` : browser;
};
const listSessions = async (userId, role, currentSessionId) => {
    const sessions = await AuthSession_1.default.find({
        userId,
        role,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
    })
        .sort({ lastUsedAt: -1 })
        .limit(env_1.default.MAX_SESSIONS_PER_USER);
    return sessions.map((session) => ({
        id: String(session._id),
        deviceName: describeDevice(session),
        clientType: session.clientType,
        ipAddress: session.ipAddress ?? null,
        createdAt: session.createdAt,
        lastUsedAt: session.lastUsedAt,
        expiresAt: session.expiresAt,
        current: !!currentSessionId && String(session._id) === currentSessionId,
    }));
};
exports.listSessions = listSessions;
//# sourceMappingURL=authSession.service.js.map