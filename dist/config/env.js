"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseStrictBooleanEnv = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const getRequiredEnv = (name) => {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
};
const parseNumberEnv = (name, fallback, options) => {
    const raw = process.env[name];
    if (!raw)
        return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed))
        return fallback;
    const min = options?.min ?? Number.NEGATIVE_INFINITY;
    const max = options?.max ?? Number.POSITIVE_INFINITY;
    return Math.min(max, Math.max(min, parsed));
};
const parseBooleanEnv = (name, fallback) => {
    const raw = process.env[name];
    if (!raw)
        return fallback;
    const normalized = raw.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized))
        return true;
    if (['0', 'false', 'no', 'off'].includes(normalized))
        return false;
    return fallback;
};
/**
 * Strict tri-state boolean flag. Absent/empty → `undefined` (caller applies its own
 * backward-compatible default); only the exact lowercase literals "true"/"false" are
 * accepted; anything else throws a clear configuration error at startup.
 */
const parseStrictBooleanEnv = (name) => {
    const raw = process.env[name];
    if (raw === undefined || raw.trim() === '')
        return undefined;
    const value = raw.trim();
    if (value === 'true')
        return true;
    if (value === 'false')
        return false;
    throw new Error(`Invalid ${String(name)}="${raw}". Expected exactly "true" or "false".`);
};
exports.parseStrictBooleanEnv = parseStrictBooleanEnv;
// The marketing site (Fixo-Landing-Page) posts the waitlist + partner forms here.
// Baked in so CORS works without an env change; CLIENT_URLS can still add more.
const LANDING_ORIGINS = [
    'http://localhost:3500',
    'https://fixoservice.in',
    'https://www.fixoservice.in',
];
const parseClientOrigins = (primaryOrigin) => {
    const list = process.env.CLIENT_URLS
        ?.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean) || [];
    if (!list.includes(primaryOrigin)) {
        list.unshift(primaryOrigin);
    }
    list.push(...LANDING_ORIGINS);
    return Array.from(new Set(list));
};
const parseRouteEnv = (name, fallback) => {
    const raw = process.env[name]?.trim();
    if (!raw)
        return fallback;
    return raw.startsWith('/') ? raw : `/${raw}`;
};
const sanitizeEnvValue = (value) => value.trim().replace(/^['"]+|['"]+$/g, '').trim();
const parseGoogleClientIds = () => {
    const clientIds = (process.env.GOOGLE_CLIENT_IDS || '')
        .split(',')
        .map((value) => sanitizeEnvValue(value))
        .filter(Boolean);
    const singleClientIdRaw = process.env.GOOGLE_CLIENT_ID;
    const singleClientId = singleClientIdRaw ? sanitizeEnvValue(singleClientIdRaw) : '';
    if (singleClientId) {
        clientIds.unshift(singleClientId);
    }
    return Array.from(new Set(clientIds));
};
const getEnvOrDefault = (name, fallback, options) => {
    const raw = process.env[name]?.trim();
    if (raw)
        return raw;
    if (options?.requiredInProduction && nodeEnv === 'production') {
        throw new Error(`Missing required environment variable in production: ${name}`);
    }
    return fallback;
};
const nodeEnv = process.env.NODE_ENV || 'development';
// Mirrors the resolution in src/utils/logger.ts: explicit LOG_LEVEL wins, else
// production/test default to 'warn' and development defaults to 'debug'.
const resolveLogLevel = () => {
    const raw = (process.env.LOG_LEVEL || '').trim().toLowerCase();
    if (['debug', 'info', 'warn', 'error', 'silent'].includes(raw)) {
        return raw;
    }
    return nodeEnv === 'development' ? 'debug' : 'warn';
};
/**
 * Parses a JWT-style duration ("15m", "30d", "900s", or bare seconds) into ms.
 * Used to keep the refresh cookie Max-Age and the AuthSession expiresAt in lockstep
 * with REFRESH_TOKEN_TTL, so the TTL is configured in exactly one place.
 */
const parseDurationMs = (raw, fallbackMs) => {
    const value = raw.trim();
    const match = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w|y)?$/i.exec(value);
    if (!match)
        return fallbackMs;
    const amount = Number(match[1]);
    if (!Number.isFinite(amount) || amount <= 0)
        return fallbackMs;
    const unit = (match[2] || 's').toLowerCase();
    const multipliers = {
        ms: 1,
        s: 1000,
        m: 60000,
        h: 3600000,
        d: 86400000,
        w: 604800000,
        y: 31536000000,
    };
    return amount * (multipliers[unit] ?? 1000);
};
const parseSameSiteEnv = () => {
    const raw = (process.env.REFRESH_COOKIE_SAMESITE || '').trim().toLowerCase();
    if (raw === 'lax' || raw === 'strict' || raw === 'none')
        return raw;
    if (raw) {
        throw new Error(`Invalid REFRESH_COOKIE_SAMESITE="${raw}". Expected "lax", "strict" or "none".`);
    }
    // Default: "lax". Both supported topologies (same-origin proxy, and API on a
    // sibling subdomain under one registrable domain) are same-site, so Lax is
    // correct and gives CSRF protection for free. Only a genuinely cross-site
    // deployment needs "none" — and that combination is validated below.
    return 'lax';
};
const clientUrl = getEnvOrDefault('CLIENT_URL', 'http://localhost:3000', { requiredInProduction: true });
const accessTokenTtl = (process.env.ACCESS_TOKEN_TTL || process.env.JWT_EXPIRE || '15m').trim();
const refreshTokenTtl = (process.env.REFRESH_TOKEN_TTL || '30d').trim();
const refreshCookieSameSite = parseSameSiteEnv();
// Secure is mandatory in production and whenever SameSite=None (browsers reject
// `SameSite=None` without `Secure`). Dev over plain http://localhost may opt out.
const refreshCookieSecure = parseBooleanEnv('REFRESH_COOKIE_SECURE', nodeEnv === 'production' || refreshCookieSameSite === 'none');
if (refreshCookieSameSite === 'none' && !refreshCookieSecure) {
    throw new Error('REFRESH_COOKIE_SAMESITE="none" requires REFRESH_COOKIE_SECURE=true.');
}
if (nodeEnv === 'production' && !refreshCookieSecure) {
    throw new Error('REFRESH_COOKIE_SECURE must be true in production.');
}
const googleClientIds = parseGoogleClientIds();
const env = {
    NODE_ENV: nodeEnv,
    PORT: parseInt(process.env.PORT || '5000', 10),
    MONGODB_URI: getEnvOrDefault('MONGODB_URI', 'mongodb://localhost:27017/fixo', { requiredInProduction: true }),
    MONGODB_MAX_POOL_SIZE: parseNumberEnv('MONGODB_MAX_POOL_SIZE', 120, { min: 10, max: 1000 }),
    MONGODB_MIN_POOL_SIZE: parseNumberEnv('MONGODB_MIN_POOL_SIZE', 10, { min: 0, max: 200 }),
    MONGODB_SERVER_SELECTION_TIMEOUT_MS: parseNumberEnv('MONGODB_SERVER_SELECTION_TIMEOUT_MS', 10000, { min: 1000 }),
    MONGODB_SOCKET_TIMEOUT_MS: parseNumberEnv('MONGODB_SOCKET_TIMEOUT_MS', 45000, { min: 5000 }),
    MONGODB_CONNECT_TIMEOUT_MS: parseNumberEnv('MONGODB_CONNECT_TIMEOUT_MS', 10000, { min: 1000 }),
    MONGODB_MAX_IDLE_TIME_MS: parseNumberEnv('MONGODB_MAX_IDLE_TIME_MS', 30000, { min: 5000 }),
    JWT_SECRET: getRequiredEnv('JWT_SECRET'),
    // Legacy alias. ACCESS_TOKEN_TTL is authoritative; JWT_EXPIRE is still read as a
    // fallback so an existing deployment keeps booting, but it no longer controls
    // session lifetime — persistence comes from the refresh token, not this value.
    JWT_EXPIRE: accessTokenTtl,
    ACCESS_TOKEN_TTL: accessTokenTtl,
    REFRESH_TOKEN_TTL: refreshTokenTtl,
    REFRESH_TOKEN_TTL_MS: parseDurationMs(refreshTokenTtl, 30 * 86400000),
    // Keyed hash for refresh tokens at rest. Defaults to JWT_SECRET so existing
    // deployments boot unchanged; set a distinct value to decouple the two.
    REFRESH_TOKEN_HASH_SECRET: process.env.REFRESH_TOKEN_HASH_SECRET || getRequiredEnv('JWT_SECRET'),
    // Window in which replaying the immediately-previous refresh token is treated as
    // a benign client retry (lost response / flaky network) rather than theft.
    REFRESH_REUSE_GRACE_MS: parseNumberEnv('REFRESH_REUSE_GRACE_MS', 60000, { min: 0, max: 600000 }),
    REFRESH_COOKIE_NAME: (process.env.REFRESH_COOKIE_NAME || 'fixo_rt').trim(),
    REFRESH_COOKIE_PATH: parseRouteEnv('REFRESH_COOKIE_PATH', '/api/auth'),
    // Empty = host-only cookie (proxy / same-origin mode). Set to ".fixoservice.in"
    // to share one cookie across app./worker./api. subdomains.
    REFRESH_COOKIE_DOMAIN: (process.env.REFRESH_COOKIE_DOMAIN || '').trim(),
    REFRESH_COOKIE_SAMESITE: refreshCookieSameSite,
    REFRESH_COOKIE_SECURE: refreshCookieSecure,
    MAX_SESSIONS_PER_USER: parseNumberEnv('MAX_SESSIONS_PER_USER', 10, { min: 1, max: 100 }),
    CLIENT_URL: clientUrl,
    CLIENT_URLS: parseClientOrigins(clientUrl),
    WORKER_CLIENT_URL: process.env.WORKER_CLIENT_URL || 'https://fixoworker.vercel.app',
    TRUST_PROXY: parseBooleanEnv('TRUST_PROXY', nodeEnv === 'production'),
    BODY_LIMIT_MB: parseNumberEnv('BODY_LIMIT_MB', 2, { min: 1, max: 25 }),
    URL_ENCODED_LIMIT_MB: parseNumberEnv('URL_ENCODED_LIMIT_MB', 2, { min: 1, max: 25 }),
    REQUEST_TIMEOUT_MS: parseNumberEnv('REQUEST_TIMEOUT_MS', 30000, { min: 5000 }),
    KEEP_ALIVE_TIMEOUT_MS: parseNumberEnv('KEEP_ALIVE_TIMEOUT_MS', 65000, { min: 10000 }),
    HEADERS_TIMEOUT_MS: parseNumberEnv('HEADERS_TIMEOUT_MS', 66000, { min: 10000 }),
    MAX_REQUESTS_PER_SOCKET: parseNumberEnv('MAX_REQUESTS_PER_SOCKET', 5000, { min: 0 }),
    SLOW_REQUEST_THRESHOLD_MS: parseNumberEnv('SLOW_REQUEST_THRESHOLD_MS', 1500, { min: 100 }),
    METRICS_ENABLED: parseBooleanEnv('METRICS_ENABLED', true),
    METRICS_ROUTE: parseRouteEnv('METRICS_ROUTE', '/api/metrics'),
    METRICS_AUTH_TOKEN: process.env.METRICS_AUTH_TOKEN || '',
    METRICS_SERVICE_NAME: process.env.METRICS_SERVICE_NAME || 'fixo-server',
    RATE_LIMIT_WINDOW_MS: parseNumberEnv('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000, { min: 1000 }),
    RATE_LIMIT_MAX: parseNumberEnv('RATE_LIMIT_MAX', 600, { min: 50 }),
    AUTH_RATE_LIMIT_MAX: parseNumberEnv('AUTH_RATE_LIMIT_MAX', 30, { min: 5 }),
    REFRESH_RATE_LIMIT_MAX: parseNumberEnv('REFRESH_RATE_LIMIT_MAX', 60, { min: 10 }),
    MUTATION_RATE_LIMIT_MAX: parseNumberEnv('MUTATION_RATE_LIMIT_MAX', 150, { min: 10 }),
    IDEMPOTENCY_TTL_MS: parseNumberEnv('IDEMPOTENCY_TTL_MS', 15000, { min: 3000 }),
    REDIS_URL: process.env.REDIS_URL || '',
    SOCKET_REDIS_ENABLED: (0, exports.parseStrictBooleanEnv)('SOCKET_REDIS_ENABLED'),
    SOCKET_PING_INTERVAL_MS: parseNumberEnv('SOCKET_PING_INTERVAL_MS', 20000, { min: 5000 }),
    SOCKET_PING_TIMEOUT_MS: parseNumberEnv('SOCKET_PING_TIMEOUT_MS', 25000, { min: 5000 }),
    SOCKET_MAX_HTTP_BUFFER_SIZE: parseNumberEnv('SOCKET_MAX_HTTP_BUFFER_SIZE', 1000000, { min: 100000 }),
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || '',
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
    RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET || '',
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || '',
    SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
    SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
    SMTP_USER: process.env.SMTP_USER || '',
    SMTP_PASS: process.env.SMTP_PASS || '',
    // Inbox that receives landing-page waitlist signups and partner enquiries.
    SUPPORT_EMAIL: process.env.SUPPORT_EMAIL || 'support.fixo@gmail.com',
    GOOGLE_CLIENT_IDS: googleClientIds,
    GOOGLE_CLIENT_ID: googleClientIds[0] || '',
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
    WEB_PUSH_ENABLED: parseBooleanEnv('WEB_PUSH_ENABLED', true),
    WEB_PUSH_PUBLIC_KEY: process.env.WEB_PUSH_PUBLIC_KEY || '',
    WEB_PUSH_PRIVATE_KEY: process.env.WEB_PUSH_PRIVATE_KEY || '',
    WEB_PUSH_SUBJECT: process.env.WEB_PUSH_SUBJECT || '',
    WEB_PUSH_TTL_SECONDS: parseNumberEnv('WEB_PUSH_TTL_SECONDS', 3600, { min: 60, max: 86400 }),
    MOBILE_PUSH_ENABLED: parseBooleanEnv('MOBILE_PUSH_ENABLED', true),
    FIREBASE_SERVICE_ACCOUNT_JSON: process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '',
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '',
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || '',
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY || '',
    MAPCN_GEOCODE_URL: process.env.MAPCN_GEOCODE_URL || 'https://nominatim.openstreetmap.org/search',
    MAPCN_REVERSE_GEOCODE_URL: process.env.MAPCN_REVERSE_GEOCODE_URL || 'https://nominatim.openstreetmap.org/reverse',
    MAPCN_ROUTING_URL: process.env.MAPCN_ROUTING_URL || 'https://router.project-osrm.org/route/v1/driving',
    JOB_STALE_BOOKING_MINUTES: parseNumberEnv('JOB_STALE_BOOKING_MINUTES', 30, { min: 1, max: 120 }),
    JOB_CLEANUP_INTERVAL_MS: parseNumberEnv('JOB_CLEANUP_INTERVAL_MS', 60000, { min: 5000 }),
    LOG_LEVEL: resolveLogLevel(),
};
exports.default = env;
//# sourceMappingURL=env.js.map