"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireTrustedOrigin = void 0;
const env_1 = __importDefault(require("../config/env"));
const logger_1 = __importDefault(require("../utils/logger"));
const allowedOrigins = new Set(env_1.default.CLIENT_URLS);
/**
 * CSRF protection for the cookie-authenticated auth endpoints.
 *
 * Why this rather than a CSRF token:
 *
 * The refresh cookie is `SameSite=Lax` (the default in both supported topologies),
 * and Lax cookies are NOT sent on cross-site POST requests. /auth/refresh,
 * /auth/logout and /auth/logout-all are all POST, so a cross-site form or fetch from
 * evil.com simply arrives without the cookie and fails — SameSite is already doing
 * the job a CSRF token would do, without the synchroniser-token machinery.
 *
 * This guard is the second layer, for two cases SameSite alone does not cover:
 *   1. A deployment forced to `REFRESH_COOKIE_SAMESITE=none` (genuinely cross-site),
 *      where the browser *would* attach the cookie.
 *   2. Browsers that do not implement Lax-by-default.
 *
 * Native clients are exempt: they send no Origin header and no cookie — their refresh
 * token travels in an explicit header/body, which is not something a hostile page can
 * cause a browser to send.
 */
const requireTrustedOrigin = (req, res, next) => {
    const origin = req.headers.origin;
    // No Origin header => not a browser-initiated cross-site request (native app,
    // server-to-server, curl). Those cannot be CSRF'd: an attacker's leverage in CSRF
    // is a *browser* silently attaching a cookie, which requires an Origin.
    if (!origin) {
        next();
        return;
    }
    if (allowedOrigins.has(origin)) {
        next();
        return;
    }
    logger_1.default.warn('Blocked auth request from untrusted origin', {
        origin,
        path: req.path,
        ipAddress: req.ip,
    });
    res.status(403).json({ message: 'Request origin not allowed' });
};
exports.requireTrustedOrigin = requireTrustedOrigin;
//# sourceMappingURL=originGuard.js.map