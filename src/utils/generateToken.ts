import jwt, { type SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import env from '../config/env';

export interface TokenPayload {
  /** User / worker / admin id. */
  id: string;
  role: 'customer' | 'worker' | 'admin';
  /**
   * AuthSession id this token was minted from. Lets a request be traced back to a
   * device and lets "change password" keep the acting session alive. Optional so
   * access tokens issued by the previous implementation still verify during rollout.
   */
  sid?: string;
}

interface AccessTokenClaims extends TokenPayload {
  /**
   * Guards against a refresh token (or any other signed artefact) being replayed as
   * a bearer credential. Refresh tokens are opaque today, but the claim is asserted
   * on verify so that stays true if a signed refresh token is ever introduced.
   */
  tokenType: 'access';
}

// Algorithm is pinned on both sign and verify to prevent algorithm-confusion
// attacks (e.g. a forged token declaring "alg":"none" or an asymmetric alg).
const JWT_ALGORITHM: SignOptions['algorithm'] = 'HS256';

/**
 * Short-lived access token (ACCESS_TOKEN_TTL, default 15m). Deliberately minimal:
 * id, role, session id. No email, phone, name or verification state — those change,
 * and a token is not a profile cache.
 */
export const generateAccessToken = (payload: TokenPayload): string => {
  const claims: AccessTokenClaims = {
    id: payload.id,
    role: payload.role,
    ...(payload.sid ? { sid: payload.sid } : {}),
    tokenType: 'access',
  };

  return jwt.sign(claims, env.JWT_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL as SignOptions['expiresIn'],
    algorithm: JWT_ALGORITHM,
  });
};

export const verifyAccessToken = (token: string): TokenPayload => {
  const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: [JWT_ALGORITHM] }) as
    Partial<AccessTokenClaims>;

  // Tokens minted before `tokenType` existed have no claim at all — accepted so a
  // deploy does not invalidate every in-flight access token. Anything that declares
  // a *different* type is rejected outright.
  if (decoded.tokenType && decoded.tokenType !== 'access') {
    throw new jwt.JsonWebTokenError('Invalid token type');
  }
  if (!decoded.id || !decoded.role) {
    throw new jwt.JsonWebTokenError('Malformed token payload');
  }

  return { id: decoded.id, role: decoded.role, sid: decoded.sid };
};

/**
 * Legacy opaque refresh string generator.
 * @deprecated Session creation now owns token material — see
 * `createSession` / `rotateSession` in `services/authSession.service.ts`.
 */
export const generateRefreshTokenString = (): string => crypto.randomBytes(40).toString('hex');

// Legacy aliases — kept so non-auth call sites keep compiling during the migration.
export const generateToken = generateAccessToken;
export const verifyToken = verifyAccessToken;
