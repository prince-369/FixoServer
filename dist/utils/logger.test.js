"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const logger_1 = require("./logger");
(0, vitest_1.describe)('logger redact()', () => {
    (0, vitest_1.it)('redacts sensitive top-level keys', () => {
        const out = (0, logger_1.redact)({
            email: 'a@b.com',
            password: 'hunter2',
            otp: '123456',
            accessToken: 'jwt.token.here',
            refreshToken: 'refresh',
            authorization: 'Bearer x',
            aadhaarNumber: '1234',
            cvv: '999',
        });
        (0, vitest_1.expect)(out.email).toBe('a@b.com');
        (0, vitest_1.expect)(out.password).toBe('[REDACTED]');
        (0, vitest_1.expect)(out.otp).toBe('[REDACTED]');
        (0, vitest_1.expect)(out.accessToken).toBe('[REDACTED]');
        (0, vitest_1.expect)(out.refreshToken).toBe('[REDACTED]');
        (0, vitest_1.expect)(out.authorization).toBe('[REDACTED]');
        (0, vitest_1.expect)(out.aadhaarNumber).toBe('[REDACTED]');
        (0, vitest_1.expect)(out.cvv).toBe('[REDACTED]');
    });
    (0, vitest_1.it)('redacts snake_case and mixed variants', () => {
        const out = (0, logger_1.redact)({ api_secret: 'x', client_secret: 'y', razorpay_signature: 'z' });
        (0, vitest_1.expect)(out.api_secret).toBe('[REDACTED]');
        (0, vitest_1.expect)(out.client_secret).toBe('[REDACTED]');
        (0, vitest_1.expect)(out.razorpay_signature).toBe('[REDACTED]');
    });
    (0, vitest_1.it)('redacts nested sensitive keys', () => {
        const out = (0, logger_1.redact)({ user: { name: 'A', password: 'p' }, meta: { token: 't' } });
        (0, vitest_1.expect)(out.user.name).toBe('A');
        (0, vitest_1.expect)(out.user.password).toBe('[REDACTED]');
        (0, vitest_1.expect)(out.meta.token).toBe('[REDACTED]');
    });
    (0, vitest_1.it)('leaves non-sensitive values untouched', () => {
        (0, vitest_1.expect)((0, logger_1.redact)('hello')).toBe('hello');
        (0, vitest_1.expect)((0, logger_1.redact)(42)).toBe(42);
        (0, vitest_1.expect)((0, logger_1.redact)(true)).toBe(true);
        (0, vitest_1.expect)((0, logger_1.redact)(null)).toBe(null);
        (0, vitest_1.expect)((0, logger_1.redact)(undefined)).toBe(undefined);
    });
    (0, vitest_1.it)('serialises Error (name/message/stack/code) and Date', () => {
        const err = (0, logger_1.redact)(new Error('boom'));
        (0, vitest_1.expect)(err.name).toBe('Error');
        (0, vitest_1.expect)(err.message).toBe('boom');
        (0, vitest_1.expect)(typeof err.stack).toBe('string');
        const withCode = (0, logger_1.redact)(Object.assign(new Error('dup'), { code: 11000 }));
        (0, vitest_1.expect)(withCode.code).toBe(11000);
        const d = new Date('2026-01-01T00:00:00.000Z');
        (0, vitest_1.expect)((0, logger_1.redact)(d)).toBe('2026-01-01T00:00:00.000Z');
    });
    (0, vitest_1.it)('does NOT copy unsafe Error properties (axios config/response)', () => {
        const e = new Error('request failed');
        e.config = { headers: { authorization: 'Bearer secret' } };
        e.response = { data: { otp: '123456' } };
        const out = (0, logger_1.redact)(e);
        (0, vitest_1.expect)(out.config).toBeUndefined();
        (0, vitest_1.expect)(out.response).toBeUndefined();
        (0, vitest_1.expect)(JSON.stringify(out)).not.toContain('secret');
        (0, vitest_1.expect)(JSON.stringify(out)).not.toContain('123456');
    });
    (0, vitest_1.it)('handles circular references without throwing', () => {
        const a = { name: 'x' };
        a.self = a;
        (0, vitest_1.expect)(() => (0, logger_1.redact)(a)).not.toThrow();
        const out = (0, logger_1.redact)(a);
        (0, vitest_1.expect)(out.name).toBe('x');
        (0, vitest_1.expect)(out.self).toBe('[Circular]');
    });
    (0, vitest_1.it)('caps depth', () => {
        const deep = { a: { b: { c: { d: { e: { f: 'too deep' } } } } } };
        const out = (0, logger_1.redact)(deep);
        // At MAX_DEPTH the value becomes a truncation marker rather than recursing forever.
        (0, vitest_1.expect)(JSON.stringify(out)).toContain('[Truncated]');
    });
});
//# sourceMappingURL=logger.test.js.map