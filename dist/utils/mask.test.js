"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const mask_1 = require("./mask");
(0, vitest_1.describe)('maskEmail()', () => {
    (0, vitest_1.it)('masks the local part, keeps the domain', () => {
        (0, vitest_1.expect)((0, mask_1.maskEmail)('prince@example.com')).toBe('p*****@example.com');
    });
    (0, vitest_1.it)('handles empty/invalid safely (never throws, never leaks)', () => {
        (0, vitest_1.expect)((0, mask_1.maskEmail)('')).toBe('[none]');
        (0, vitest_1.expect)((0, mask_1.maskEmail)(null)).toBe('[none]');
        (0, vitest_1.expect)((0, mask_1.maskEmail)(undefined)).toBe('[none]');
        (0, vitest_1.expect)((0, mask_1.maskEmail)('no-at-sign')).toBe('[masked]');
    });
});
(0, vitest_1.describe)('maskPhone()', () => {
    (0, vitest_1.it)('keeps only the last 4 digits', () => {
        (0, vitest_1.expect)((0, mask_1.maskPhone)('9876543210')).toBe('******3210');
        (0, vitest_1.expect)((0, mask_1.maskPhone)('+91 98765 43210')).toBe('********3210');
    });
    (0, vitest_1.it)('handles empty/short safely', () => {
        (0, vitest_1.expect)((0, mask_1.maskPhone)('')).toBe('[none]');
        (0, vitest_1.expect)((0, mask_1.maskPhone)(null)).toBe('[none]');
        (0, vitest_1.expect)((0, mask_1.maskPhone)('12')).toBe('[masked]');
    });
});
//# sourceMappingURL=mask.test.js.map