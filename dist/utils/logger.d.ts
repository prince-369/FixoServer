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
/**
 * Returns a deep copy of `value` with sensitive fields redacted. Guards against cycles
 * and caps depth so a huge/looping object can never blow up a log line.
 */
export declare const redact: (value: unknown, depth?: number, seen?: WeakSet<object>) => unknown;
export declare const logger: {
    level: LogLevel;
    isEnabled: (level: Exclude<LogLevel, "silent">) => boolean;
    debug: (message: string, meta?: unknown) => void;
    info: (message: string, meta?: unknown) => void;
    warn: (message: string, meta?: unknown) => void;
    error: (message: string, meta?: unknown) => void;
};
export default logger;
//# sourceMappingURL=logger.d.ts.map