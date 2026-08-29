import type { Request, Response, NextFunction } from 'express';

/**
 * Delivers the refresh token to clients that cannot hold a cookie.
 *
 * Browsers get the refresh token as an HttpOnly cookie and it is deliberately never
 * visible to JavaScript. The Expo apps have no cookie jar, so for them (and only
 * them) the handler stashes the token on `res.locals.pendingRefreshToken` and this
 * middleware merges it into the outgoing JSON body.
 *
 * Doing it here — rather than in each of the dozen handlers that issue tokens —
 * keeps the rule in one place: a refresh token reaches a response body if and only
 * if a handler explicitly opted in for a native client.
 */
export const refreshTokenTransport = (_req: Request, res: Response, next: NextFunction): void => {
  const originalJson = res.json.bind(res);

  res.json = (body: unknown) => {
    const pending = res.locals.pendingRefreshToken;
    // Consume it, so a single stashed token can never be echoed twice.
    res.locals.pendingRefreshToken = undefined;

    if (typeof pending === 'string' && pending && body && typeof body === 'object' && !Array.isArray(body)) {
      return originalJson({ ...(body as Record<string, unknown>), refreshToken: pending });
    }
    return originalJson(body);
  };

  next();
};
