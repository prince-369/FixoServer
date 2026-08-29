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
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const vitest_1 = require("vitest");
let generateAccessToken;
let verifyAccessToken;
const SECRET = 'ci-test-jwt-secret';
(0, vitest_1.beforeAll)(async () => {
    process.env.JWT_SECRET = SECRET;
    process.env.ACCESS_TOKEN_TTL = '15m';
    ({ generateAccessToken, verifyAccessToken } = await Promise.resolve().then(() => __importStar(require('./generateToken'))));
});
(0, vitest_1.describe)('access token', () => {
    (0, vitest_1.it)('round-trips id, role and session id', () => {
        const token = generateAccessToken({ id: 'user-1', role: 'worker', sid: 'sess-1' });
        (0, vitest_1.expect)(verifyAccessToken(token)).toEqual({ id: 'user-1', role: 'worker', sid: 'sess-1' });
    });
    (0, vitest_1.it)('carries only minimal claims — no PII', () => {
        const token = generateAccessToken({ id: 'user-1', role: 'customer', sid: 'sess-1' });
        const decoded = jsonwebtoken_1.default.decode(token);
        (0, vitest_1.expect)(Object.keys(decoded).sort()).toEqual(['exp', 'iat', 'id', 'role', 'sid', 'tokenType']);
        // Explicitly assert the things that must never be in a token.
        for (const forbidden of ['password', 'email', 'phone', 'name']) {
            (0, vitest_1.expect)(decoded).not.toHaveProperty(forbidden);
        }
    });
    (0, vitest_1.it)('is short-lived (<= 1 hour), so it is not a substitute for a session', () => {
        const token = generateAccessToken({ id: 'u', role: 'customer' });
        const { iat, exp } = jsonwebtoken_1.default.decode(token);
        (0, vitest_1.expect)(exp - iat).toBeLessThanOrEqual(3600);
    });
    (0, vitest_1.it)('rejects a token signed with a different secret', () => {
        const forged = jsonwebtoken_1.default.sign({ id: 'u', role: 'admin', tokenType: 'access' }, 'attacker-secret');
        (0, vitest_1.expect)(() => verifyAccessToken(forged)).toThrow();
    });
    (0, vitest_1.it)('rejects alg=none (algorithm confusion)', () => {
        const forged = jsonwebtoken_1.default.sign({ id: 'u', role: 'admin', tokenType: 'access' }, '', {
            algorithm: 'none',
        });
        (0, vitest_1.expect)(() => verifyAccessToken(forged)).toThrow();
    });
    (0, vitest_1.it)('rejects a correctly-signed token that is not an access token', () => {
        const refreshShaped = jsonwebtoken_1.default.sign({ id: 'u', role: 'admin', tokenType: 'refresh' }, SECRET);
        (0, vitest_1.expect)(() => verifyAccessToken(refreshShaped)).toThrow(/Invalid token type/);
    });
    (0, vitest_1.it)('still accepts legacy tokens that predate the tokenType claim', () => {
        // Guards the rollout: deploying must not invalidate in-flight access tokens.
        const legacy = jsonwebtoken_1.default.sign({ id: 'u', role: 'customer' }, SECRET);
        (0, vitest_1.expect)(verifyAccessToken(legacy)).toEqual({ id: 'u', role: 'customer', sid: undefined });
    });
    (0, vitest_1.it)('rejects a well-signed but malformed payload', () => {
        const noRole = jsonwebtoken_1.default.sign({ id: 'u', tokenType: 'access' }, SECRET);
        (0, vitest_1.expect)(() => verifyAccessToken(noRole)).toThrow(/Malformed/);
    });
});
//# sourceMappingURL=accessToken.test.js.map