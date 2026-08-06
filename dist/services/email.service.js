"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPasswordSetupOtpEmail = exports.sendAccountDeactivationOtpEmail = exports.sendPasswordResetEmail = exports.sendPartnerRequestEmail = exports.sendWaitlistSignupEmail = exports.verifyEmailTransport = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const env_1 = __importDefault(require("../config/env"));
const logger_1 = __importDefault(require("../utils/logger"));
const mask_1 = require("../utils/mask");
const transporter = nodemailer_1.default.createTransport({
    host: env_1.default.SMTP_HOST,
    port: env_1.default.SMTP_PORT,
    secure: env_1.default.SMTP_PORT === 465,
    auth: {
        user: env_1.default.SMTP_USER,
        pass: env_1.default.SMTP_PASS,
    },
});
const isConfigured = () => Boolean(env_1.default.SMTP_USER && env_1.default.SMTP_PASS);
/**
 * Report an unconfigured provider once per call site, then fail.
 *
 * This used to `return true`, which told callers the mail was delivered when nothing had been
 * sent — the OTP flows then answered "OTP sent to your email" and the user waited forever for
 * a message that was never going to arrive. A send that did not happen is a failure.
 */
const notConfigured = (context, meta) => {
    logger_1.default.warn(`${context} not sent: email provider is not configured`, { provider: 'smtp', ...meta });
    return false;
};
/**
 * Probe SMTP credentials at boot so a revoked app password shows up in the startup logs
 * instead of silently breaking every OTP until someone reports it.
 *
 * Deliberately non-fatal: the API must still serve traffic when only email is broken.
 */
const verifyEmailTransport = async () => {
    if (!isConfigured()) {
        logger_1.default.warn('Email provider is not configured; OTP and password-reset emails will fail', {
            provider: 'smtp',
            host: env_1.default.SMTP_HOST,
        });
        return false;
    }
    try {
        await transporter.verify();
        logger_1.default.info('Email transport ready', { provider: 'smtp', host: env_1.default.SMTP_HOST, port: env_1.default.SMTP_PORT });
        return true;
    }
    catch (error) {
        const e = error;
        logger_1.default.error('Email transport verification FAILED — OTP and password-reset emails will not be delivered', {
            provider: 'smtp',
            host: env_1.default.SMTP_HOST,
            port: env_1.default.SMTP_PORT,
            code: e?.code,
            response: e?.response,
        });
        return false;
    }
};
exports.verifyEmailTransport = verifyEmailTransport;
/**
 * Pull the diagnostic fields off an SMTP failure.
 *
 * The logger's Error serializer keeps only name/message/stack/code, so nodemailer's `response`
 * — the line that actually says *why* the server refused, e.g. "535-5.7.8 Username and Password
 * not accepted" — was being dropped. It carries no user data, so it is safe to log.
 */
const smtpErrorMeta = (error) => {
    const e = error;
    return {
        provider: 'smtp',
        code: e?.code,
        command: e?.command,
        responseCode: e?.responseCode,
        response: e?.response,
    };
};
// ─── Landing site notifications (→ support inbox) ───
const escapeHtml = (v) => String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const shell = (title, accent, rows, footer) => `
  <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; background:#f6f7fb; padding:24px;">
    <div style="background:#0f1c3f; border-radius:14px 14px 0 0; padding:18px 22px;">
      <h2 style="margin:0; color:#fff; font-size:18px;">${escapeHtml(title)}</h2>
    </div>
    <div style="background:#fff; border-radius:0 0 14px 14px; padding:22px;">
      <table style="width:100%; border-collapse:collapse; font-size:14px; color:#111827;">
        ${rows
    .map(([k, v]) => `<tr>
              <td style="padding:9px 0; color:#6b7280; width:170px; vertical-align:top;">${escapeHtml(k)}</td>
              <td style="padding:9px 0; font-weight:600; color:#0f1c3f;">${escapeHtml(v) || '—'}</td>
            </tr>`)
    .join('')}
      </table>
      ${footer ? `<p style="margin:18px 0 0; padding-top:14px; border-top:1px solid #e5e7eb; color:#6b7280; font-size:13px;">${footer}</p>` : ''}
      <div style="margin-top:16px; height:3px; border-radius:2px; background:${accent};"></div>
    </div>
  </div>`;
/** Someone joined the pre-launch waitlist on the marketing site. */
const sendWaitlistSignupEmail = async (data) => {
    try {
        if (!isConfigured()) {
            // The signup itself is already persisted; only the support notification is lost.
            return notConfigured('Waitlist signup notification', { role: data.role, source: data.source });
        }
        await transporter.sendMail({
            from: `"Fixo Waitlist" <${env_1.default.SMTP_USER}>`,
            to: env_1.default.SUPPORT_EMAIL,
            replyTo: data.contact.includes('@') ? data.contact : undefined,
            subject: `New waitlist signup — ${data.contact}`,
            html: shell('🎉 New waitlist signup', '#F97316', [
                ['Contact', data.contact],
                ['Signed up as', data.role === 'worker' ? 'Wants to work with Fixo' : 'Customer'],
                ['Source', data.source],
                ['Total signups', String(data.total)],
            ], 'They will be notified when Fixo launches.'),
        });
        return true;
    }
    catch (error) {
        logger_1.default.error('Waitlist signup email failed', smtpErrorMeta(error));
        return false;
    }
};
exports.sendWaitlistSignupEmail = sendWaitlistSignupEmail;
/** Someone submitted the "Partner with Fixo" form. */
const sendPartnerRequestEmail = async (data) => {
    try {
        if (!isConfigured()) {
            // The request itself is already persisted; only the support notification is lost.
            return notConfigured('Partner request notification', {
                partnershipType: data.partnershipType,
                city: data.city,
            });
        }
        await transporter.sendMail({
            from: `"Fixo Partnerships" <${env_1.default.SMTP_USER}>`,
            to: env_1.default.SUPPORT_EMAIL,
            replyTo: data.email,
            subject: `Partner request — ${data.company} (${data.fullName})`,
            html: shell('🤝 New partnership request', '#10B981', [
                ['Name', data.fullName],
                ['Business / Company', data.company],
                ['Phone', data.phone],
                ['Email', data.email],
                ['City', data.city],
                ['Partnership type', data.partnershipType],
                ['Message', data.message],
            ], 'Reply within 3 working days — that is what the site promises.'),
        });
        return true;
    }
    catch (error) {
        logger_1.default.error('Partner request email failed', smtpErrorMeta(error));
        return false;
    }
};
exports.sendPartnerRequestEmail = sendPartnerRequestEmail;
const sendPasswordResetEmail = async (email, resetToken, role) => {
    try {
        // Use correct frontend URL based on role
        const baseUrl = role === 'worker' ? env_1.default.WORKER_CLIENT_URL : env_1.default.CLIENT_URL;
        const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
        if (!isConfigured()) {
            // Never log the reset link/token — only the masked recipient.
            return notConfigured('Password reset email', { recipientMasked: (0, mask_1.maskEmail)(email) });
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
        logger_1.default.error('Password reset email failed', {
            ...smtpErrorMeta(error),
            recipientMasked: (0, mask_1.maskEmail)(email),
        });
        return false;
    }
};
exports.sendPasswordResetEmail = sendPasswordResetEmail;
const sendAccountDeactivationOtpEmail = async (email, otp, name) => {
    try {
        if (!isConfigured()) {
            // Never log the OTP — only the masked recipient.
            return notConfigured('Deactivation OTP email', { recipientMasked: (0, mask_1.maskEmail)(email) });
        }
        await transporter.sendMail({
            from: `"Fixo" <${env_1.default.SMTP_USER}>`,
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
    }
    catch (error) {
        logger_1.default.error('Deactivation OTP email failed', {
            ...smtpErrorMeta(error),
            recipientMasked: (0, mask_1.maskEmail)(email),
        });
        return false;
    }
};
exports.sendAccountDeactivationOtpEmail = sendAccountDeactivationOtpEmail;
const sendPasswordSetupOtpEmail = async (email, otp, name) => {
    try {
        if (!isConfigured()) {
            // Never log the OTP — only the masked recipient.
            return notConfigured('Password setup OTP email', { recipientMasked: (0, mask_1.maskEmail)(email) });
        }
        await transporter.sendMail({
            from: `"Fixo" <${env_1.default.SMTP_USER}>`,
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
    }
    catch (error) {
        logger_1.default.error('Password setup OTP email failed', {
            ...smtpErrorMeta(error),
            recipientMasked: (0, mask_1.maskEmail)(email),
        });
        return false;
    }
};
exports.sendPasswordSetupOtpEmail = sendPasswordSetupOtpEmail;
//# sourceMappingURL=email.service.js.map