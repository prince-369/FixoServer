"use strict";
/**
 * Masking helpers for log metadata. Produce a recipient identifier that is useful for
 * troubleshooting but never exposes the full email/phone. Never log the raw value.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.maskPhone = exports.maskEmail = void 0;
/** 'prince@example.com' → 'p*****@example.com'; invalid/empty → '[none]'. */
const maskEmail = (email) => {
    if (!email || typeof email !== 'string')
        return '[none]';
    const trimmed = email.trim();
    const at = trimmed.indexOf('@');
    if (at <= 0)
        return '[masked]';
    const local = trimmed.slice(0, at);
    const domain = trimmed.slice(at + 1);
    const head = local[0];
    return `${head}*****@${domain}`;
};
exports.maskEmail = maskEmail;
/** '9876543210' → '******3210' (last 4 kept); short/empty → '[none]'/'[masked]'. */
const maskPhone = (phone) => {
    if (!phone || typeof phone !== 'string')
        return '[none]';
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 4)
        return '[masked]';
    return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
};
exports.maskPhone = maskPhone;
//# sourceMappingURL=mask.js.map