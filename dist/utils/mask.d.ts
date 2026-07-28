/**
 * Masking helpers for log metadata. Produce a recipient identifier that is useful for
 * troubleshooting but never exposes the full email/phone. Never log the raw value.
 */
/** 'prince@example.com' → 'p*****@example.com'; invalid/empty → '[none]'. */
export declare const maskEmail: (email?: string | null) => string;
/** '9876543210' → '******3210' (last 4 kept); short/empty → '[none]'/'[masked]'. */
export declare const maskPhone: (phone?: string | null) => string;
//# sourceMappingURL=mask.d.ts.map