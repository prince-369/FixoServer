import crypto from 'crypto';

export const generateTID = (): string => {
  const prefix = 'TXN';
  const random = crypto.randomBytes(8).toString('hex').toUpperCase();
  return `${prefix}${random}`;
};
