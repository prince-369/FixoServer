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
let authenticateHandshake;
let generateAccessToken;
(0, vitest_1.beforeAll)(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'ci-test-jwt-secret';
    ({ authenticateHandshake } = await Promise.resolve().then(() => __importStar(require('./index'))));
    ({ generateAccessToken } = await Promise.resolve().then(() => __importStar(require('../utils/generateToken'))));
});
(0, vitest_1.describe)('socket authenticateHandshake', () => {
    (0, vitest_1.it)('rejects a handshake with no token (unauthenticated socket)', () => {
        (0, vitest_1.expect)(authenticateHandshake({ auth: {}, headers: {} })).toBeNull();
    });
    (0, vitest_1.it)('rejects an invalid/garbage token', () => {
        (0, vitest_1.expect)(authenticateHandshake({ auth: { token: 'not-a-jwt' }, headers: {} })).toBeNull();
    });
    (0, vitest_1.it)('rejects a token signed with the wrong secret', () => {
        const forged = jsonwebtoken_1.default.sign({ id: 'x', role: 'admin' }, 'attacker-secret');
        (0, vitest_1.expect)(authenticateHandshake({ auth: { token: forged }, headers: {} })).toBeNull();
    });
    (0, vitest_1.it)('rejects a token with alg:none (algorithm pinning, finding #6)', () => {
        const noneToken = jsonwebtoken_1.default.sign({ id: 'x', role: 'admin' }, '', { algorithm: 'none' });
        (0, vitest_1.expect)(authenticateHandshake({ auth: { token: noneToken }, headers: {} })).toBeNull();
    });
    (0, vitest_1.it)('accepts a valid token from handshake.auth and returns the verified identity', () => {
        const token = generateAccessToken({ id: 'user-123', role: 'worker' });
        (0, vitest_1.expect)(authenticateHandshake({ auth: { token }, headers: {} })).toEqual({
            id: 'user-123',
            role: 'worker',
        });
    });
    (0, vitest_1.it)('accepts a valid Bearer token from the Authorization header', () => {
        const token = generateAccessToken({ id: 'admin-1', role: 'admin' });
        (0, vitest_1.expect)(authenticateHandshake({ headers: { authorization: `Bearer ${token}` } })).toEqual({
            id: 'admin-1',
            role: 'admin',
        });
    });
    (0, vitest_1.it)('does NOT trust client-supplied userId/role — only the token grants identity', () => {
        // Attacker presents no token but tries to smuggle an admin identity in the
        // handshake payload. This is exactly the old bypass and must be rejected.
        const spoofed = { auth: { userId: 'victim', role: 'admin' }, headers: {} };
        (0, vitest_1.expect)(authenticateHandshake(spoofed)).toBeNull();
    });
});
//# sourceMappingURL=socketAuth.test.js.map