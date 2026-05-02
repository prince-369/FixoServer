"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.refresh = exports.getMe = exports.resetPassword = exports.verifyOTPHandler = exports.forgotPassword = exports.loginAdmin = exports.loginWorker = exports.registerWorker = exports.loginCustomer = exports.completeGoogleRegistration = exports.googleAuthCustomer = exports.registerCustomer = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const axios_1 = __importDefault(require("axios"));
const User_1 = __importDefault(require("../models/User"));
const Worker_1 = __importDefault(require("../models/Worker"));
const Admin_1 = __importDefault(require("../models/Admin"));
const RefreshToken_1 = __importDefault(require("../models/RefreshToken"));
const PasswordResetToken_1 = __importDefault(require("../models/PasswordResetToken"));
const generateToken_1 = require("../utils/generateToken");
const sms_service_1 = require("../services/sms.service");
const email_service_1 = require("../services/email.service");
const cloudinary_service_1 = require("../services/cloudinary.service");
const REFRESH_TOKEN_DAYS = 7;
const EMAIL_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const OTP_RESET_TOKEN_TTL_MS = 10 * 60 * 1000;
// Strong password regex: min 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special char
const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
const validateStrongPassword = (password) => {
    if (password.length < 8)
        return 'Password must be at least 8 characters';
    if (!/[a-z]/.test(password))
        return 'Password must include a lowercase letter';
    if (!/[A-Z]/.test(password))
        return 'Password must include an uppercase letter';
    if (!/\d/.test(password))
        return 'Password must include a number';
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password))
        return 'Password must include a special character';
    return null;
};
const hashResetToken = (token) => {
    return crypto_1.default.createHash('sha256').update(token).digest('hex');
};
const createResetToken = async (userId, role, ttlMs) => {
    const rawToken = crypto_1.default.randomBytes(32).toString('hex');
    const tokenHash = hashResetToken(rawToken);
    await PasswordResetToken_1.default.deleteMany({ userId, role });
    await PasswordResetToken_1.default.create({
        userId,
        role,
        tokenHash,
        expiresAt: new Date(Date.now() + ttlMs),
    });
    return { rawToken, tokenHash };
};
const consumeResetToken = async (rawToken) => {
    const tokenHash = hashResetToken(rawToken);
    const tokenDoc = await PasswordResetToken_1.default.findOneAndDelete({
        tokenHash,
        expiresAt: { $gt: new Date() },
    });
    if (!tokenDoc)
        return null;
    return { id: tokenDoc.userId.toString(), role: tokenDoc.role };
};
const sendEmailResetLink = async (email, userId, role) => {
    const { rawToken, tokenHash } = await createResetToken(userId, role, EMAIL_RESET_TOKEN_TTL_MS);
    const sent = await (0, email_service_1.sendPasswordResetEmail)(email, rawToken);
    if (!sent) {
        await PasswordResetToken_1.default.deleteOne({ tokenHash });
        return false;
    }
    return true;
};
// ─── Helper: Set auth tokens & cookie ───
const issueTokens = async (res, userId, role) => {
    const accessToken = (0, generateToken_1.generateAccessToken)({ id: userId, role });
    const refreshToken = (0, generateToken_1.generateRefreshTokenString)();
    // Store refresh token in DB
    await RefreshToken_1.default.create({
        userId,
        role,
        token: refreshToken,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000),
    });
    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
        path: '/',
    });
    return accessToken;
};
// ─── Customer Registration ───
const registerCustomer = async (req, res) => {
    try {
        const { fullName, email, phone, password } = req.body;
        // Validate strong password
        const pwdError = validateStrongPassword(password);
        if (pwdError) {
            res.status(400).json({ message: pwdError });
            return;
        }
        const existingUser = await User_1.default.findOne({ $or: [{ email }, { phone }] });
        if (existingUser) {
            res.status(400).json({ message: 'Email or phone number already registered' });
            return;
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 12);
        const user = await User_1.default.create({
            fullName,
            email,
            phone,
            password: hashedPassword,
        });
        const accessToken = await issueTokens(res, user._id.toString(), 'customer');
        res.status(201).json({
            message: 'Registration successful',
            accessToken,
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                phone: user.phone,
                profileImage: user.profileImage,
            },
        });
    }
    catch (error) {
        console.error('Register customer error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.registerCustomer = registerCustomer;
// ─── Customer Google OAuth ───
const googleAuthCustomer = async (req, res) => {
    try {
        const { credential } = req.body;
        // Verify Google token
        const googleRes = await axios_1.default.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
        const { email, name, sub: googleId, picture } = googleRes.data;
        let user = await User_1.default.findOne({ $or: [{ googleId }, { email }] });
        if (user) {
            if (!user.googleId) {
                user.googleId = googleId;
                await user.save();
            }
        }
        else {
            // Need phone number — send back a flag
            res.status(200).json({
                needsPhone: true,
                googleData: { email, fullName: name, googleId, profileImage: picture },
            });
            return;
        }
        const accessToken = await issueTokens(res, user._id.toString(), 'customer');
        res.json({
            message: 'Login successful',
            accessToken,
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                phone: user.phone,
                profileImage: user.profileImage,
            },
        });
    }
    catch (error) {
        console.error('Google auth error:', error);
        res.status(500).json({ message: 'Google authentication failed' });
    }
};
exports.googleAuthCustomer = googleAuthCustomer;
// Complete Google registration (after getting phone number)
const completeGoogleRegistration = async (req, res) => {
    try {
        const { email, fullName, googleId, profileImage, phone } = req.body;
        const existingPhone = await User_1.default.findOne({ phone });
        if (existingPhone) {
            res.status(400).json({ message: 'Phone number already registered' });
            return;
        }
        const user = await User_1.default.create({
            fullName,
            email,
            phone,
            googleId,
            profileImage,
        });
        const accessToken = await issueTokens(res, user._id.toString(), 'customer');
        res.status(201).json({
            message: 'Registration successful',
            accessToken,
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                phone: user.phone,
                profileImage: user.profileImage,
            },
        });
    }
    catch (error) {
        console.error('Complete Google registration error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.completeGoogleRegistration = completeGoogleRegistration;
// ─── Customer Login ───
const loginCustomer = async (req, res) => {
    try {
        const { identifier, password } = req.body;
        const isEmail = identifier.includes('@');
        const query = isEmail ? { email: identifier } : { phone: identifier };
        const user = await User_1.default.findOne(query).select('+password');
        if (!user) {
            res.status(401).json({ message: 'Invalid credentials' });
            return;
        }
        if (!user.password) {
            res.status(401).json({ message: 'Please login with Google' });
            return;
        }
        const isMatch = await bcryptjs_1.default.compare(password, user.password);
        if (!isMatch) {
            res.status(401).json({ message: 'Invalid credentials' });
            return;
        }
        const accessToken = await issueTokens(res, user._id.toString(), 'customer');
        res.json({
            message: 'Login successful',
            accessToken,
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                phone: user.phone,
                profileImage: user.profileImage,
            },
        });
    }
    catch (error) {
        console.error('Login customer error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.loginCustomer = loginCustomer;
// ─── Worker Registration ───
const registerWorker = async (req, res) => {
    try {
        const { fullName, phone, email, password } = req.body;
        const files = req.files;
        if (!files?.aadhaarFront?.[0] || !files?.aadhaarBack?.[0]) {
            res.status(400).json({ message: 'Aadhaar card front and back photos are required' });
            return;
        }
        // Validate strong password
        const pwdError = validateStrongPassword(password);
        if (pwdError) {
            res.status(400).json({ message: pwdError });
            return;
        }
        const existingWorker = await Worker_1.default.findOne({ phone });
        if (existingWorker) {
            res.status(400).json({ message: 'Phone number already registered' });
            return;
        }
        // Upload Aadhaar images to Cloudinary
        const [frontUpload, backUpload] = await Promise.all([
            (0, cloudinary_service_1.uploadBufferToCloudinary)(files.aadhaarFront[0].buffer, 'aadhaar'),
            (0, cloudinary_service_1.uploadBufferToCloudinary)(files.aadhaarBack[0].buffer, 'aadhaar'),
        ]);
        const hashedPassword = await bcryptjs_1.default.hash(password, 12);
        const worker = await Worker_1.default.create({
            fullName,
            phone,
            email: email || undefined,
            password: hashedPassword,
            aadhaarFront: frontUpload.url,
            aadhaarBack: backUpload.url,
            accountStatus: 'test',
        });
        const accessToken = await issueTokens(res, worker._id.toString(), 'worker');
        res.status(201).json({
            message: 'Registration successful. Complete your profile to start working.',
            accessToken,
            worker: {
                id: worker._id,
                fullName: worker.fullName,
                phone: worker.phone,
                accountStatus: worker.accountStatus,
                profileCompleted: worker.profileCompleted,
            },
        });
    }
    catch (error) {
        console.error('Register worker error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.registerWorker = registerWorker;
// ─── Worker Login ───
const loginWorker = async (req, res) => {
    try {
        const { phone, password } = req.body;
        const worker = await Worker_1.default.findOne({ phone }).select('+password');
        if (!worker) {
            res.status(401).json({ message: 'Invalid credentials' });
            return;
        }
        const isMatch = await bcryptjs_1.default.compare(password, worker.password);
        if (!isMatch) {
            res.status(401).json({ message: 'Invalid credentials' });
            return;
        }
        const accessToken = await issueTokens(res, worker._id.toString(), 'worker');
        res.json({
            message: 'Login successful',
            accessToken,
            worker: {
                id: worker._id,
                fullName: worker.fullName,
                phone: worker.phone,
                accountStatus: worker.accountStatus,
                profileCompleted: worker.profileCompleted,
                isActive: worker.isActive,
                balance: worker.balance,
            },
        });
    }
    catch (error) {
        console.error('Login worker error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.loginWorker = loginWorker;
// ─── Admin Login ───
const loginAdmin = async (req, res) => {
    try {
        const { email, password } = req.body;
        const admin = await Admin_1.default.findOne({ email }).select('+password');
        if (!admin) {
            res.status(401).json({ message: 'Invalid credentials' });
            return;
        }
        const isMatch = await bcryptjs_1.default.compare(password, admin.password);
        if (!isMatch) {
            res.status(401).json({ message: 'Invalid credentials' });
            return;
        }
        const accessToken = await issueTokens(res, admin._id.toString(), 'admin');
        res.json({
            message: 'Login successful',
            accessToken,
            admin: { id: admin._id, email: admin.email, role: admin.role },
        });
    }
    catch (error) {
        console.error('Login admin error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.loginAdmin = loginAdmin;
// ─── Forgot Password ───
const forgotPassword = async (req, res) => {
    try {
        const { identifier, role } = req.body;
        const isEmail = identifier.includes('@');
        if (role === 'customer') {
            const query = isEmail ? { email: identifier } : { phone: identifier };
            const user = await User_1.default.findOne(query);
            if (!user) {
                res.status(404).json({ message: 'Account not found' });
                return;
            }
            if (isEmail) {
                const sent = await sendEmailResetLink(identifier, user._id.toString(), 'customer');
                if (!sent) {
                    res.status(503).json({ message: 'Unable to send reset email right now. Please try again.' });
                    return;
                }
                res.json({ message: 'Password reset link sent to your email', method: 'email' });
            }
            else {
                const otp = (0, sms_service_1.generateOTP)();
                const sent = await (0, sms_service_1.sendOTP)(identifier, otp);
                if (!sent) {
                    res.status(503).json({ message: 'Unable to send OTP right now. Please try email reset.' });
                    return;
                }
                await (0, sms_service_1.storeOTP)(identifier, otp);
                res.json({ message: 'OTP sent to your phone number', method: 'phone' });
            }
        }
        else if (role === 'worker') {
            const worker = await Worker_1.default.findOne({ phone: identifier });
            if (!worker) {
                // Try email if worker has one
                if (isEmail) {
                    const workerByEmail = await Worker_1.default.findOne({ email: identifier });
                    if (!workerByEmail) {
                        res.status(404).json({ message: 'Account not found' });
                        return;
                    }
                    const sent = await sendEmailResetLink(identifier, workerByEmail._id.toString(), 'worker');
                    if (!sent) {
                        res.status(503).json({ message: 'Unable to send reset email right now. Please try again.' });
                        return;
                    }
                    res.json({ message: 'Password reset link sent to your email', method: 'email' });
                    return;
                }
                res.status(404).json({ message: 'Account not found' });
                return;
            }
            if (isEmail && worker.email) {
                const sent = await sendEmailResetLink(worker.email, worker._id.toString(), 'worker');
                if (!sent) {
                    res.status(503).json({ message: 'Unable to send reset email right now. Please try again.' });
                    return;
                }
                res.json({ message: 'Password reset link sent to your email', method: 'email' });
            }
            else {
                const otp = (0, sms_service_1.generateOTP)();
                const sent = await (0, sms_service_1.sendOTP)(identifier, otp);
                if (!sent) {
                    res.status(503).json({ message: 'Unable to send OTP right now. Please try email reset.' });
                    return;
                }
                await (0, sms_service_1.storeOTP)(identifier, otp);
                res.json({ message: 'OTP sent to your phone number', method: 'phone' });
            }
        }
    }
    catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.forgotPassword = forgotPassword;
// ─── Verify OTP ───
const verifyOTPHandler = async (req, res) => {
    try {
        const { phone, otp } = req.body;
        const isValid = await (0, sms_service_1.verifyOTP)(phone, otp);
        if (!isValid) {
            res.status(400).json({ message: 'Invalid or expired OTP' });
            return;
        }
        const customer = await User_1.default.findOne({ phone });
        const worker = customer ? null : await Worker_1.default.findOne({ phone });
        const account = customer || worker;
        if (!account) {
            res.status(404).json({ message: 'Account not found' });
            return;
        }
        const role = customer ? 'customer' : 'worker';
        const { rawToken } = await createResetToken(account._id.toString(), role, OTP_RESET_TOKEN_TTL_MS);
        res.json({ message: 'OTP verified', resetToken: rawToken });
    }
    catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.verifyOTPHandler = verifyOTPHandler;
// ─── Reset Password ───
const resetPassword = async (req, res) => {
    try {
        const { token, password } = req.body;
        const tokenData = await consumeResetToken(token);
        if (!tokenData) {
            res.status(400).json({ message: 'Invalid or expired reset token' });
            return;
        }
        // Validate strong password
        const pwdError = validateStrongPassword(password);
        if (pwdError) {
            res.status(400).json({ message: pwdError });
            return;
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 12);
        if (tokenData.role === 'customer') {
            await User_1.default.findByIdAndUpdate(tokenData.id, { password: hashedPassword });
        }
        else {
            await Worker_1.default.findByIdAndUpdate(tokenData.id, { password: hashedPassword });
        }
        res.json({ message: 'Password reset successful' });
    }
    catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.resetPassword = resetPassword;
// ─── Get Current User ───
const getMe = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Not authorized' });
            return;
        }
        switch (req.user.role) {
            case 'customer': {
                const user = await User_1.default.findById(req.user.id);
                res.json({ role: 'customer', user });
                break;
            }
            case 'worker': {
                const worker = await Worker_1.default.findById(req.user.id).populate('categories');
                res.json({ role: 'worker', worker });
                break;
            }
            case 'admin': {
                const admin = await Admin_1.default.findById(req.user.id);
                res.json({ role: 'admin', admin });
                break;
            }
        }
    }
    catch (error) {
        console.error('Get me error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getMe = getMe;
// ─── Refresh Token ───
const refresh = async (req, res) => {
    try {
        const token = req.cookies?.refreshToken;
        if (!token) {
            res.status(401).json({ message: 'No refresh token' });
            return;
        }
        const stored = await RefreshToken_1.default.findOne({ token });
        if (!stored || stored.expiresAt < new Date()) {
            if (stored)
                await stored.deleteOne();
            res.clearCookie('refreshToken', { path: '/' });
            res.status(401).json({ message: 'Invalid or expired refresh token' });
            return;
        }
        const accessToken = (0, generateToken_1.generateAccessToken)({ id: stored.userId.toString(), role: stored.role });
        res.json({ accessToken, role: stored.role });
    }
    catch (error) {
        console.error('Refresh token error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.refresh = refresh;
// ─── Logout ───
const logout = async (req, res) => {
    try {
        const token = req.cookies?.refreshToken;
        if (token) {
            await RefreshToken_1.default.deleteOne({ token });
        }
        res.clearCookie('refreshToken', { path: '/' });
        res.json({ message: 'Logged out' });
    }
    catch (error) {
        console.error('Logout error:', error);
        res.clearCookie('refreshToken', { path: '/' });
        res.json({ message: 'Logged out' });
    }
};
exports.logout = logout;
//# sourceMappingURL=auth.controller.js.map