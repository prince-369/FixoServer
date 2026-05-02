export declare const generateOTP: () => string;
export declare const storeOTP: (phone: string, otp: string) => Promise<void>;
export declare const verifyOTP: (phone: string, otp: string) => Promise<boolean>;
export declare const sendOTP: (phone: string, otp: string) => Promise<boolean>;
//# sourceMappingURL=sms.service.d.ts.map