/**
 * Probe SMTP credentials at boot so a revoked app password shows up in the startup logs
 * instead of silently breaking every OTP until someone reports it.
 *
 * Deliberately non-fatal: the API must still serve traffic when only email is broken.
 */
export declare const verifyEmailTransport: () => Promise<boolean>;
/** Someone joined the pre-launch waitlist on the marketing site. */
export declare const sendWaitlistSignupEmail: (data: {
    contact: string;
    role: string;
    source: string;
    total: number;
}) => Promise<boolean>;
/** Someone submitted the "Partner with Fixo" form. */
export declare const sendPartnerRequestEmail: (data: {
    fullName: string;
    company: string;
    phone: string;
    email: string;
    city: string;
    partnershipType: string;
    message: string;
}) => Promise<boolean>;
export declare const sendPasswordResetEmail: (email: string, resetToken: string, role?: string) => Promise<boolean>;
export declare const sendAccountDeactivationOtpEmail: (email: string, otp: string, name?: string) => Promise<boolean>;
export declare const sendPasswordSetupOtpEmail: (email: string, otp: string, name?: string) => Promise<boolean>;
//# sourceMappingURL=email.service.d.ts.map