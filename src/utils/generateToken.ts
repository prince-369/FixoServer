import jwt, { type SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import env from '../config/env';

interface TokenPayload {
  id: string;
  role: 'customer' | 'worker' | 'admin';
}

// Access token — short-lived (15 minutes)
export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '15m' });
};

// Verify access token
export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
};

// Refresh token — cryptographically random string (not JWT)
export const generateRefreshTokenString = (): string => {
  return crypto.randomBytes(40).toString('hex');
};

// Legacy — keep for backward compatibility during transition
export const generateToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRE as SignOptions['expiresIn'],
  });
};

export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
};
