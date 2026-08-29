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
exports.closeRateLimiterStore = exports.partnerLimiter = exports.waitlistLimiter = exports.mutationLimiter = exports.refreshLimiter = exports.authLimiter = exports.apiLimiter = void 0;
const express_rate_limit_1 = __importStar(require("express-rate-limit"));
const ioredis_1 = __importDefault(require("ioredis"));
const rate_limit_redis_1 = require("rate-limit-redis");
const env_1 = __importDefault(require("../config/env"));
const logger_1 = __importDefault(require("../utils/logger"));
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
const isLikelyProtocolMismatch = (error) => {
    if (!(error instanceof Error))
        return false;
    const message = error.message.toLowerCase();
    return (message.includes('err_ssl_packet_length_too_long') ||
        message.includes('packet length too long') ||
        message.includes("stream isn't writeable") ||
        message.includes('connection is closed') ||
        message.includes('ssl routines'));
};
const buildLocalRateLimitReply = (command, args) => {
    const upperCommand = command.toUpperCase();
    if (upperCommand === 'SCRIPT' && args[1]?.toUpperCase() === 'LOAD') {
        // Satisfy rate-limit-redis script bootstrapping when Redis is unavailable.
        return 'local-fallback-script-sha';
    }
    if (upperCommand === 'EVALSHA') {
        return [1, env_1.default.RATE_LIMIT_WINDOW_MS];
    }
    return 0;
};
const isClientReady = (client) => client.status === 'ready';
const waitForClientReady = async (client, timeoutMs = 2000) => {
    if (isClientReady(client))
        return true;
    if (client.status === 'end')
        return false;
    return new Promise((resolve) => {
        let settled = false;
        const finish = (value) => {
            if (settled)
                return;
            settled = true;
            cleanup();
            resolve(value);
        };
        const onReady = () => finish(true);
        const onError = () => finish(false);
        const onClose = () => finish(false);
        const timer = setTimeout(() => finish(isClientReady(client)), timeoutMs);
        timer.unref?.();
        const cleanup = () => {
            clearTimeout(timer);
            client.off('ready', onReady);
            client.off('error', onError);
            client.off('close', onClose);
            client.off('end', onClose);
        };
        client.on('ready', onReady);
        client.on('error', onError);
        client.on('close', onClose);
        client.on('end', onClose);
    });
};
const attachRedisLogging = (client) => {
    client.on('error', (error) => {
        logger_1.default.error('Rate limit Redis error', { err: error });
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
        if (!alternateRedisUrl || !isLikelyProtocolMismatch(error)) {
            logger_1.default.warn('Rate limit Redis connect failed; falling back to local memory store', { err: error });
            redisClient?.disconnect();
            redisClient = null;
            return;
        }
        // Do not log the Redis URLs — they can contain credentials.
        logger_1.default.warn('Rate limit Redis TLS/protocol mismatch; retrying with alternate scheme');
        redisClient?.disconnect();
        activeRedisUrl = alternateRedisUrl;
        redisClient = new ioredis_1.default(activeRedisUrl, buildRedisOptions(activeRedisUrl));
        attachRedisLogging(redisClient);
        try {
            await redisClient.connect();
        }
        catch (retryError) {
            logger_1.default.warn('Rate limit Redis connect retry failed; falling back to local memory store', { err: retryError });
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
            const command = args[0] ?? '';
            const upperCommand = command.toUpperCase();
            const liveClient = redisClient ?? getOrCreateRedisClient();
            if (!liveClient) {
                return buildLocalRateLimitReply(command, args);
            }
            if (!isClientReady(liveClient)) {
                const becameReady = await waitForClientReady(liveClient);
                if (!becameReady || !isClientReady(liveClient)) {
                    return buildLocalRateLimitReply(command, args);
                }
            }
            try {
                return await liveClient.call(command, ...args.slice(1));
            }
            catch (error) {
                if (upperCommand === 'EVALSHA') {
                    // Let rate-limit-redis reload scripts on NOSCRIPT and retry internally.
                    throw error;
                }
                logger_1.default.warn('Rate limit Redis command failed; using local limiter reply fallback', { err: error });
                return buildLocalRateLimitReply(command, args);
            }
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
/**
 * /auth/refresh has a different threat model from login: it is called legitimately
 * by every client on startup and whenever an access token expires, so the login
 * budget (30 / 15 min, keyed on a credential in the body) is both too tight and
 * keyed on fields refresh does not send.
 *
 * `skipSuccessfulRequests` means only FAILED refreshes count, so a normal user is
 * never throttled while someone spraying stolen tokens is cut off quickly.
 */
exports.refreshLimiter = (0, express_rate_limit_1.default)({
    windowMs: env_1.default.RATE_LIMIT_WINDOW_MS,
    max: env_1.default.REFRESH_RATE_LIMIT_MAX,
    passOnStoreError: true,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: keyByUserOrIp,
    skipSuccessfulRequests: true,
    store: getRateLimitStore('fixo:ratelimit:refresh:'),
    message: { message: 'Too many session refresh attempts. Please try again shortly.' },
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
/**
 * Public marketing-site forms. These are unauthenticated, so they're keyed by IP
 * on top of the global apiLimiter.
 *
 * `skipFailedRequests` matters here: a visitor fixing a typo in their email would
 * otherwise burn their budget on rejected attempts and get locked out mid-signup.
 * Only submissions that actually stored something count. The two forms get their
 * own budgets so a partner enquiry can't lock out the waitlist, or vice versa.
 * Dev is left effectively open so local testing doesn't trip it.
 */
const landingLimiter = (name, max) => (0, express_rate_limit_1.default)({
    windowMs: 10 * 60 * 1000,
    max: env_1.default.NODE_ENV === 'production' ? max : 1000,
    passOnStoreError: true,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: keyByUserOrIp,
    skipFailedRequests: true,
    store: getRateLimitStore(`fixo:ratelimit:landing:${name}:`),
    message: { message: 'Too many submissions. Please try again in a few minutes.' },
});
exports.waitlistLimiter = landingLimiter('waitlist', 20);
exports.partnerLimiter = landingLimiter('partner', 10);
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