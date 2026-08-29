import mongoose, { Document } from 'mongoose';
/**
 * One document per logged-in device. A session owns exactly one *current* refresh
 * token; rotating that token updates this row rather than creating a new one, so
 * "sessions" and "devices" stay 1:1 and can be listed/revoked individually.
 *
 * Raw refresh tokens are NEVER stored — only a keyed hash (see authSession.service).
 */
export type AuthRole = 'customer' | 'worker' | 'admin';
export type RevokedReason = 'logout' | 'logout_all' | 'rotated_reuse_detected' | 'password_changed' | 'password_reset' | 'phone_changed' | 'account_blocked' | 'account_deleted' | 'admin_action' | 'session_limit' | 'expired';
export interface IAuthSession extends Document {
    userId: mongoose.Types.ObjectId;
    role: AuthRole;
    /** Keyed hash of the CURRENT refresh token. */
    refreshTokenHash: string;
    /**
     * Keyed hash of the token this session rotated away from, kept so a replay can be
     * distinguished from an unknown token. Within REFRESH_REUSE_GRACE_MS a hit here is
     * a benign retry; after that it is treated as theft and revokes the whole family.
     */
    previousTokenHash?: string | null;
    previousTokenRotatedAt?: Date | null;
    /**
     * Stable across every rotation of one login. Reuse detection revokes by family so
     * an attacker cannot keep a parallel chain alive off a stolen token.
     */
    tokenFamilyId: string;
    rotationCount: number;
    deviceId?: string | null;
    deviceName?: string | null;
    clientType: 'web' | 'native' | 'unknown';
    userAgent?: string | null;
    ipAddress?: string | null;
    lastUsedAt: Date;
    expiresAt: Date;
    revokedAt?: Date | null;
    revokedReason?: RevokedReason | null;
    createdAt: Date;
    updatedAt: Date;
}
declare const _default: mongoose.Model<IAuthSession, {}, {}, {}, mongoose.Document<unknown, {}, IAuthSession, {}, mongoose.DefaultSchemaOptions> & IAuthSession & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IAuthSession>;
export default _default;
//# sourceMappingURL=AuthSession.d.ts.map