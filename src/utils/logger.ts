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

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 99,
};

const resolveThreshold = (): LogLevel => {
  const raw = (process.env.LOG_LEVEL || '').trim().toLowerCase();
  if (raw && raw in LEVEL_WEIGHT) return raw as LogLevel;

  const nodeEnv = (process.env.NODE_ENV || 'development').toLowerCase();
  if (nodeEnv === 'production') return 'warn';
  if (nodeEnv === 'test') return 'warn';
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

const isSensitiveKey = (key: string): boolean => {
  const k = key.toLowerCase().replace(/[_-]/g, '');
  return SENSITIVE_KEY_PATTERNS.some((p) => k.includes(p.replace(/[_-]/g, '')));
};

const REDACTED = '[REDACTED]';
const MAX_DEPTH = 4;

/**
 * Returns a deep copy of `value` with sensitive fields redacted. Guards against cycles
 * and caps depth so a huge/looping object can never blow up a log line.
 */
export const redact = (value: unknown, depth = 0, seen = new WeakSet<object>()): unknown => {
  if (value === null || value === undefined) return value;

  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean' || t === 'bigint') return value;
  if (t === 'function') return '[Function]';
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    // Keep only safe diagnostics — name/message/stack plus a non-sensitive error code
    // (e.g. Mongo 11000, Node 'ECONNREFUSED', http status). We deliberately DO NOT copy
    // other Error properties (axios `config`/`response`, provider payloads) which can carry
    // tokens, headers, URLs or recipient data.
    const e = value as Error & { code?: string | number };
    const out: Record<string, unknown> = { name: e.name, message: e.message, stack: e.stack };
    if (e.code !== undefined && (typeof e.code === 'string' || typeof e.code === 'number')) {
      out.code = e.code;
    }
    return out;
  }

  if (depth >= MAX_DEPTH) return '[Truncated]';

  if (Array.isArray(value)) {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    return value.slice(0, 50).map((item) => redact(item, depth + 1, seen));
  }

  if (t === 'object') {
    const obj = value as Record<string, unknown>;
    if (seen.has(obj)) return '[Circular]';
    seen.add(obj);
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      out[key] = isSensitiveKey(key) ? REDACTED : redact(obj[key], depth + 1, seen);
    }
    return out;
  }

  return String(value);
};

const write = (level: Exclude<LogLevel, 'silent'>, message: string, meta?: unknown): void => {
  if (LEVEL_WEIGHT[level] < thresholdWeight) return;

  const entry: Record<string, unknown> = {
    time: new Date().toISOString(),
    level,
    msg: message,
  };
  if (meta !== undefined) entry.meta = redact(meta);

  // error/warn → stderr, else stdout. JSON line is CloudWatch-friendly.
  const line = JSON.stringify(entry);
  if (level === 'error' || level === 'warn') {
    // eslint-disable-next-line no-console
    console.error(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
};

export const logger = {
  level: threshold,
  isEnabled: (level: Exclude<LogLevel, 'silent'>): boolean => LEVEL_WEIGHT[level] >= thresholdWeight,
  debug: (message: string, meta?: unknown): void => write('debug', message, meta),
  info: (message: string, meta?: unknown): void => write('info', message, meta),
  warn: (message: string, meta?: unknown): void => write('warn', message, meta),
  error: (message: string, meta?: unknown): void => write('error', message, meta),
};

export default logger;
