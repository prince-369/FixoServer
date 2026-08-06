export type OtpVerifyResult = {
    ok: true;
} | {
    ok: false;
    reason: 'invalid' | 'expired' | 'locked';
};
export declare const generateOTP: () => string;
export declare const storeOTP: (phone: string, otp: string) => Promise<void>;
/**
 * Discard a stored OTP.
 *
 * Used when the code was generated but could not actually be delivered — leaving it behind
 * would let a stale, unusable OTP occupy the record until it expires.
 */
export declare const clearOTP: (phone: string) => Promise<void>;
export declare const verifyOTP: (phone: string, otp: string) => Promise<OtpVerifyResult>;
export declare const sendOTP: (phone: string, otp: string) => Promise<boolean>;
//# sourceMappingURL=sms.service.d.ts.map