"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendOTP = exports.verifyOTP = exports.storeOTP = exports.generateOTP = void 0;
const crypto_1 = __importDefault(require("crypto"));
const twilio_1 = __importDefault(require("twilio"));
const env_1 = __importDefault(require("../config/env"));
const OtpCode_1 = __importDefault(require("../models/OtpCode"));
const OTP_EXPIRY_MINUTES = 10;
const OTP_PURPOSE = 'password-reset';
const hashOTP = (phone, otp) => {
    return crypto_1.default
        .createHash('sha256')
        .update(`${phone}:${otp}:${env_1.default.JWT_SECRET}`)
        .digest('hex');
};
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};
exports.generateOTP = generateOTP;
const storeOTP = async (phone, otp) => {
    const otpHash = hashOTP(phone, otp);
    await OtpCode_1.default.findOneAndUpdate({ phone, purpose: OTP_PURPOSE }, {
        otpHash,
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
    }, {
        upsert: true,
        setDefaultsOnInsert: true,
        new: true,
    });
};
exports.storeOTP = storeOTP;
const verifyOTP = async (phone, otp) => {
    const otpHash = hashOTP(phone, otp);
    const stored = await OtpCode_1.default.findOneAndDelete({
        phone,
        purpose: OTP_PURPOSE,
        otpHash,
        expiresAt: { $gt: new Date() },
    });
    return Boolean(stored);
};
exports.verifyOTP = verifyOTP;
const sendOTP = async (phone, otp) => {
    if (!env_1.default.TWILIO_ACCOUNT_SID || !env_1.default.TWILIO_AUTH_TOKEN || !env_1.default.TWILIO_PHONE_NUMBER) {
        console.error('[SMS] Twilio credentials missing. OTP was not sent.');
        return false;
    }
    try {
        const client = (0, twilio_1.default)(env_1.default.TWILIO_ACCOUNT_SID, env_1.default.TWILIO_AUTH_TOKEN);
        await client.messages.create({
            body: `Your Fixo verification code is: ${otp}. Valid for ${OTP_EXPIRY_MINUTES} minutes. Do not share this code with anyone.`,
            from: env_1.default.TWILIO_PHONE_NUMBER,
            to: `+91${phone}`,
        });
        console.log(`[SMS] OTP sent successfully to ${phone}`);
        return true;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown SMS provider error';
        console.error('[SMS] Twilio Error:', message);
        return false;
    }
};
exports.sendOTP = sendOTP;
//# sourceMappingURL=sms.service.js.map