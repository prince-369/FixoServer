import crypto from 'crypto';

export const generatePin = (): string => {
  return crypto.randomInt(100000, 999999).toString();
};
