import crypto from 'crypto';
import twilio from 'twilio';
import env from '../config/env';
import OtpCode from '../models/OtpCode';
import logger from '../utils/logger';
import { maskPhone } from '../utils/mask';

const OTP_EXPIRY_MINUTES = 10;
const OTP_PURPOSE = 'password-reset';
// After this many wrong guesses the OTP is invalidated and a new one must be
// requested — caps brute-force attempts per account regardless of source IP.
const MAX_OTP_ATTEMPTS = 5;

export type OtpVerifyResult =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'expired' | 'locked' };

const hashOTP = (phone: string, otp: string): string => {
  return crypto
    .createHash('sha256')
    .update(`${phone}:${otp}:${env.JWT_SECRET}`)
    .digest('hex');
};

export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const storeOTP = async (phone: string, otp: string): Promise<void> => {
  const otpHash = hashOTP(String(phone), otp);

  await OtpCode.findOneAndUpdate(
    { phone: String(phone), purpose: OTP_PURPOSE },
    {
      otpHash,
      attempts: 0, // fresh OTP resets the lockout counter
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
    },
    {
      upsert: true,
      setDefaultsOnInsert: true,
      new: true,
    }
  );
};

export const verifyOTP = async (phone: string, otp: string): Promise<OtpVerifyResult> => {
  const record = await OtpCode.findOne({ phone: String(phone), purpose: OTP_PURPOSE });
  if (!record) return { ok: false, reason: 'invalid' };

  if (record.expiresAt.getTime() <= Date.now()) {
    await OtpCode.deleteOne({ _id: record._id });
    return { ok: false, reason: 'expired' };
  }

  // Already exhausted — force the user to request a new OTP.
  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    await OtpCode.deleteOne({ _id: record._id });
    return { ok: false, reason: 'locked' };
  }

  const otpHash = hashOTP(String(phone), otp);
  if (record.otpHash !== otpHash) {
    // Atomically count this failed guess; invalidate once the cap is hit.
    const updated = await OtpCode.findOneAndUpdate(
      { _id: record._id },
      { $inc: { attempts: 1 } },
      { new: true }
    );
    if (updated && updated.attempts >= MAX_OTP_ATTEMPTS) {
      await OtpCode.deleteOne({ _id: record._id });
      return { ok: false, reason: 'locked' };
    }
    return { ok: false, reason: 'invalid' };
  }

  // Correct OTP — single use.
  await OtpCode.deleteOne({ _id: record._id });
  return { ok: true };
};

export const sendOTP = async (phone: string, otp: string): Promise<boolean> => {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_PHONE_NUMBER) {
    logger.warn('SMS provider not configured; OTP not sent', { provider: 'twilio' });
    return false;
  }

  try {
    const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

    await client.messages.create({
      body: `Your Fixo verification code is: ${otp}. Valid for ${OTP_EXPIRY_MINUTES} minutes. Do not share this code with anyone.`,
      from: env.TWILIO_PHONE_NUMBER,
      to: `+91${phone}`,
    });

    logger.debug('OTP SMS sent', { provider: 'twilio', recipientMasked: maskPhone(phone) });
    return true;
  } catch (error: unknown) {
    // Twilio error messages can echo the recipient number, so log only the safe code +
    // masked recipient — never the raw provider message.
    logger.error('OTP SMS send failed', {
      provider: 'twilio',
      code: (error as { code?: string | number })?.code,
      recipientMasked: maskPhone(phone),
    });
    return false;
  }
};
