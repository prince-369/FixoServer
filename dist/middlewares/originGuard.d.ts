import type { Request, Response, NextFunction } from 'express';
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
export declare const requireTrustedOrigin: (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=originGuard.d.ts.map