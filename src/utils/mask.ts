/**
 * Masking helpers for log metadata. Produce a recipient identifier that is useful for
 * troubleshooting but never exposes the full email/phone. Never log the raw value.
 */

/** 'prince@example.com' → 'p*****@example.com'; invalid/empty → '[none]'. */
export const maskEmail = (email?: string | null): string => {
  if (!email || typeof email !== 'string') return '[none]';
  const trimmed = email.trim();
  const at = trimmed.indexOf('@');
  if (at <= 0) return '[masked]';
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const head = local[0];
  return `${head}*****@${domain}`;
};

/** '9876543210' → '******3210' (last 4 kept); short/empty → '[none]'/'[masked]'. */
export const maskPhone = (phone?: string | null): string => {
  if (!phone || typeof phone !== 'string') return '[none]';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '[masked]';
  return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
};
