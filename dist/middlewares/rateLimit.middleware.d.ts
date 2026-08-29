export declare const apiLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const authLimiter: import("express-rate-limit").RateLimitRequestHandler;
/**
 * /auth/refresh has a different threat model from login: it is called legitimately
 * by every client on startup and whenever an access token expires, so the login
 * budget (30 / 15 min, keyed on a credential in the body) is both too tight and
 * keyed on fields refresh does not send.
 *
 * `skipSuccessfulRequests` means only FAILED refreshes count, so a normal user is
 * never throttled while someone spraying stolen tokens is cut off quickly.
 */
export declare const refreshLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const mutationLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const waitlistLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const partnerLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const closeRateLimiterStore: () => Promise<void>;
//# sourceMappingURL=rateLimit.middleware.d.ts.map