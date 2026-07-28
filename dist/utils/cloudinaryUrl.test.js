"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const cloudinaryUrl_1 = require("./cloudinaryUrl");
const BASE = 'https://res.cloudinary.com/demo/image/upload/v1699999999/fixo/categories/abc123.jpg';
(0, vitest_1.describe)('cldUrl()', () => {
    (0, vitest_1.it)('inserts f_auto,q_auto and sizing into a plain delivery URL', () => {
        const out = (0, cloudinaryUrl_1.cldUrl)(BASE, { width: 400, height: 300, crop: 'fill', gravity: 'auto' });
        (0, vitest_1.expect)(out).toBe('https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_fill,g_auto,w_400,h_300/v1699999999/fixo/categories/abc123.jpg');
    });
    (0, vitest_1.it)('defaults to f_auto,q_auto when no options given', () => {
        (0, vitest_1.expect)((0, cloudinaryUrl_1.cldUrl)(BASE)).toBe('https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1699999999/fixo/categories/abc123.jpg');
    });
    (0, vitest_1.it)('does NOT double-transform an already-transformed URL', () => {
        const already = 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_400/v1/fixo/x.jpg';
        (0, vitest_1.expect)((0, cloudinaryUrl_1.cldUrl)(already, { width: 800 })).toBe(already);
    });
    (0, vitest_1.it)('works for video delivery URLs (voice notes)', () => {
        const v = 'https://res.cloudinary.com/demo/video/upload/v1/fixo/booking-voice/note.webm';
        (0, vitest_1.expect)((0, cloudinaryUrl_1.cldUrl)(v, { quality: 'auto' })).toBe('https://res.cloudinary.com/demo/video/upload/f_auto,q_auto/v1/fixo/booking-voice/note.webm');
    });
    (0, vitest_1.it)('returns empty / nullish values unchanged', () => {
        (0, vitest_1.expect)((0, cloudinaryUrl_1.cldUrl)('')).toBe('');
        (0, vitest_1.expect)((0, cloudinaryUrl_1.cldUrl)(null)).toBe('');
        (0, vitest_1.expect)((0, cloudinaryUrl_1.cldUrl)(undefined)).toBe('');
    });
    (0, vitest_1.it)('returns non-cloudinary URLs unchanged', () => {
        const google = 'https://lh3.googleusercontent.com/a/abc=s96-c';
        (0, vitest_1.expect)((0, cloudinaryUrl_1.cldUrl)(google, { width: 200 })).toBe(google);
        const other = 'https://example.com/image/upload/x.jpg';
        (0, vitest_1.expect)((0, cloudinaryUrl_1.cldUrl)(other, { width: 200 })).toBe(other);
    });
    (0, vitest_1.it)('returns data:, blob: and relative URLs unchanged', () => {
        (0, vitest_1.expect)((0, cloudinaryUrl_1.cldUrl)('data:image/png;base64,AAAA', { width: 10 })).toBe('data:image/png;base64,AAAA');
        (0, vitest_1.expect)((0, cloudinaryUrl_1.cldUrl)('blob:http://x/y', { width: 10 })).toBe('blob:http://x/y');
        (0, vitest_1.expect)((0, cloudinaryUrl_1.cldUrl)('/local/pic.png', { width: 10 })).toBe('/local/pic.png');
    });
    (0, vitest_1.it)('omits quality/format when explicitly disabled with null', () => {
        const out = (0, cloudinaryUrl_1.cldUrl)(BASE, { width: 100, quality: null, format: null });
        (0, vitest_1.expect)(out).toBe('https://res.cloudinary.com/demo/image/upload/w_100/v1699999999/fixo/categories/abc123.jpg');
    });
    (0, vitest_1.it)('supports dpr', () => {
        const out = (0, cloudinaryUrl_1.cldUrl)(BASE, { width: 100, dpr: 2, quality: null, format: null });
        (0, vitest_1.expect)(out).toContain('w_100,dpr_2');
    });
    (0, vitest_1.it)('presets produce transformed URLs', () => {
        (0, vitest_1.expect)(cloudinaryUrl_1.cldPreset.category(BASE)).toContain('/upload/f_auto,q_auto,c_fill,g_auto,w_400,h_300/');
        (0, vitest_1.expect)(cloudinaryUrl_1.cldPreset.avatar(BASE, 150)).toContain('g_auto,w_150,h_150');
        (0, vitest_1.expect)(cloudinaryUrl_1.cldPreset.thumb(BASE)).toContain('w_96,h_96');
        (0, vitest_1.expect)(cloudinaryUrl_1.cldPreset.banner(BASE)).toContain('c_limit,w_1000');
        (0, vitest_1.expect)(cloudinaryUrl_1.cldPreset.category(null)).toBe('');
    });
    // ── Phase 7 URL-shape coverage ──
    (0, vitest_1.it)('preserves the version segment (transform inserted before v123)', () => {
        const out = (0, cloudinaryUrl_1.cldUrl)(BASE, { width: 400 });
        (0, vitest_1.expect)(out).toBe('https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_400/v1699999999/fixo/categories/abc123.jpg');
    });
    (0, vitest_1.it)('handles a deep nested folder path', () => {
        const nested = 'https://res.cloudinary.com/demo/image/upload/v1/fixo/a/b/c/pic.png';
        (0, vitest_1.expect)((0, cloudinaryUrl_1.cldUrl)(nested, { width: 200 })).toBe('https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_200/v1/fixo/a/b/c/pic.png');
    });
    (0, vitest_1.it)('preserves a trailing query string', () => {
        const q = 'https://res.cloudinary.com/demo/image/upload/v1/fixo/x.jpg?_a=BAVABC&t=1';
        (0, vitest_1.expect)((0, cloudinaryUrl_1.cldUrl)(q, { width: 200 })).toBe('https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_200/v1/fixo/x.jpg?_a=BAVABC&t=1');
    });
    (0, vitest_1.it)('preserves special characters (spaces, parens) in the path', () => {
        const special = 'https://res.cloudinary.com/demo/image/upload/v1/fixo/My%20Folder/pic%20(1).png';
        (0, vitest_1.expect)((0, cloudinaryUrl_1.cldUrl)(special, { width: 128 })).toBe('https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_128/v1/fixo/My%20Folder/pic%20(1).png');
    });
    (0, vitest_1.it)('leaves a raw/upload URL matchable but is never fed one by image presets (caller-gated)', () => {
        // The helper is generic (supports image/video/raw); Phase 7 call sites only ever pass
        // image URLs. Documented here so the behavior is explicit.
        const raw = 'https://res.cloudinary.com/demo/raw/upload/v1/fixo/docs/report.pdf';
        (0, vitest_1.expect)((0, cloudinaryUrl_1.cldUrl)(raw, { width: 200 })).toBe('https://res.cloudinary.com/demo/raw/upload/f_auto,q_auto,w_200/v1/fixo/docs/report.pdf');
    });
    (0, vitest_1.it)('does NOT transform a signed delivery URL (would invalidate the signature)', () => {
        const signed = 'https://res.cloudinary.com/demo/image/upload/s--Ab12Cd34--/v1/fixo/x.jpg';
        (0, vitest_1.expect)((0, cloudinaryUrl_1.cldUrl)(signed, { width: 400 })).toBe(signed);
    });
    (0, vitest_1.it)('does NOT transform an authenticated/private delivery URL', () => {
        const authed = 'https://res.cloudinary.com/demo/image/authenticated/s--Ab12--/v1/fixo/x.jpg';
        const priv = 'https://res.cloudinary.com/demo/image/private/v1/fixo/x.jpg';
        (0, vitest_1.expect)((0, cloudinaryUrl_1.cldUrl)(authed, { width: 400 })).toBe(authed);
        (0, vitest_1.expect)((0, cloudinaryUrl_1.cldUrl)(priv, { width: 400 })).toBe(priv);
    });
});
//# sourceMappingURL=cloudinaryUrl.test.js.map