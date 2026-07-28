"use strict";
/**
 * Production-safe structured logger.
 *
 * Levels (low → high): debug < info < warn < error. Only messages at or above the
 * configured threshold are emitted.
 *
 * Threshold resolution (first match wins):
 *   1. process.env.LOG_LEVEL  (debug | info | warn | error | silent)
 *   2. NODE_ENV === 'production' → 'warn'
 *   3. NODE_ENV === 'test'       → 'warn'   (keeps test output clean)
 *   4. otherwise (development)   → 'debug'
 *
 * Reads process.env directly (not the validated env config) so it stays usable in
 * standalone scripts and before/if env validation throws.
 *
 * Safety: every metadata object is deep-redacted before printing. Values under any key
 * whose name looks sensitive (password, otp, token, authorization, aadhaar, secret,
 * payment credentials, signatures, …) are replaced with '[REDACTED]'. Callers must still
 * avoid passing raw secrets or signed URLs as the message string itself.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.redact = void 0;
const LEVEL_WEIGHT = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
    silent: 99,
};
const resolveThreshold = () => {
    const raw = (process.env.LOG_LEVEL || '').trim().toLowerCase();
    if (raw && raw in LEVEL_WEIGHT)
        return raw;
    const nodeEnv = (process.env.NODE_ENV || 'development').toLowerCase();
    if (nodeEnv === 'production')
        return 'warn';
    if (nodeEnv === 'test')
        return 'warn';
    return 'debug';
};
// Evaluated once at module load; a process restart picks up env changes.
const threshold = resolveThreshold();
const thresholdWeight = LEVEL_WEIGHT[threshold];
// Any object key matching one of these (case-insensitive substring) is redacted.
const SENSITIVE_KEY_PATTERNS = [
    'password', 'passwd', 'pwd',
    'otp', 'otpcode', 'pin',
    'token', 'accesstoken', 'refreshtoken', 'jwt', 'idtoken', 'sockettoken',
    'authorization', 'auth', 'cookie', 'setcookie',
    'secret', 'apikey', 'api_key', 'apisecret', 'api_secret', 'privatekey', 'private_key',
    'aadhaar', 'aadhar', 'aadhaarnumber', 'aadhaarhash',
    'card', 'cardnumber', 'cvv', 'cvc',
    'razorpaysignature', 'signature', 'webhooksecret',
    'clientsecret', 'client_secret',
];
const isSensitiveKey = (key) => {
    const k = key.toLowerCase().replace(/[_-]/g, '');
    return SENSITIVE_KEY_PATTERNS.some((p) => k.includes(p.replace(/[_-]/g, '')));
};
const REDACTED = '[REDACTED]';
const MAX_DEPTH = 4;
/**
 * Returns a deep copy of `value` with sensitive fields redacted. Guards against cycles
 * and caps depth so a huge/looping object can never blow up a log line.
 */
const redact = (value, depth = 0, seen = new WeakSet()) => {
    if (value === null || value === undefined)
        return value;
    const t = typeof value;
    if (t === 'string' || t === 'number' || t === 'boolean' || t === 'bigint')
        return value;
    if (t === 'function')
        return '[Function]';
    if (value instanceof Date)
        return value.toISOString();
    if (value instanceof Error) {
        // Keep only safe diagnostics — name/message/stack plus a non-sensitive error code
        // (e.g. Mongo 11000, Node 'ECONNREFUSED', http status). We deliberately DO NOT copy
        // other Error properties (axios `config`/`response`, provider payloads) which can carry
        // tokens, headers, URLs or recipient data.
        const e = value;
        const out = { name: e.name, message: e.message, stack: e.stack };
        if (e.code !== undefined && (typeof e.code === 'string' || typeof e.code === 'number')) {
            out.code = e.code;
        }
        return out;
    }
    if (depth >= MAX_DEPTH)
        return '[Truncated]';
    if (Array.isArray(value)) {
        if (seen.has(value))
            return '[Circular]';
        seen.add(value);
        return value.slice(0, 50).map((item) => (0, exports.redact)(item, depth + 1, seen));
    }
    if (t === 'object') {
        const obj = value;
        if (seen.has(obj))
            return '[Circular]';
        seen.add(obj);
        const out = {};
        for (const key of Object.keys(obj)) {
            out[key] = isSensitiveKey(key) ? REDACTED : (0, exports.redact)(obj[key], depth + 1, seen);
        }
        return out;
    }
    return String(value);
};
exports.redact = redact;
const write = (level, message, meta) => {
    if (LEVEL_WEIGHT[level] < thresholdWeight)
        return;
    const entry = {
        time: new Date().toISOString(),
        level,
        msg: message,
    };
    if (meta !== undefined)
        entry.meta = (0, exports.redact)(meta);
    // error/warn → stderr, else stdout. JSON line is CloudWatch-friendly.
    const line = JSON.stringify(entry);
    if (level === 'error' || level === 'warn') {
        // eslint-disable-next-line no-console
        console.error(line);
    }
    else {
        // eslint-disable-next-line no-console
        console.log(line);
    }
};
exports.logger = {
    level: threshold,
    isEnabled: (level) => LEVEL_WEIGHT[level] >= thresholdWeight,
    debug: (message, meta) => write('debug', message, meta),
    info: (message, meta) => write('info', message, meta),
    warn: (message, meta) => write('warn', message, meta),
    error: (message, meta) => write('error', message, meta),
};
exports.default = exports.logger;
//# sourceMappingURL=logger.js.map