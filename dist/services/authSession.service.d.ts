import type { Request, Response } from 'express';
import { type AuthRole, type IAuthSession, type RevokedReason } from '../models/AuthSession';
/**
 * Keyed (HMAC) hash, not a bare digest: a database dump alone is not enough to
 * pre-compute matches without also holding REFRESH_TOKEN_HASH_SECRET.
 *
 * A slow KDF (bcrypt/argon2) is deliberately NOT used here. These tokens are full
 * 256-bit random values, not user-chosen passwords, so there is nothing to brute
 * force — and /auth/refresh is on the hot path for every client.
 */
export declare const hashRefreshToken: (token: string) => string;
export type ClientType = 'web' | 'native' | 'unknown';
/**
 * Native clients (the Expo apps) cannot use cookies, so they announce themselves
 * and receive the refresh token in the response body instead. Everything else is
 * treated as a browser and gets an HttpOnly cookie.
 */
export declare const resolveClientType: (req: Request) => ClientType;
export declare const isNativeClient: (req: Request) => boolean;
export interface DeviceContext {
    deviceId?: string;
    deviceName?: string;
    clientType: ClientType;
    userAgent?: string;
    ipAddress?: string;
}
export declare const readDeviceContext: (req: Request) => DeviceContext;
export declare const setRefreshCookie: (res: Response, token: string) => void;
export declare const clearRefreshCookie: (res: Response) => void;
/** Reads the presented refresh token from whichever transport the client used. */
export declare const readRefreshToken: (req: Request) => string | null;
export interface AccountStatus {
    usable: boolean;
    reason?: string;
}
/**
 * Single source of truth for "may this identity still hold a session?", applied on
 * every login AND every refresh — so an admin block takes effect within one access
 * token lifetime (default 15 minutes) rather than never.
 */
export declare const checkAccountUsable: (userId: string, role: AuthRole) => Promise<AccountStatus>;
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
export declare const createSession: (userId: string, role: AuthRole, device: DeviceContext) => Promise<IssuedSession>;
export type RotateFailure = 'no_token' | 'not_found' | 'expired' | 'revoked' | 'reuse_detected' | 'account_unusable';
export type RotateResult = {
    ok: true;
    accessToken: string;
    refreshToken: string;
    session: IAuthSession;
} | {
    ok: false;
    failure: RotateFailure;
    message: string;
};
/**
 * Validates a presented refresh token and rotates it.
 *
 * Rotation is unconditional on success: the presented token is retired and a fresh
 * one issued, so no refresh token is ever valid twice (outside the deliberate retry
 * grace window below).
 */
export declare const rotateSession: (presentedToken: string | null, device: DeviceContext) => Promise<RotateResult>;
export declare const revokeSessionByToken: (presentedToken: string | null, reason?: RevokedReason) => Promise<boolean>;
export declare const revokeSessionById: (sessionId: string, userId: string, reason?: RevokedReason) => Promise<boolean>;
export declare const revokeFamily: (tokenFamilyId: string, reason: RevokedReason) => Promise<number>;
/**
 * Revokes every session for an identity. `exceptSessionId` lets "change password"
 * keep the acting device signed in while ending every other session.
 */
export declare const revokeAllSessions: (userId: string, role: AuthRole, reason: RevokedReason, exceptSessionId?: string | null) => Promise<number>;
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
export declare const listSessions: (userId: string, role: AuthRole, currentSessionId?: string | null) => Promise<SessionSummary[]>;
//# sourceMappingURL=authSession.service.d.ts.map