"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const socket_1 = require("../socket");
const env_1 = require("./env");
/**
 * Phase 9 environment-resolution matrix for the Socket.IO Redis adapter.
 * `resolveSocketAdapter` is the pure decision function used by the socket bootstrap.
 */
(0, vitest_1.describe)('resolveSocketAdapter() — env matrix', () => {
    const URL = 'redis://host:6379';
    (0, vitest_1.it)('REDIS_URL absent, flag absent → disabled', () => {
        (0, vitest_1.expect)((0, socket_1.resolveSocketAdapter)('', undefined)).toBe('disabled');
        (0, vitest_1.expect)((0, socket_1.resolveSocketAdapter)(undefined, undefined)).toBe('disabled');
    });
    (0, vitest_1.it)('REDIS_URL present, flag absent → enabled (backward-compatible)', () => {
        (0, vitest_1.expect)((0, socket_1.resolveSocketAdapter)(URL, undefined)).toBe('enabled');
    });
    (0, vitest_1.it)('REDIS_URL present, flag false → disabled', () => {
        (0, vitest_1.expect)((0, socket_1.resolveSocketAdapter)(URL, false)).toBe('disabled');
    });
    (0, vitest_1.it)('REDIS_URL present, flag true → enabled', () => {
        (0, vitest_1.expect)((0, socket_1.resolveSocketAdapter)(URL, true)).toBe('enabled');
    });
    (0, vitest_1.it)('REDIS_URL absent, flag false → disabled', () => {
        (0, vitest_1.expect)((0, socket_1.resolveSocketAdapter)('', false)).toBe('disabled');
    });
    (0, vitest_1.it)('REDIS_URL absent, flag true → enabled-without-redis (warn + in-memory)', () => {
        (0, vitest_1.expect)((0, socket_1.resolveSocketAdapter)('', true)).toBe('enabled-without-redis');
    });
});
(0, vitest_1.describe)('parseStrictBooleanEnv() — strict "true"/"false" only', () => {
    const KEY = 'PHASE9_TEST_FLAG';
    (0, vitest_1.afterEach)(() => { delete process.env[KEY]; });
    (0, vitest_1.it)('absent / empty → undefined (backward-compatible)', () => {
        (0, vitest_1.expect)((0, env_1.parseStrictBooleanEnv)(KEY)).toBeUndefined();
        process.env[KEY] = '   ';
        (0, vitest_1.expect)((0, env_1.parseStrictBooleanEnv)(KEY)).toBeUndefined();
    });
    (0, vitest_1.it)('exact "true"/"false" → boolean', () => {
        process.env[KEY] = 'true';
        (0, vitest_1.expect)((0, env_1.parseStrictBooleanEnv)(KEY)).toBe(true);
        process.env[KEY] = 'false';
        (0, vitest_1.expect)((0, env_1.parseStrictBooleanEnv)(KEY)).toBe(false);
    });
    (0, vitest_1.it)('loose/invalid values throw a configuration error', () => {
        for (const bad of ['1', '0', 'yes', 'on', 'TRUE', 'False', 'enabled']) {
            process.env[KEY] = bad;
            (0, vitest_1.expect)(() => (0, env_1.parseStrictBooleanEnv)(KEY)).toThrow(/Expected exactly "true" or "false"/);
        }
    });
});
//# sourceMappingURL=socketAdapter.test.js.map