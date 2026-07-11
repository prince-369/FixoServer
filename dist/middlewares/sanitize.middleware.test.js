"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const sanitize_middleware_1 = require("./sanitize.middleware");
// Proves the NoSQL-injection sanitizer (finding #5) strips Mongo operator keys
// ($...) and dotted paths from every input surface while leaving clean data.
const run = (body, query = {}, params = {}) => {
    const req = { body, query, params };
    let nextCalled = false;
    const next = () => {
        nextCalled = true;
    };
    (0, sanitize_middleware_1.sanitizeRequest)(req, {}, next);
    (0, vitest_1.expect)(nextCalled).toBe(true);
    return req;
};
(0, vitest_1.describe)('sanitizeRequest', () => {
    (0, vitest_1.it)('strips $-prefixed operator keys from the body', () => {
        const req = run({ phone: { $ne: null }, name: 'ok' });
        (0, vitest_1.expect)(req.body.phone).toEqual({});
        (0, vitest_1.expect)(req.body.name).toBe('ok');
    });
    (0, vitest_1.it)('strips dotted keys', () => {
        const req = run({ 'a.b': 1, plain: 2 });
        (0, vitest_1.expect)(req.body['a.b']).toBeUndefined();
        (0, vitest_1.expect)(req.body.plain).toBe(2);
    });
    (0, vitest_1.it)('recurses into nested objects and arrays', () => {
        const req = run({ list: [{ $where: 'evil', ok: 1 }], nested: { $gt: 5, keep: 3 } });
        (0, vitest_1.expect)(req.body.list[0].$where).toBeUndefined();
        (0, vitest_1.expect)(req.body.list[0].ok).toBe(1);
        (0, vitest_1.expect)(req.body.nested.$gt).toBeUndefined();
        (0, vitest_1.expect)(req.body.nested.keep).toBe(3);
    });
    (0, vitest_1.it)('sanitizes query and params too', () => {
        const req = run({}, { $gt: '1', q: 'x' }, { $set: 'y', id: 'z' });
        (0, vitest_1.expect)(req.query.$gt).toBeUndefined();
        (0, vitest_1.expect)(req.query.q).toBe('x');
        (0, vitest_1.expect)(req.params.$set).toBeUndefined();
        (0, vitest_1.expect)(req.params.id).toBe('z');
    });
    (0, vitest_1.it)('leaves clean payloads untouched', () => {
        const req = run({ a: 1, b: { c: 2 } });
        (0, vitest_1.expect)(req.body).toEqual({ a: 1, b: { c: 2 } });
    });
});
//# sourceMappingURL=sanitize.middleware.test.js.map