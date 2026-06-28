import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import axios from 'axios';
import User from '../models/User';
import Worker from '../models/Worker';
import Admin from '../models/Admin';
import { effectivePermissions, isSuperAdminEmail } from '../config/adminPermissions';
import { blockPayload, clearExpiredBlock } from '../utils/userBlock';
import { parseSkillsInput } from '../utils/workerSkills';
import RefreshToken from '../models/RefreshToken';
import PasswordResetToken from '../models/PasswordResetToken';
import { generateAccessToken, generateRefreshTokenString } from '../utils/generateToken';
import { generateOTP, storeOTP, verifyOTP, sendOTP } from '../services/sms.service';
import { sendPasswordResetEmail } from '../services/email.service';
import { uploadBufferToCloudinary } from '../services/cloudinary.service';
import env from '../config/env';

const REFRESH_TOKEN_DAYS = 365;
const EMAIL_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const OTP_RESET_TOKEN_TTL_MS = 10 * 60 * 1000;
const REFRESH_COOKIE_MAX_AGE_MS = REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
// Only set secure cookies when clients are actually on HTTPS (not localhost dev)
const CLIENT_IS_HTTPS = (env.CLIENT_URL || '').startsWith('https://');

const refreshCookieOptions = {
  httpOnly: true,
  secure: IS_PRODUCTION && CLIENT_IS_HTTPS,
  sameSite: (IS_PRODUCTION && CLIENT_IS_HTTPS) ? 'none' as const : 'lax' as const,
  maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  path: '/',
};

const refreshCookieClearOptions = {
  httpOnly: true,
  secure: IS_PRODUCTION && CLIENT_IS_HTTPS,
  sameSite: (IS_PRODUCTION && CLIENT_IS_HTTPS) ? 'none' as const : 'lax' as const,
  path: '/',
};

type PasswordResetRole = 'customer' | 'worker';

// Strong password regex: min 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special char
const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

const validateStrongPassword = (password: string): string | null => {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[a-z]/.test(password)) return 'Password must include a lowercase letter';
  if (!/[A-Z]/.test(password)) return 'Password must include an uppercase letter';
  if (!/\d/.test(password)) return 'Password must include a number';
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return 'Password must include a special character';
  return null;
};

interface GoogleTokenInfoResponse {
  aud?: string;
  azp?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  picture?: string;
  sub?: string;
}

class GoogleAudienceMismatchError extends Error {
  public readonly audience?: string;
  public readonly authorizedParty?: string;
  public readonly allowedClientIds: string[];

  constructor(audience: string | undefined, authorizedParty: string | undefined, allowedClientIds: string[]) {
    super('Google token audience mismatch');
    this.name = 'GoogleAudienceMismatchError';
    this.audience = audience;
    this.authorizedParty = authorizedParty;
    this.allowedClientIds = allowedClientIds;
  }
}

const normalizeGoogleClientId = (value: string): string => value.trim();

const getGoogleProjectNumber = (clientId: string): string => {
  const [projectNumber] = clientId.split('-');
  return projectNumber || '';
};

const isAllowedGoogleAudience = (
  audience: string | undefined,
  authorizedParty: string | undefined,
  allowedClientIds: string[]
): boolean => {
  if (!allowedClientIds.length) return true;

  const candidates = [audience, authorizedParty]
    .filter((value): value is string => Boolean(value && value.trim()))
    .map(normalizeGoogleClientId);

  if (!candidates.length) return false;

  const allowedSet = new Set(allowedClientIds.map(normalizeGoogleClientId));
  if (candidates.some((candidate) => allowedSet.has(candidate))) {
    return true;
  }

  // Fallback for multi-client setups inside the same Google project.
  const allowedProjectNumbers = new Set(
    allowedClientIds
      .map(normalizeGoogleClientId)
      .map(getGoogleProjectNumber)
      .filter(Boolean)
  );

  return candidates.some((candidate) => allowedProjectNumbers.has(getGoogleProjectNumber(candidate)));
};

const handleGoogleErrorResponse = (
  res: Response,
  error: unknown,
  fallback500Message: string
): void => {
  if (error instanceof GoogleAudienceMismatchError) {
    console.error('Google audience mismatch', {
      audience: error.audience,
      authorizedParty: error.authorizedParty,
      allowedClientIds: error.allowedClientIds,
    });
    res.status(401).json({
      message: 'Google authentication failed. OAuth client ID mismatch.',
      details: {
        tokenAud: error.audience || null,
        tokenAzp: error.authorizedParty || null,
        allowedClientIds: error.allowedClientIds,
      },
    });
    return;
  }

  const message = error instanceof Error ? error.message : '';
  if (message.includes('Google token') || message.includes('Invalid Google')) {
    res.status(401).json({ message: 'Google authentication failed' });
    return;
  }

  res.status(500).json({ message: fallback500Message });
};

const resolveGoogleIdentity = async (credential: string): Promise<{
  email: string;
  fullName: string;
  googleId: string;
  profileImage: string;
}> => {
  const googleRes = await axios.get<GoogleTokenInfoResponse>(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
  );

  const { aud, azp, email, email_verified, name, picture, sub } = googleRes.data;
  const isEmailVerified = email_verified === true || email_verified === 'true';

  const allowedClientIds = env.GOOGLE_CLIENT_IDS;

  if (!isAllowedGoogleAudience(aud, azp, allowedClientIds)) {
    throw new GoogleAudienceMismatchError(aud, azp, allowedClientIds);
  }

  if (!isEmailVerified || !email || !name || !sub) {
    throw new Error('Invalid Google token payload');
  }

  return {
    email: email.trim().toLowerCase(),
    fullName: name.trim(),
    googleId: sub.trim(),
    profileImage: (picture || '').trim(),
  };
};

const hashResetToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const createResetToken = async (
  userId: string,
  role: PasswordResetRole,
  ttlMs: number
): Promise<{ rawToken: string; tokenHash: string }> => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashResetToken(rawToken);

  await PasswordResetToken.deleteMany({ userId, role });
  await PasswordResetToken.create({
    userId,
    role,
    tokenHash,
    expiresAt: new Date(Date.now() + ttlMs),
  });

  return { rawToken, tokenHash };
};

const consumeResetToken = async (
  rawToken: string
): Promise<{ id: string; role: PasswordResetRole } | null> => {
  const tokenHash = hashResetToken(rawToken);

  const tokenDoc = await PasswordResetToken.findOneAndDelete({
    tokenHash,
    expiresAt: { $gt: new Date() },
  });

  if (!tokenDoc) return null;
  return { id: tokenDoc.userId.toString(), role: tokenDoc.role };
};

const sendEmailResetLink = async (
  email: string,
  userId: string,
  role: PasswordResetRole
): Promise<boolean> => {
  const { rawToken, tokenHash } = await createResetToken(userId, role, EMAIL_RESET_TOKEN_TTL_MS);
  const sent = await sendPasswordResetEmail(email, rawToken);

  if (!sent) {
    await PasswordResetToken.deleteOne({ tokenHash });
    return false;
  }

  return true;
};

// ─── Helper: Set auth tokens & cookie ───
const issueTokens = async (res: Response, userId: string, role: 'customer' | 'worker' | 'admin') => {
  const accessToken = generateAccessToken({ id: userId, role });
  const refreshToken = generateRefreshTokenString();

  // Store refresh token in DB
  await RefreshToken.create({
    userId,
    role,
    token: refreshToken,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000),
  });

  // For Vercel client + Render server cross-site auth, production cookie must be SameSite=None; Secure.
  res.cookie('refreshToken', refreshToken, refreshCookieOptions);

  return accessToken;
};

const toWorkerAuthPayload = (worker: {
  _id: unknown;
  fullName: string;
  phone: string;
  email?: string;
  accountStatus: string;
  profileCompleted: boolean;
  isActive: boolean;
  balance: number;
  profileImage?: string;
  videoKycIncompleteReason?: string;
  videoKycRetryAvailableAt?: Date | null;
}) => ({
  id: worker._id,
  fullName: worker.fullName,
  phone: worker.phone,
  email: worker.email,
  profileImage: worker.profileImage,
  accountStatus: worker.accountStatus,
  videoKycIncompleteReason: worker.videoKycIncompleteReason,
  videoKycRetryAvailableAt: worker.videoKycRetryAvailableAt,
  profileCompleted: worker.profileCompleted,
  isActive: worker.isActive,
  balance: worker.balance,
});

const generateGooglePlaceholderPassword = (): string => {
  const randomChunk = crypto.randomBytes(18).toString('base64url');
  return `Gg1!${randomChunk}`;
};

// ─── Customer Registration ───
export const registerCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fullName, email, phone, password } = req.body;

    // Validate strong password
    const pwdError = validateStrongPassword(password);
    if (pwdError) {
      res.status(400).json({ message: pwdError });
      return;
    }

    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      res.status(400).json({ message: 'Email or phone number already registered' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
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
  } catch (error) {
    console.error('Register customer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Customer Google OAuth ───
export const googleAuthCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { credential } = req.body;
    if (!credential || typeof credential !== 'string') {
      res.status(400).json({ message: 'Google credential is required' });
      return;
    }

    const { email, fullName, googleId, profileImage } = await resolveGoogleIdentity(credential);

    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (user) {
      if (user.isActive === false) {
        res.status(403).json({ message: 'This account is deactivated. Please register again.' });
        return;
      }

      if (!user.googleId) {
        user.googleId = googleId;
        await user.save();
      }
    } else {
      // Need phone number — send back a flag
      res.status(200).json({
        needsPhone: true,
        googleData: { email, fullName, googleId, profileImage },
        email,
        fullName,
        googleId,
        profileImage,
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
  } catch (error) {
    console.error('Google auth error:', error);
    handleGoogleErrorResponse(res, error, 'Google authentication failed');
  }
};

// Complete Google registration (after getting phone number)
export const completeGoogleRegistration = async (req: Request, res: Response): Promise<void> => {
  try {
    const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
    if (!phone) {
      res.status(400).json({ message: 'Phone number is required' });
      return;
    }

    let email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    let fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '';
    let googleId = typeof req.body?.googleId === 'string' ? req.body.googleId.trim() : '';
    let profileImage = typeof req.body?.profileImage === 'string' ? req.body.profileImage.trim() : '';

    const credential = typeof req.body?.credential === 'string' ? req.body.credential.trim() : '';
    if ((!email || !fullName || !googleId) && credential) {
      const identity = await resolveGoogleIdentity(credential);
      email = identity.email;
      fullName = identity.fullName;
      googleId = identity.googleId;
      profileImage = identity.profileImage;
    }

    if (!email || !fullName || !googleId) {
      res.status(400).json({ message: 'Google profile data is incomplete' });
      return;
    }

    const existingPhone = await User.findOne({ phone });
    if (existingPhone) {
      res.status(400).json({ message: 'Phone number already registered' });
      return;
    }

    const existingByGoogle = await User.findOne({ $or: [{ googleId }, { email }] });
    if (existingByGoogle) {
      if (existingByGoogle.isActive === false) {
        res.status(403).json({ message: 'This account is deactivated. Please register again.' });
        return;
      }

      if (existingByGoogle.phone && existingByGoogle.phone !== phone) {
        res.status(400).json({ message: 'Google account is already linked to another phone number' });
        return;
      }

      existingByGoogle.googleId = existingByGoogle.googleId || googleId;
      existingByGoogle.phone = existingByGoogle.phone || phone;
      existingByGoogle.profileImage = existingByGoogle.profileImage || profileImage;
      await existingByGoogle.save();

      const accessToken = await issueTokens(res, existingByGoogle._id.toString(), 'customer');
      res.json({
        message: 'Login successful',
        accessToken,
        user: {
          id: existingByGoogle._id,
          fullName: existingByGoogle.fullName,
          email: existingByGoogle.email,
          phone: existingByGoogle.phone,
          profileImage: existingByGoogle.profileImage,
        },
      });
      return;
    }

    const user = await User.create({
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
  } catch (error) {
    console.error('Complete Google registration error:', error);
    handleGoogleErrorResponse(res, error, 'Server error');
  }
};

// ─── Customer Login ───
export const loginCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { identifier, password } = req.body;

    const isEmail = identifier.includes('@');
    const query = isEmail ? { email: identifier } : { phone: identifier };

    const user = await User.findOne(query).select('+password');
    if (!user) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    if (user.isActive === false) {
      res.status(403).json({ message: 'This account is deactivated. Please register again.' });
      return;
    }

    if (!user.password) {
      // Google OAuth account — offer to set a password
      res.status(403).json({
        needsPassword: true,
        message: 'This account was created with Google. Would you like to set a password for email/phone login?',
        email: user.email ? user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : '',
        userId: user._id,
      });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
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
  } catch (error) {
    console.error('Login customer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Worker Google OAuth ───
export const googleAuthWorker = async (req: Request, res: Response): Promise<void> => {
  try {
    const { credential } = req.body;
    if (!credential || typeof credential !== 'string') {
      res.status(400).json({ message: 'Google credential is required' });
      return;
    }

    const { email, fullName, googleId, profileImage } = await resolveGoogleIdentity(credential);

    const worker = await Worker.findOne({ $or: [{ googleId }, { email }] });

    if (!worker) {
      res.status(200).json({
        needsPhone: true,
        googleData: { email, fullName, googleId, profileImage },
        email,
        fullName,
        googleId,
        profileImage,
      });
      return;
    }

    if (!worker.googleId) {
      worker.googleId = googleId;
    }
    if (!worker.profileImage && profileImage) {
      worker.profileImage = profileImage;
    }
    await worker.save();

    const accessToken = await issueTokens(res, worker._id.toString(), 'worker');

    res.json({
      message: 'Login successful',
      accessToken,
      worker: toWorkerAuthPayload(worker),
    });
  } catch (error) {
    console.error('Worker Google auth error:', error);
    handleGoogleErrorResponse(res, error, 'Google authentication failed');
  }
};

// ─── Worker Google Registration ───
export const registerWorkerWithGoogle = async (req: Request, res: Response): Promise<void> => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (!files?.aadhaarFront?.[0] || !files?.aadhaarBack?.[0]) {
      res.status(400).json({ message: 'Aadhaar card front and back photos are required' });
      return;
    }

    const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
    if (!/^[6-9]\d{9}$/.test(phone)) {
      res.status(400).json({ message: 'Valid 10-digit Indian phone number required' });
      return;
    }

    let email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    let fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '';
    let googleId = typeof req.body?.googleId === 'string' ? req.body.googleId.trim() : '';
    let profileImage = typeof req.body?.profileImage === 'string' ? req.body.profileImage.trim() : '';

    const credential = typeof req.body?.credential === 'string' ? req.body.credential.trim() : '';
    if ((!email || !fullName || !googleId) && credential) {
      const identity = await resolveGoogleIdentity(credential);
      email = identity.email;
      fullName = identity.fullName;
      googleId = identity.googleId;
      profileImage = identity.profileImage;
    }

    if (!email || !fullName || !googleId) {
      res.status(400).json({ message: 'Google profile data is incomplete' });
      return;
    }

    const workerByPhone = await Worker.findOne({ phone });
    const workerByGoogleOrEmail = await Worker.findOne({ $or: [{ googleId }, { email }] });

    if (
      workerByPhone &&
      workerByGoogleOrEmail &&
      workerByPhone._id.toString() !== workerByGoogleOrEmail._id.toString()
    ) {
      res.status(400).json({ message: 'Phone number is already linked to another account' });
      return;
    }

    const existingWorker = workerByPhone || workerByGoogleOrEmail;

    if (existingWorker?.phone && existingWorker.phone !== phone) {
      res.status(400).json({ message: 'Google account is already linked to another phone number' });
      return;
    }

    const [frontUpload, backUpload] = await Promise.all([
      uploadBufferToCloudinary(files.aadhaarFront[0].buffer, 'aadhaar'),
      uploadBufferToCloudinary(files.aadhaarBack[0].buffer, 'aadhaar'),
    ]);

    if (existingWorker) {
      existingWorker.fullName = existingWorker.fullName || fullName;
      existingWorker.email = existingWorker.email || email;
      existingWorker.googleId = existingWorker.googleId || googleId;
      existingWorker.profileImage = existingWorker.profileImage || profileImage;
      existingWorker.aadhaarFront = existingWorker.aadhaarFront || frontUpload.url;
      existingWorker.aadhaarBack = existingWorker.aadhaarBack || backUpload.url;

      if (!existingWorker.password) {
        existingWorker.password = await bcrypt.hash(generateGooglePlaceholderPassword(), 12);
      }

      await existingWorker.save();

      const accessToken = await issueTokens(res, existingWorker._id.toString(), 'worker');
      res.json({
        message: 'Login successful',
        accessToken,
        worker: toWorkerAuthPayload(existingWorker),
      });
      return;
    }

    const generatedPasswordHash = await bcrypt.hash(generateGooglePlaceholderPassword(), 12);

    const gSkillsInput = parseSkillsInput(req.body?.skills);
    if (!gSkillsInput.some((s) => s.confirmed)) {
      res.status(400).json({ message: 'Select at least one skill you can do and confirm it.' });
      return;
    }
    const gSkills = gSkillsInput.map((s) => ({
      category: s.categoryId, experienceYears: s.experienceYears, confirmed: s.confirmed,
      status: 'pending_kyc' as const, experienceBumpsUsed: 0, callAttempts: 0, requestedAt: new Date(),
    }));

    const worker = await Worker.create({
      fullName,
      phone,
      email,
      googleId,
      profileImage,
      password: generatedPasswordHash,
      aadhaarFront: frontUpload.url,
      aadhaarBack: backUpload.url,
      accountStatus: 'test',
      skills: gSkills,
    });

    const accessToken = await issueTokens(res, worker._id.toString(), 'worker');

    res.status(201).json({
      message: 'Registration successful. Complete your profile to start working.',
      accessToken,
      worker: toWorkerAuthPayload(worker),
    });
  } catch (error) {
    console.error('Register worker with Google error:', error);
    handleGoogleErrorResponse(res, error, 'Server error');
  }
};

// ─── Worker Registration ───
export const registerWorker = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fullName, phone, email, password } = req.body;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

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

    const existingWorker = await Worker.findOne({ phone });
    if (existingWorker) {
      res.status(400).json({ message: 'Phone number already registered' });
      return;
    }

    // Skills chosen at registration (each with experience + confirmation).
    const skillsInput = parseSkillsInput(req.body?.skills);
    if (!skillsInput.some((s) => s.confirmed)) {
      res.status(400).json({ message: 'Select at least one skill you can do and confirm it.' });
      return;
    }
    const skills = skillsInput.map((s) => ({
      category: s.categoryId,
      experienceYears: s.experienceYears,
      confirmed: s.confirmed,
      status: 'pending_kyc' as const,
      experienceBumpsUsed: 0,
      callAttempts: 0,
      requestedAt: new Date(),
    }));

    // Upload Aadhaar images to Cloudinary
    const [frontUpload, backUpload] = await Promise.all([
      uploadBufferToCloudinary(files.aadhaarFront[0].buffer, 'aadhaar'),
      uploadBufferToCloudinary(files.aadhaarBack[0].buffer, 'aadhaar'),
    ]);

    const hashedPassword = await bcrypt.hash(password, 12);

    const worker = await Worker.create({
      fullName,
      phone,
      email: email || undefined,
      password: hashedPassword,
      aadhaarFront: frontUpload.url,
      aadhaarBack: backUpload.url,
      accountStatus: 'test',
      skills,
    });

    const accessToken = await issueTokens(res, worker._id.toString(), 'worker');

    res.status(201).json({
      message: 'Registration successful. Complete your profile to start working.',
      accessToken,
      worker: toWorkerAuthPayload(worker),
    });
  } catch (error) {
    console.error('Register worker error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Worker Login ───
export const loginWorker = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, password, identifier } = req.body;

    // Support both `identifier` (email or phone) and legacy `phone` field.
    const loginId = (identifier || phone || '').trim();
    if (!loginId) {
      res.status(400).json({ message: 'Phone or email is required' });
      return;
    }

    const isEmail = loginId.includes('@');
    const query = isEmail ? { email: loginId.toLowerCase() } : { phone: loginId };

    const worker = await Worker.findOne(query).select('+password');
    if (!worker) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    if (!worker.password) {
      // Google OAuth account — offer to set a password
      res.status(403).json({
        needsPassword: true,
        message: 'This account was created with Google. Would you like to set a password for email/phone login?',
        email: worker.email ? worker.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : '',
        userId: worker._id,
      });
      return;
    }

    const isMatch = await bcrypt.compare(password, worker.password);
    if (!isMatch) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const accessToken = await issueTokens(res, worker._id.toString(), 'worker');

    res.json({
      message: 'Login successful',
      accessToken,
      worker: toWorkerAuthPayload(worker),
    });
  } catch (error) {
    console.error('Login worker error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Admin Login ───
export const loginAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      res.status(400).json({ message: 'Email and password are required' });
      return;
    }

    // Any admin record (super admin OR staff) can log in — gated by isActive.
    const admin = await Admin.findOne({ email }).select('+password');
    if (!admin) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const superAdmin = admin.role === 'super_admin' || admin.role === 'superadmin' || isSuperAdminEmail(admin.email);
    if (!superAdmin && admin.isActive === false) {
      res.status(403).json({ message: 'Your staff account has been disabled. Contact the Super Admin.' });
      return;
    }

    admin.lastLoginAt = new Date();
    await admin.save();

    const accessToken = await issueTokens(res, admin._id.toString(), 'admin');

    res.json({
      message: 'Login successful',
      accessToken,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: superAdmin ? 'super_admin' : admin.role,
        permissions: effectivePermissions(admin),
        isSuperAdmin: superAdmin,
      },
    });
  } catch (error) {
    console.error('Login admin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Forgot Password ───
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { identifier, role } = req.body;
    const isEmail = identifier.includes('@');

    if (role === 'customer') {
      const query = isEmail ? { email: identifier } : { phone: identifier };
      const user = await User.findOne(query);
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
      } else {
        const otp = generateOTP();
        const sent = await sendOTP(identifier, otp);
        if (!sent) {
          res.status(503).json({ message: 'Unable to send OTP right now. Please try email reset.' });
          return;
        }
        await storeOTP(identifier, otp);
        res.json({ message: 'OTP sent to your phone number', method: 'phone' });
      }
    } else if (role === 'worker') {
      const worker = await Worker.findOne({ phone: identifier });
      if (!worker) {
        // Try email if worker has one
        if (isEmail) {
          const workerByEmail = await Worker.findOne({ email: identifier });
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
      } else {
        const otp = generateOTP();
        const sent = await sendOTP(identifier, otp);
        if (!sent) {
          res.status(503).json({ message: 'Unable to send OTP right now. Please try email reset.' });
          return;
        }
        await storeOTP(identifier, otp);
        res.json({ message: 'OTP sent to your phone number', method: 'phone' });
      }
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Verify OTP ───
export const verifyOTPHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, otp } = req.body;

    const isValid = await verifyOTP(phone, otp);
    if (!isValid) {
      res.status(400).json({ message: 'Invalid or expired OTP' });
      return;
    }

    const customer = await User.findOne({ phone });
    const worker = customer ? null : await Worker.findOne({ phone });
    const account = customer || worker;

    if (!account) {
      res.status(404).json({ message: 'Account not found' });
      return;
    }

    const role: PasswordResetRole = customer ? 'customer' : 'worker';
    const { rawToken } = await createResetToken(account._id.toString(), role, OTP_RESET_TOKEN_TTL_MS);

    res.json({ message: 'OTP verified', resetToken: rawToken });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Reset Password ───
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
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

    const hashedPassword = await bcrypt.hash(password, 12);

    if (tokenData.role === 'customer') {
      await User.findByIdAndUpdate(tokenData.id, { password: hashedPassword });
    } else {
      await Worker.findByIdAndUpdate(tokenData.id, { password: hashedPassword });
    }

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Get Current User ───
export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    switch (req.user.role) {
      case 'customer': {
        const user = await User.findById(req.user.id);
        if (!user || user.isActive === false) {
          res.status(401).json({ message: 'Account is deactivated' });
          return;
        }
        await clearExpiredBlock(user);
        res.json({ role: 'customer', user, block: blockPayload(user.block) });
        break;
      }
      case 'worker': {
        const worker = await Worker.findById(req.user.id).populate('categories');
        if (worker) await clearExpiredBlock(worker);
        res.json({ role: 'worker', worker, block: blockPayload(worker?.block) });
        break;
      }
      case 'admin': {
        const admin = await Admin.findById(req.user.id);
        if (!admin) {
          res.status(401).json({ message: 'Admin not found' });
          return;
        }
        const superAdmin = admin.role === 'super_admin' || admin.role === 'superadmin' || isSuperAdminEmail(admin.email);
        if (!superAdmin && admin.isActive === false) {
          res.status(403).json({ message: 'Your staff account has been disabled' });
          return;
        }
        res.json({
          role: 'admin',
          admin: {
            _id: admin._id,
            id: admin._id,
            name: admin.name,
            email: admin.email,
            role: superAdmin ? 'super_admin' : admin.role,
            permissions: effectivePermissions(admin),
            isSuperAdmin: superAdmin,
            isActive: admin.isActive !== false,
            lastLoginAt: admin.lastLoginAt,
          },
        });
        break;
      }
    }
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Send OTP for Password Setup (Google OAuth users) ───
export const sendPasswordSetupOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, role } = req.body;
    if (!userId || !role) {
      res.status(400).json({ message: 'userId and role are required' });
      return;
    }

    let email = '';
    let name = '';

    if (role === 'customer') {
      const user = await User.findById(userId);
      if (!user) { res.status(404).json({ message: 'User not found' }); return; }
      if (user.password) { res.status(400).json({ message: 'Password already exists. Use forgot-password to reset.' }); return; }
      email = user.email || '';
      name = user.fullName || '';
    } else if (role === 'worker') {
      const worker = await Worker.findById(userId);
      if (!worker) { res.status(404).json({ message: 'Worker not found' }); return; }
      if (worker.password) { res.status(400).json({ message: 'Password already exists. Use forgot-password to reset.' }); return; }
      email = worker.email || '';
      name = worker.fullName || '';
    } else {
      res.status(400).json({ message: 'Invalid role' });
      return;
    }

    if (!email) {
      res.status(400).json({ message: 'No email associated with this account' });
      return;
    }

    const otp = generateOTP();
    await storeOTP(email, otp);

    const { sendPasswordSetupOtpEmail } = await import('../services/email.service');
    await sendPasswordSetupOtpEmail(email, otp, name);

    res.json({ message: 'OTP sent to your email', email: email.replace(/(.{2})(.*)(@.*)/, '$1***$3') });
  } catch (error) {
    console.error('Send password setup OTP error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Verify OTP & Set Password (Google OAuth users) ───
export const setPasswordForOAuthUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, role, otp, password } = req.body;
    if (!userId || !role || !otp || !password) {
      res.status(400).json({ message: 'All fields are required' });
      return;
    }

    // Validate password strength
    if (password.length < 8) {
      res.status(400).json({ message: 'Password must be at least 8 characters' });
      return;
    }

    let email = '';

    if (role === 'customer') {
      const user = await User.findById(userId).select('+password');
      if (!user) { res.status(404).json({ message: 'User not found' }); return; }
      if (user.password) { res.status(400).json({ message: 'Password already set' }); return; }
      email = user.email || '';
    } else if (role === 'worker') {
      const worker = await Worker.findById(userId).select('+password');
      if (!worker) { res.status(404).json({ message: 'Worker not found' }); return; }
      if (worker.password) { res.status(400).json({ message: 'Password already set' }); return; }
      email = worker.email || '';
    } else {
      res.status(400).json({ message: 'Invalid role' });
      return;
    }

    if (!email) {
      res.status(400).json({ message: 'No email found' });
      return;
    }

    // Verify OTP
    const isValid = await verifyOTP(email, otp);
    if (!isValid) {
      res.status(400).json({ message: 'Invalid or expired OTP' });
      return;
    }

    // Hash and set password
    const hashedPassword = await bcrypt.hash(password, 10);

    if (role === 'customer') {
      await User.findByIdAndUpdate(userId, { password: hashedPassword });
    } else {
      await Worker.findByIdAndUpdate(userId, { password: hashedPassword });
    }

    res.json({ message: 'Password set successfully! You can now login with email/phone and password.' });
  } catch (error) {
    console.error('Set password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Refresh Token ───
export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      res.status(401).json({ message: 'No refresh token' });
      return;
    }

    const stored = await RefreshToken.findOne({ token });
    if (!stored || stored.expiresAt < new Date()) {
      if (stored) await stored.deleteOne();
      res.clearCookie('refreshToken', refreshCookieClearOptions);
      res.status(401).json({ message: 'Invalid or expired refresh token' });
      return;
    }

    if (stored.role === 'customer') {
      const customer = await User.findById(stored.userId).select('isActive');
      if (!customer || customer.isActive === false) {
        await stored.deleteOne();
        res.clearCookie('refreshToken', refreshCookieClearOptions);
        res.status(401).json({ message: 'Account is deactivated' });
        return;
      }
    }

    const accessToken = generateAccessToken({ id: stored.userId.toString(), role: stored.role });

    res.json({ accessToken, role: stored.role });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Logout ───
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.cookies?.refreshToken;
    if (token) {
      await RefreshToken.deleteOne({ token });
    }
    res.clearCookie('refreshToken', refreshCookieClearOptions);
    res.json({ message: 'Logged out' });
  } catch (error) {
    console.error('Logout error:', error);
    res.clearCookie('refreshToken', refreshCookieClearOptions);
    res.json({ message: 'Logged out' });
  }
};
