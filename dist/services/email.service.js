"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPasswordResetEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const env_1 = __importDefault(require("../config/env"));
const transporter = nodemailer_1.default.createTransport({
    host: env_1.default.SMTP_HOST,
    port: env_1.default.SMTP_PORT,
    secure: env_1.default.SMTP_PORT === 465,
    auth: {
        user: env_1.default.SMTP_USER,
        pass: env_1.default.SMTP_PASS,
    },
});
const sendPasswordResetEmail = async (email, resetToken) => {
    try {
        const resetUrl = `${env_1.default.CLIENT_URL}/reset-password?token=${resetToken}`;
        if (!env_1.default.SMTP_USER) {
            console.log(`[DEV] Password reset link for ${email}: ${resetUrl}`);
            return true;
        }
        await transporter.sendMail({
            from: `"Fixo" <${env_1.default.SMTP_USER}>`,
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
    }
    catch (error) {
        console.error('Email send error:', error);
        return false;
    }
};
exports.sendPasswordResetEmail = sendPasswordResetEmail;
//# sourceMappingURL=email.service.js.map