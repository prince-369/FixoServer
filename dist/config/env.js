"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
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
const parseClientOrigins = (primaryOrigin) => {
    const list = process.env.CLIENT_URLS
        ?.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean) || [];
    if (!list.includes(primaryOrigin)) {
        list.unshift(primaryOrigin);
    }
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
const clientUrl = getEnvOrDefault('CLIENT_URL', 'http://localhost:3000', { requiredInProduction: true });
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
    JWT_EXPIRE: process.env.JWT_EXPIRE || '7d',
    CLIENT_URL: clientUrl,
    CLIENT_URLS: parseClientOrigins(clientUrl),
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
    MUTATION_RATE_LIMIT_MAX: parseNumberEnv('MUTATION_RATE_LIMIT_MAX', 150, { min: 10 }),
    IDEMPOTENCY_TTL_MS: parseNumberEnv('IDEMPOTENCY_TTL_MS', 15000, { min: 3000 }),
    REDIS_URL: process.env.REDIS_URL || '',
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
    GOOGLE_CLIENT_IDS: googleClientIds,
    GOOGLE_CLIENT_ID: googleClientIds[0] || '',
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
    WEB_PUSH_ENABLED: parseBooleanEnv('WEB_PUSH_ENABLED', true),
    WEB_PUSH_PUBLIC_KEY: process.env.WEB_PUSH_PUBLIC_KEY || '',
    WEB_PUSH_PRIVATE_KEY: process.env.WEB_PUSH_PRIVATE_KEY || '',
    WEB_PUSH_SUBJECT: process.env.WEB_PUSH_SUBJECT || '',
    WEB_PUSH_TTL_SECONDS: parseNumberEnv('WEB_PUSH_TTL_SECONDS', 3600, { min: 60, max: 86400 }),
    MAPCN_GEOCODE_URL: process.env.MAPCN_GEOCODE_URL || 'https://nominatim.openstreetmap.org/search',
    MAPCN_REVERSE_GEOCODE_URL: process.env.MAPCN_REVERSE_GEOCODE_URL || 'https://nominatim.openstreetmap.org/reverse',
    MAPCN_ROUTING_URL: process.env.MAPCN_ROUTING_URL || 'https://router.project-osrm.org/route/v1/driving',
    JOB_STALE_BOOKING_MINUTES: parseNumberEnv('JOB_STALE_BOOKING_MINUTES', 30, { min: 1, max: 120 }),
    JOB_CLEANUP_INTERVAL_MS: parseNumberEnv('JOB_CLEANUP_INTERVAL_MS', 60000, { min: 5000 }),
};
exports.default = env;
//# sourceMappingURL=env.js.map