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
exports.closeRateLimiterStore = exports.mutationLimiter = exports.authLimiter = exports.apiLimiter = void 0;
const express_rate_limit_1 = __importStar(require("express-rate-limit"));
const ioredis_1 = __importDefault(require("ioredis"));
const rate_limit_redis_1 = require("rate-limit-redis");
const env_1 = __importDefault(require("../config/env"));
const RATE_LIMIT_MESSAGE = { message: 'Too many requests. Please try again shortly.' };
let redisClient = null;
const buildRedisOptions = (redisUrl) => {
    const options = {
        lazyConnect: true,
        connectTimeout: 10000,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
    };
    if (redisUrl.startsWith('rediss://')) {
        options.tls = {};
    }
    return options;
};
const toAlternateRedisScheme = (redisUrl) => {
    if (redisUrl.startsWith('rediss://')) {
        return `redis://${redisUrl.slice('rediss://'.length)}`;
    }
    if (redisUrl.startsWith('redis://')) {
        return `rediss://${redisUrl.slice('redis://'.length)}`;
    }
    return null;
};
const isTlsPacketLengthError = (error) => {
    if (!(error instanceof Error))
        return false;
    return (error.message.includes('ERR_SSL_PACKET_LENGTH_TOO_LONG') ||
        error.message.toLowerCase().includes('packet length too long'));
};
const attachRedisLogging = (client) => {
    client.on('error', (error) => {
        console.error('Rate limit Redis error:', error);
    });
};
const getOrCreateRedisClient = () => {
    if (!env_1.default.REDIS_URL)
        return null;
    if (redisClient)
        return redisClient;
    let activeRedisUrl = env_1.default.REDIS_URL;
    redisClient = new ioredis_1.default(activeRedisUrl, buildRedisOptions(activeRedisUrl));
    attachRedisLogging(redisClient);
    void redisClient.connect().catch(async (error) => {
        const alternateRedisUrl = toAlternateRedisScheme(activeRedisUrl);
        if (!alternateRedisUrl || !isTlsPacketLengthError(error)) {
            console.error('Rate limit Redis connect failed. Falling back to local memory store.', error);
            redisClient?.disconnect();
            redisClient = null;
            return;
        }
        console.warn(`Rate limit Redis TLS mismatch for ${activeRedisUrl}. Retrying with ${alternateRedisUrl}.`);
        redisClient?.disconnect();
        activeRedisUrl = alternateRedisUrl;
        redisClient = new ioredis_1.default(activeRedisUrl, buildRedisOptions(activeRedisUrl));
        attachRedisLogging(redisClient);
        try {
            await redisClient.connect();
        }
        catch (retryError) {
            console.error('Rate limit Redis connect retry failed. Falling back to local memory store.', retryError);
            redisClient?.disconnect();
            redisClient = null;
        }
    });
    return redisClient;
};
const getRateLimitStore = (prefix) => {
    const client = getOrCreateRedisClient();
    if (!client)
        return undefined;
    return new rate_limit_redis_1.RedisStore({
        prefix,
        sendCommand: async (...args) => {
            const liveClient = redisClient ?? getOrCreateRedisClient();
            if (!liveClient || liveClient.status !== 'ready') {
                throw new Error('Rate limit Redis client unavailable');
            }
            return liveClient.call(args[0], ...args.slice(1));
        },
    });
};
const keyByUserOrIp = (req) => {
    const userId = req.user?.id;
    const role = req.user?.role;
    if (userId && role)
        return `${role}:${userId}`;
    const ip = req.ip || req.socket.remoteAddress || '0.0.0.0';
    return `ip:${(0, express_rate_limit_1.ipKeyGenerator)(ip)}`;
};
const skipHealthEndpoints = (req) => {
    const metricsPath = env_1.default.METRICS_ROUTE.startsWith('/api')
        ? env_1.default.METRICS_ROUTE.slice('/api'.length) || '/'
        : env_1.default.METRICS_ROUTE;
    return req.path === '/health' || req.path === '/ready' || req.path === metricsPath;
};
exports.apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: env_1.default.RATE_LIMIT_WINDOW_MS,
    max: env_1.default.RATE_LIMIT_MAX,
    passOnStoreError: true,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: keyByUserOrIp,
    skip: skipHealthEndpoints,
    store: getRateLimitStore('fixo:ratelimit:api:'),
    message: RATE_LIMIT_MESSAGE,
});
exports.authLimiter = (0, express_rate_limit_1.default)({
    windowMs: env_1.default.RATE_LIMIT_WINDOW_MS,
    max: env_1.default.AUTH_RATE_LIMIT_MAX,
    passOnStoreError: true,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const identifier = (typeof req.body?.identifier === 'string' && req.body.identifier.trim().toLowerCase()) ||
            (typeof req.body?.phone === 'string' && req.body.phone.trim()) ||
            (typeof req.body?.email === 'string' && req.body.email.trim().toLowerCase()) ||
            'unknown-identifier';
        return `${keyByUserOrIp(req)}:${identifier}`;
    },
    skipSuccessfulRequests: true,
    store: getRateLimitStore('fixo:ratelimit:auth:'),
    message: { message: 'Too many authentication attempts. Please try again later.' },
});
exports.mutationLimiter = (0, express_rate_limit_1.default)({
    windowMs: 5 * 60 * 1000,
    max: env_1.default.MUTATION_RATE_LIMIT_MAX,
    passOnStoreError: true,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: keyByUserOrIp,
    skip: (req) => ['GET', 'HEAD', 'OPTIONS'].includes(req.method),
    store: getRateLimitStore('fixo:ratelimit:mutation:'),
    message: { message: 'Too many write requests. Please slow down and retry.' },
});
const closeRateLimiterStore = async () => {
    if (!redisClient)
        return;
    try {
        await redisClient.quit();
    }
    catch {
        redisClient.disconnect();
    }
    redisClient = null;
};
exports.closeRateLimiterStore = closeRateLimiterStore;
//# sourceMappingURL=rateLimit.middleware.js.map