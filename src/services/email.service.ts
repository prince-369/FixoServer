import nodemailer from 'nodemailer';
import env from '../config/env';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

export const sendPasswordResetEmail = async (email: string, resetToken: string): Promise<boolean> => {
  try {
    const resetUrl = `${env.CLIENT_URL}/reset-password?token=${resetToken}`;

    if (!env.SMTP_USER) {
      console.log(`[DEV] Password reset link for ${email}: ${resetUrl}`);
      return true;
    }

    await transporter.sendMail({
      from: `"Fixo" <${env.SMTP_USER}>`,
      to: email,
      subject: 'Password Reset - Fixo',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Reset Your Password</h2>
          <p>You requested a password reset for your Fixo account.</p>
          <p>Click the button below to reset your password. This link expires in 1 hour.</p>
          <a href="${resetUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 16px 0;">Reset Password</a>
          <p style="color: #6b7280; font-size: 14px;">If you didn't request this, please ignore this email.</p>
        </div>
      `,
    });

    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
};

export const sendAccountDeactivationOtpEmail = async (
  email: string,
  otp: string,
  name?: string
): Promise<boolean> => {
  try {
    if (!env.SMTP_USER) {
      console.log(`[DEV] Account deactivation OTP for ${email}: ${otp}`);
      return true;
    }

    await transporter.sendMail({
      from: `"Fixo" <${env.SMTP_USER}>`,
      to: email,
      subject: 'Account Deactivation OTP - Fixo',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">Confirm Account Deactivation</h2>
          <p>Hello ${name || 'there'},</p>
          <p>We received a request to deactivate your Fixo account.</p>
          <p style="margin: 18px 0;">Use this OTP to continue:</p>
          <div style="display: inline-block; font-size: 28px; font-weight: bold; letter-spacing: 6px; background: #f3f4f6; padding: 10px 16px; border-radius: 8px; color: #111827;">
            ${otp}
          </div>
          <p style="margin-top: 18px; color: #6b7280;">This OTP expires in 10 minutes.</p>
          <p style="color: #6b7280; font-size: 14px;">If you did not request this action, please ignore this email.</p>
        </div>
      `,
    });

    return true;
  } catch (error) {
    console.error('Account deactivation OTP email error:', error);
    return false;
  }
};

export const sendPasswordSetupOtpEmail = async (
  email: string,
  otp: string,
  name?: string
): Promise<boolean> => {
  try {
    if (!env.SMTP_USER) {
      console.log(`[DEV] Password setup OTP for ${email}: ${otp}`);
      return true;
    }

    await transporter.sendMail({
      from: `"Fixo" <${env.SMTP_USER}>`,
      to: email,
      subject: 'Set Your Password - Fixo OTP',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0f1c3f;">Set Your Password</h2>
          <p>Hello ${name || 'there'},</p>
          <p>You requested to set a password for your Fixo account so you can also login with email/phone + password.</p>
          <p style="margin: 18px 0;">Enter this OTP to verify:</p>
          <div style="display: inline-block; font-size: 28px; font-weight: bold; letter-spacing: 6px; background: #f3f4f6; padding: 10px 16px; border-radius: 8px; color: #111827;">
            ${otp}
          </div>
          <p style="margin-top: 18px; color: #6b7280;">This OTP expires in 10 minutes.</p>
          <p style="color: #6b7280; font-size: 14px;">If you did not request this, please ignore this email.</p>
        </div>
      `,
    });

    return true;
  } catch (error) {
    console.error('Password setup OTP email error:', error);
    return false;
  }
};
