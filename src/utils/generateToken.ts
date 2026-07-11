import jwt, { type SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import env from '../config/env';

interface TokenPayload {
  id: string;
  role: 'customer' | 'worker' | 'admin';
}

// Algorithm is pinned on both sign and verify to prevent algorithm-confusion
// attacks (e.g. a forged token declaring "alg":"none" or an asymmetric alg).
const JWT_ALGORITHM: SignOptions['algorithm'] = 'HS256';

// Access token — short-lived (matches JWT_EXPIRE from env, default 30 minutes);
// revocation is handled by the DB-backed refresh-token rotation.
export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRE as SignOptions['expiresIn'],
    algorithm: JWT_ALGORITHM,
  });
};

// Verify access token
export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, env.JWT_SECRET, { algorithms: [JWT_ALGORITHM] }) as TokenPayload;
};

// Refresh token — cryptographically random string (not JWT)
export const generateRefreshTokenString = (): string => {
  return crypto.randomBytes(40).toString('hex');
};

// Legacy — keep for backward compatibility during transition
export const generateToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRE as SignOptions['expiresIn'],
    algorithm: JWT_ALGORITHM,
  });
};

export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, env.JWT_SECRET, { algorithms: [JWT_ALGORITHM] }) as TokenPayload;
};
