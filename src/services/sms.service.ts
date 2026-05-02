import crypto from 'crypto';
import twilio from 'twilio';
import env from '../config/env';
import OtpCode from '../models/OtpCode';

const OTP_EXPIRY_MINUTES = 10;
const OTP_PURPOSE = 'password-reset';

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
  const otpHash = hashOTP(phone, otp);

  await OtpCode.findOneAndUpdate(
    { phone, purpose: OTP_PURPOSE },
    {
      otpHash,
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
    },
    {
      upsert: true,
      setDefaultsOnInsert: true,
      new: true,
    }
  );
};

export const verifyOTP = async (phone: string, otp: string): Promise<boolean> => {
  const otpHash = hashOTP(phone, otp);

  const stored = await OtpCode.findOneAndDelete({
    phone,
    purpose: OTP_PURPOSE,
    otpHash,
    expiresAt: { $gt: new Date() },
  });

  return Boolean(stored);
};

export const sendOTP = async (phone: string, otp: string): Promise<boolean> => {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_PHONE_NUMBER) {
    console.error('[SMS] Twilio credentials missing. OTP was not sent.');
    return false;
  }

  try {
    const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

    await client.messages.create({
      body: `Your Fixo verification code is: ${otp}. Valid for ${OTP_EXPIRY_MINUTES} minutes. Do not share this code with anyone.`,
      from: env.TWILIO_PHONE_NUMBER,
      to: `+91${phone}`,
    });

    console.log(`[SMS] OTP sent successfully to ${phone}`);
    return true;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown SMS provider error';
    console.error('[SMS] Twilio Error:', message);
    return false;
  }
};
