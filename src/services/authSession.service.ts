import crypto from 'crypto';
import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import AuthSession, { type AuthRole, type IAuthSession, type RevokedReason } from '../models/AuthSession';
import User from '../models/User';
import Worker from '../models/Worker';
import Admin from '../models/Admin';
import { isSuperAdminEmail } from '../config/adminPermissions';
import { generateAccessToken } from '../utils/generateToken';
import env from '../config/env';
import logger from '../utils/logger';

/* ────────────────────────────────────────────────────────────────────────────
 * Token material
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * 256 bits of CSPRNG entropy, base64url-encoded. Opaque — it carries no claims, so
 * it cannot be used as a bearer credential anywhere and is only meaningful when
 * matched against a stored hash.
 */
const generateRefreshTokenString = (): string => crypto.randomBytes(32).toString('base64url');

/**
 * Keyed (HMAC) hash, not a bare digest: a database dump alone is not enough to
 * pre-compute matches without also holding REFRESH_TOKEN_HASH_SECRET.
 *
 * A slow KDF (bcrypt/argon2) is deliberately NOT used here. These tokens are full
 * 256-bit random values, not user-chosen passwords, so there is nothing to brute
 * force — and /auth/refresh is on the hot path for every client.
 */
export const hashRefreshToken = (token: string): string =>
  crypto.createHmac('sha256', env.REFRESH_TOKEN_HASH_SECRET).update(token).digest('hex');

/* ────────────────────────────────────────────────────────────────────────────
 * Request metadata
 * ────────────────────────────────────────────────────────────────────────── */

export type ClientType = 'web' | 'native' | 'unknown';

/**
 * Native clients (the Expo apps) cannot use cookies, so they announce themselves
 * and receive the refresh token in the response body instead. Everything else is
 * treated as a browser and gets an HttpOnly cookie.
 */
export const resolveClientType = (req: Request): ClientType => {
  const raw = String(req.headers['x-client-type'] || '').trim().toLowerCase();
  if (raw === 'native' || raw === 'mobile') return 'native';
  if (raw === 'web') return 'web';
  return 'unknown';
};

export const isNativeClient = (req: Request): boolean => resolveClientType(req) === 'native';

const truncate = (value: string | undefined, max: number): string | undefined =>
  value ? value.slice(0, max) : undefined;

export interface DeviceContext {
  deviceId?: string;
  deviceName?: string;
  clientType: ClientType;
  userAgent?: string;
  ipAddress?: string;
}

export const readDeviceContext = (req: Request): DeviceContext => ({
  deviceId: truncate(String(req.headers['x-device-id'] || '').trim() || undefined, 128),
  deviceName: truncate(String(req.headers['x-device-name'] || '').trim() || undefined, 128),
  clientType: resolveClientType(req),
  userAgent: truncate(req.headers['user-agent'], 512),
  ipAddress: truncate(req.ip, 64),
});

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
  secure: env.REFRESH_COOKIE_SECURE,
  sameSite: env.REFRESH_COOKIE_SAMESITE,
  path: env.REFRESH_COOKIE_PATH,
  ...(env.REFRESH_COOKIE_DOMAIN ? { domain: env.REFRESH_COOKIE_DOMAIN } : {}),
});

export const setRefreshCookie = (res: Response, token: string): void => {
  res.cookie(env.REFRESH_COOKIE_NAME, token, {
    ...baseCookieOptions(),
    maxAge: env.REFRESH_TOKEN_TTL_MS,
  });
};

export const clearRefreshCookie = (res: Response): void => {
  // Attributes must match the ones used to set it, or the browser keeps the cookie.
  res.clearCookie(env.REFRESH_COOKIE_NAME, baseCookieOptions());
  // Legacy cookie from the pre-rotation implementation (name "refreshToken",
  // Path=/). Cleared on every logout/failed refresh so old deployments drain.
  res.clearCookie('refreshToken', { httpOnly: true, path: '/' });
};

/** Reads the presented refresh token from whichever transport the client used. */
export const readRefreshToken = (req: Request): string | null => {
  const fromCookie = req.cookies?.[env.REFRESH_COOKIE_NAME];
  if (typeof fromCookie === 'string' && fromCookie) return fromCookie;

  const fromHeader = req.headers['x-refresh-token'];
  if (typeof fromHeader === 'string' && fromHeader.trim()) return fromHeader.trim();

  const fromBody = (req.body as { refreshToken?: unknown } | undefined)?.refreshToken;
  if (typeof fromBody === 'string' && fromBody.trim()) return fromBody.trim();

  // Legacy cookie — lets sessions created by the previous implementation be
  // recognised so those users are migrated rather than logged out. See
  // `adoptLegacyRefreshToken` in auth.controller.
  const legacy = req.cookies?.refreshToken;
  if (typeof legacy === 'string' && legacy) return legacy;

  return null;
};

/* ────────────────────────────────────────────────────────────────────────────
 * Account status
 * ────────────────────────────────────────────────────────────────────────── */

export interface AccountStatus {
  usable: boolean;
  reason?: string;
}

/**
 * Single source of truth for "may this identity still hold a session?", applied on
 * every login AND every refresh — so an admin block takes effect within one access
 * token lifetime (default 15 minutes) rather than never.
 */
export const checkAccountUsable = async (userId: string, role: AuthRole): Promise<AccountStatus> => {
  switch (role) {
    case 'customer': {
      const user = await User.findById(userId).select('isActive');
      if (!user) return { usable: false, reason: 'Account no longer exists' };
      if (user.isActive === false) return { usable: false, reason: 'Account is deactivated' };
      return { usable: true };
    }
    case 'worker': {
      const worker = await Worker.findById(userId).select('_id');
      if (!worker) return { usable: false, reason: 'Account no longer exists' };
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
      const admin = await Admin.findById(userId).select('isActive role email');
      if (!admin) return { usable: false, reason: 'Account no longer exists' };
      const superAdmin =
        admin.role === 'super_admin' || admin.role === 'superadmin' || isSuperAdminEmail(admin.email);
      if (!superAdmin && admin.isActive === false) {
        return { usable: false, reason: 'Your staff account has been disabled' };
      }
      return { usable: true };
    }
    default:
      return { usable: false, reason: 'Unknown role' };
  }
};

/* ────────────────────────────────────────────────────────────────────────────
 * Session lifecycle
 * ────────────────────────────────────────────────────────────────────────── */

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  session: IAuthSession;
}

/**
 * Creates a session and its first token pair. This is the ONLY place a session is
 * born, and it is intentionally decoupled from *how* identity was proven — password,
 * Google, or (later) phone OTP all call this once they know who the user is.
 */
export const createSession = async (
  userId: string,
  role: AuthRole,
  device: DeviceContext
): Promise<IssuedSession> => {
  const refreshToken = generateRefreshTokenString();
  const now = Date.now();

  // Re-login from a known device replaces that device's session rather than adding
  // a second one, so the session list stays a true device list.
  if (device.deviceId) {
    await AuthSession.deleteMany({ userId, deviceId: device.deviceId });
  }

  const session = await AuthSession.create({
    userId,
    role,
    refreshTokenHash: hashRefreshToken(refreshToken),
    tokenFamilyId: crypto.randomUUID(),
    rotationCount: 0,
    deviceId: device.deviceId ?? null,
    deviceName: device.deviceName ?? null,
    clientType: device.clientType,
    userAgent: device.userAgent ?? null,
    ipAddress: device.ipAddress ?? null,
    lastUsedAt: new Date(now),
    expiresAt: new Date(now + env.REFRESH_TOKEN_TTL_MS),
  });

  await enforceSessionLimit(userId, role);

  const accessToken = generateAccessToken({
    id: userId,
    role,
    sid: String(session._id),
  });

  return { accessToken, refreshToken, session };
};

/**
 * Caps concurrent sessions per identity so a credential-stuffing run cannot mint
 * unbounded refresh tokens. Oldest-used sessions are dropped first, which is the
 * least disruptive choice for a genuine multi-device user.
 */
const enforceSessionLimit = async (userId: string, role: AuthRole): Promise<void> => {
  const active = await AuthSession.find({ userId, role, revokedAt: null })
    .sort({ lastUsedAt: -1 })
    .select('_id')
    .lean();

  if (active.length <= env.MAX_SESSIONS_PER_USER) return;

  const excess = active.slice(env.MAX_SESSIONS_PER_USER).map((s) => s._id);
  await AuthSession.updateMany(
    { _id: { $in: excess } },
    { $set: { revokedAt: new Date(), revokedReason: 'session_limit' } }
  );
};

export type RotateFailure =
  | 'no_token'
  | 'not_found'
  | 'expired'
  | 'revoked'
  | 'reuse_detected'
  | 'account_unusable';

export type RotateResult =
  | { ok: true; accessToken: string; refreshToken: string; session: IAuthSession }
  | { ok: false; failure: RotateFailure; message: string };

/**
 * Validates a presented refresh token and rotates it.
 *
 * Rotation is unconditional on success: the presented token is retired and a fresh
 * one issued, so no refresh token is ever valid twice (outside the deliberate retry
 * grace window below).
 */
export const rotateSession = async (
  presentedToken: string | null,
  device: DeviceContext
): Promise<RotateResult> => {
  if (!presentedToken) {
    return { ok: false, failure: 'no_token', message: 'No refresh token' };
  }

  const presentedHash = hashRefreshToken(presentedToken);
  const now = new Date();

  let session = await AuthSession.findOne({ refreshTokenHash: presentedHash });
  let matchedPrevious = false;

  if (!session) {
    session = await AuthSession.findOne({ previousTokenHash: presentedHash });
    matchedPrevious = !!session;
  }

  if (!session) {
    return { ok: false, failure: 'not_found', message: 'Invalid refresh token' };
  }

  if (matchedPrevious) {
    const rotatedAt = session.previousTokenRotatedAt?.getTime() ?? 0;
    const withinGrace = Date.now() - rotatedAt <= env.REFRESH_REUSE_GRACE_MS;

    if (!withinGrace || session.revokedAt) {
      // Genuine replay of a retired token. The current token may already be in an
      // attacker's hands, so the whole family dies — every descendant of this login.
      await revokeFamily(session.tokenFamilyId, 'rotated_reuse_detected');
      logger.warn('Refresh token reuse detected — family revoked', {
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
    await AuthSession.updateOne(
      { _id: session._id },
      { $set: { revokedAt: now, revokedReason: 'expired' } }
    );
    return { ok: false, failure: 'expired', message: 'Session expired' };
  }

  const status = await checkAccountUsable(String(session.userId), session.role);
  if (!status.usable) {
    await AuthSession.updateOne(
      { _id: session._id },
      { $set: { revokedAt: now, revokedReason: 'account_blocked' } }
    );
    return { ok: false, failure: 'account_unusable', message: status.reason || 'Account unavailable' };
  }

  const nextToken = generateRefreshTokenString();

  // Sliding expiry: an actively used session keeps renewing up to the full TTL, so a
  // daily user is never logged out, while an abandoned session still dies on schedule.
  const updated = await AuthSession.findOneAndUpdate(
    { _id: session._id, refreshTokenHash: session.refreshTokenHash },
    {
      $set: {
        refreshTokenHash: hashRefreshToken(nextToken),
        previousTokenHash: session.refreshTokenHash,
        previousTokenRotatedAt: now,
        lastUsedAt: now,
        expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_MS),
        // Keep device metadata fresh so the session list reflects reality.
        ...(device.userAgent ? { userAgent: device.userAgent } : {}),
        ...(device.ipAddress ? { ipAddress: device.ipAddress } : {}),
        ...(device.clientType !== 'unknown' ? { clientType: device.clientType } : {}),
      },
      $inc: { rotationCount: 1 },
    },
    { new: true }
  );

  if (!updated) {
    // Lost an optimistic race with a concurrent rotation of the same session. The
    // other request won and the client has a valid new token; this one must not
    // trigger reuse handling.
    return { ok: false, failure: 'not_found', message: 'Invalid refresh token' };
  }

  const accessToken = generateAccessToken({
    id: String(updated.userId),
    role: updated.role,
    sid: String(updated._id),
  });

  return { ok: true, accessToken, refreshToken: nextToken, session: updated };
};

/* ────────────────────────────────────────────────────────────────────────────
 * Revocation
 * ────────────────────────────────────────────────────────────────────────── */

export const revokeSessionByToken = async (
  presentedToken: string | null,
  reason: RevokedReason = 'logout'
): Promise<boolean> => {
  if (!presentedToken) return false;

  const hash = hashRefreshToken(presentedToken);
  const result = await AuthSession.updateOne(
    { $or: [{ refreshTokenHash: hash }, { previousTokenHash: hash }], revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: reason } }
  );
  return result.modifiedCount > 0;
};

export const revokeSessionById = async (
  sessionId: string,
  userId: string,
  reason: RevokedReason = 'logout'
): Promise<boolean> => {
  if (!mongoose.isValidObjectId(sessionId)) return false;

  const result = await AuthSession.updateOne(
    { _id: sessionId, userId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: reason } }
  );
  return result.modifiedCount > 0;
};

export const revokeFamily = async (tokenFamilyId: string, reason: RevokedReason): Promise<number> => {
  const result = await AuthSession.updateMany(
    { tokenFamilyId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: reason } }
  );
  return result.modifiedCount;
};

/**
 * Revokes every session for an identity. `exceptSessionId` lets "change password"
 * keep the acting device signed in while ending every other session.
 */
export const revokeAllSessions = async (
  userId: string,
  role: AuthRole,
  reason: RevokedReason,
  exceptSessionId?: string | null
): Promise<number> => {
  const filter: Record<string, unknown> = { userId, role, revokedAt: null };
  if (exceptSessionId && mongoose.isValidObjectId(exceptSessionId)) {
    filter._id = { $ne: new mongoose.Types.ObjectId(exceptSessionId) };
  }

  const result = await AuthSession.updateMany(
    filter,
    { $set: { revokedAt: new Date(), revokedReason: reason } }
  );

  if (result.modifiedCount > 0) {
    logger.info('Auth sessions revoked', { userId, role, reason, count: result.modifiedCount });
  }
  return result.modifiedCount;
};

/* ────────────────────────────────────────────────────────────────────────────
 * Listing (multi-device UI)
 * ────────────────────────────────────────────────────────────────────────── */

export interface SessionSummary {
  id: string;
  deviceName: string;
  clientType: ClientType;
  ipAddress: string | null;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  current: boolean;
}

/** Best-effort human label, derived server-side so clients stay dumb. */
const describeDevice = (session: IAuthSession): string => {
  if (session.deviceName) return session.deviceName;

  const ua = session.userAgent || '';
  if (!ua) return session.clientType === 'native' ? 'Mobile app' : 'Unknown device';

  const browser =
    /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : /Firefox\//.test(ua) ? 'Firefox'
    : 'Browser';

  const os =
    /Windows/.test(ua) ? 'Windows'
    : /Android/.test(ua) ? 'Android'
    : /iPhone|iPad|iOS/.test(ua) ? 'iOS'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux'
    : '';

  return os ? `${browser} · ${os}` : browser;
};

export const listSessions = async (
  userId: string,
  role: AuthRole,
  currentSessionId?: string | null
): Promise<SessionSummary[]> => {
  const sessions = await AuthSession.find({
    userId,
    role,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  })
    .sort({ lastUsedAt: -1 })
    .limit(env.MAX_SESSIONS_PER_USER);

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
