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
// After this many wrong guesses the OTP is invalidated and a new one must be
// requested — caps brute-force attempts per account regardless of source IP.
const MAX_OTP_ATTEMPTS = 5;
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
    const otpHash = hashOTP(String(phone), otp);
    await OtpCode_1.default.findOneAndUpdate({ phone: String(phone), purpose: OTP_PURPOSE }, {
        otpHash,
        attempts: 0, // fresh OTP resets the lockout counter
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
    }, {
        upsert: true,
        setDefaultsOnInsert: true,
        new: true,
    });
};
exports.storeOTP = storeOTP;
const verifyOTP = async (phone, otp) => {
    const record = await OtpCode_1.default.findOne({ phone: String(phone), purpose: OTP_PURPOSE });
    if (!record)
        return { ok: false, reason: 'invalid' };
    if (record.expiresAt.getTime() <= Date.now()) {
        await OtpCode_1.default.deleteOne({ _id: record._id });
        return { ok: false, reason: 'expired' };
    }
    // Already exhausted — force the user to request a new OTP.
    if (record.attempts >= MAX_OTP_ATTEMPTS) {
        await OtpCode_1.default.deleteOne({ _id: record._id });
        return { ok: false, reason: 'locked' };
    }
    const otpHash = hashOTP(String(phone), otp);
    if (record.otpHash !== otpHash) {
        // Atomically count this failed guess; invalidate once the cap is hit.
        const updated = await OtpCode_1.default.findOneAndUpdate({ _id: record._id }, { $inc: { attempts: 1 } }, { new: true });
        if (updated && updated.attempts >= MAX_OTP_ATTEMPTS) {
            await OtpCode_1.default.deleteOne({ _id: record._id });
            return { ok: false, reason: 'locked' };
        }
        return { ok: false, reason: 'invalid' };
    }
    // Correct OTP — single use.
    await OtpCode_1.default.deleteOne({ _id: record._id });
    return { ok: true };
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