"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = exports.generateToken = exports.generateRefreshTokenString = exports.verifyAccessToken = exports.generateAccessToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const env_1 = __importDefault(require("../config/env"));
// Algorithm is pinned on both sign and verify to prevent algorithm-confusion
// attacks (e.g. a forged token declaring "alg":"none" or an asymmetric alg).
const JWT_ALGORITHM = 'HS256';
/**
 * Short-lived access token (ACCESS_TOKEN_TTL, default 15m). Deliberately minimal:
 * id, role, session id. No email, phone, name or verification state — those change,
 * and a token is not a profile cache.
 */
const generateAccessToken = (payload) => {
    const claims = {
        id: payload.id,
        role: payload.role,
        ...(payload.sid ? { sid: payload.sid } : {}),
        tokenType: 'access',
    };
    return jsonwebtoken_1.default.sign(claims, env_1.default.JWT_SECRET, {
        expiresIn: env_1.default.ACCESS_TOKEN_TTL,
        algorithm: JWT_ALGORITHM,
    });
};
exports.generateAccessToken = generateAccessToken;
const verifyAccessToken = (token) => {
    const decoded = jsonwebtoken_1.default.verify(token, env_1.default.JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
    // Tokens minted before `tokenType` existed have no claim at all — accepted so a
    // deploy does not invalidate every in-flight access token. Anything that declares
    // a *different* type is rejected outright.
    if (decoded.tokenType && decoded.tokenType !== 'access') {
        throw new jsonwebtoken_1.default.JsonWebTokenError('Invalid token type');
    }
    if (!decoded.id || !decoded.role) {
        throw new jsonwebtoken_1.default.JsonWebTokenError('Malformed token payload');
    }
    return { id: decoded.id, role: decoded.role, sid: decoded.sid };
};
exports.verifyAccessToken = verifyAccessToken;
/**
 * Legacy opaque refresh string generator.
 * @deprecated Session creation now owns token material — see
 * `createSession` / `rotateSession` in `services/authSession.service.ts`.
 */
const generateRefreshTokenString = () => crypto_1.default.randomBytes(40).toString('hex');
exports.generateRefreshTokenString = generateRefreshTokenString;
// Legacy aliases — kept so non-auth call sites keep compiling during the migration.
exports.generateToken = exports.generateAccessToken;
exports.verifyToken = exports.verifyAccessToken;
//# sourceMappingURL=generateToken.js.map