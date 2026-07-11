"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeRequest = void 0;
// Keys Mongo would interpret as query operators ($gt, $where, …) or as dotted
// paths (a.b) — the classic NoSQL-injection vectors when an object payload
// reaches a query. We strip them everywhere as defense-in-depth, on top of the
// per-route express-validator checks.
const isForbiddenKey = (key) => key.startsWith('$') || key.includes('.');
// Recursively remove forbidden keys. Objects/arrays are mutated IN PLACE — we
// never reassign `req.query`, which is a read-only getter in Express 5 (the
// reason the off-the-shelf express-mongo-sanitize breaks on this stack).
const sanitizeInPlace = (value, depth = 0) => {
    if (depth > 20 || value === null || typeof value !== 'object')
        return;
    if (Array.isArray(value)) {
        for (const item of value)
            sanitizeInPlace(item, depth + 1);
        return;
    }
    const record = value;
    for (const key of Object.keys(record)) {
        if (isForbiddenKey(key)) {
            delete record[key];
            continue;
        }
        sanitizeInPlace(record[key], depth + 1);
    }
};
const sanitizeRequest = (req, _res, next) => {
    sanitizeInPlace(req.body);
    sanitizeInPlace(req.params);
    // req.query is a getter in Express 5; deleting keys on the returned object is
    // fine, but guard in case a runtime freezes it.
    try {
        sanitizeInPlace(req.query);
    }
    catch {
        /* query left as-is; body/params already sanitized */
    }
    next();
};
exports.sanitizeRequest = sanitizeRequest;
exports.default = exports.sanitizeRequest;
//# sourceMappingURL=sanitize.middleware.js.map