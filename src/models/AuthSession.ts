import mongoose, { Schema, Document } from 'mongoose';

/**
 * One document per logged-in device. A session owns exactly one *current* refresh
 * token; rotating that token updates this row rather than creating a new one, so
 * "sessions" and "devices" stay 1:1 and can be listed/revoked individually.
 *
 * Raw refresh tokens are NEVER stored — only a keyed hash (see authSession.service).
 */
export type AuthRole = 'customer' | 'worker' | 'admin';

export type RevokedReason =
  | 'logout'
  | 'logout_all'
  | 'rotated_reuse_detected'
  | 'password_changed'
  | 'password_reset'
  | 'phone_changed'
  | 'account_blocked'
  | 'account_deleted'
  | 'admin_action'
  | 'session_limit'
  | 'expired';

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

const authSessionSchema = new Schema<IAuthSession>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    role: { type: String, enum: ['customer', 'worker', 'admin'], required: true },

    refreshTokenHash: { type: String, required: true },
    previousTokenHash: { type: String, default: null },
    previousTokenRotatedAt: { type: Date, default: null },

    tokenFamilyId: { type: String, required: true },
    rotationCount: { type: Number, default: 0 },

    deviceId: { type: String, default: null },
    deviceName: { type: String, default: null },
    clientType: { type: String, enum: ['web', 'native', 'unknown'], default: 'unknown' },
    // Capped at write time; a hostile client can send a very long UA header.
    userAgent: { type: String, default: null, maxlength: 512 },
    ipAddress: { type: String, default: null, maxlength: 64 },

    lastUsedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, default: null },
  },
  { timestamps: true }
);

// Lookup path for /auth/refresh — the hot query, must be a unique index hit.
authSessionSchema.index({ refreshTokenHash: 1 }, { unique: true });
// Reuse detection. Sparse: only rotated sessions carry a previous hash.
authSessionSchema.index({ previousTokenHash: 1 }, { sparse: true });
// "List my sessions" / "revoke all my sessions".
authSessionSchema.index({ userId: 1, role: 1, revokedAt: 1 });
// Family revocation on reuse detection.
authSessionSchema.index({ tokenFamilyId: 1 });
// Same-device re-login replaces the existing session instead of piling up rows.
authSessionSchema.index({ userId: 1, deviceId: 1 }, { sparse: true });

/**
 * TTL cleanup. Mongo removes the document once `expiresAt` passes, so expired
 * sessions cannot accumulate. Revoked-but-unexpired rows are deliberately kept
 * until their natural expiry so reuse detection still has something to match.
 */
authSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

authSessionSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  // Belt and braces: hashes must never reach a response body.
  delete obj.refreshTokenHash;
  delete obj.previousTokenHash;
  return obj;
};

export default mongoose.model<IAuthSession>('AuthSession', authSessionSchema);
