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
// Access token — short-lived (matches JWT_EXPIRE from env, default 30 minutes);
// revocation is handled by the DB-backed refresh-token rotation.
const generateAccessToken = (payload) => {
    return jsonwebtoken_1.default.sign(payload, env_1.default.JWT_SECRET, {
        expiresIn: env_1.default.JWT_EXPIRE,
        algorithm: JWT_ALGORITHM,
    });
};
exports.generateAccessToken = generateAccessToken;
// Verify access token
const verifyAccessToken = (token) => {
    return jsonwebtoken_1.default.verify(token, env_1.default.JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
};
exports.verifyAccessToken = verifyAccessToken;
// Refresh token — cryptographically random string (not JWT)
const generateRefreshTokenString = () => {
    return crypto_1.default.randomBytes(40).toString('hex');
};
exports.generateRefreshTokenString = generateRefreshTokenString;
// Legacy — keep for backward compatibility during transition
const generateToken = (payload) => {
    return jsonwebtoken_1.default.sign(payload, env_1.default.JWT_SECRET, {
        expiresIn: env_1.default.JWT_EXPIRE,
        algorithm: JWT_ALGORITHM,
    });
};
exports.generateToken = generateToken;
const verifyToken = (token) => {
    return jsonwebtoken_1.default.verify(token, env_1.default.JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
};
exports.verifyToken = verifyToken;
//# sourceMappingURL=generateToken.js.map