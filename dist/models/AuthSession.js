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
const mongoose_1 = __importStar(require("mongoose"));
const authSessionSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, required: true },
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
}, { timestamps: true });
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
exports.default = mongoose_1.default.model('AuthSession', authSessionSchema);
//# sourceMappingURL=AuthSession.js.map