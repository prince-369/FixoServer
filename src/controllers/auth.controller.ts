import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import Worker from '../models/Worker';
import Admin from '../models/Admin';
import { effectivePermissions, isSuperAdminEmail } from '../config/adminPermissions';
import { blockPayload, clearExpiredBlock } from '../utils/userBlock';
import { parseSkillsInput } from '../utils/workerSkills';
import RefreshToken from '../models/RefreshToken';
import PasswordResetToken from '../models/PasswordResetToken';
import {
  createSession,
  rotateSession,
  revokeSessionByToken,
  revokeAllSessions,
  revokeSessionById,
  listSessions,
  readRefreshToken,
  readDeviceContext,
  setRefreshCookie,
  clearRefreshCookie,
  isNativeClient,
  checkAccountUsable,
} from '../services/authSession.service';
import { generateOTP, storeOTP, verifyOTP, sendOTP, clearOTP } from '../services/sms.service';
import { sendPasswordResetEmail } from '../services/email.service';
import { uploadBufferToCloudinary } from '../services/cloudinary.service';
import env from '../config/env';
import logger from '../utils/logger';

const EMAIL_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const OTP_RESET_TOKEN_TTL_MS = 10 * 60 * 1000;

// Refresh-token cookie attributes and TTLs now live in services/authSession.service.ts,
// driven entirely by env (REFRESH_COOKIE_* / REFRESH_TOKEN_TTL). Nothing about token
// lifetime or cookie security is decided in this file any more.

type PasswordResetRole = 'customer' | 'worker';

// Strong password regex: min 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special char
const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

const validateStrongPassword = (password: string): string | null => {
  if (password.length < 8) return 'Password must be at least 8 characters';
  // Cap length: bcrypt only hashes the first 72 bytes, so anything longer is both
  // pointless and a security footgun (two long passwords could collide). 64 is safe.
  if (password.length > 64) return 'Password must be at most 64 characters';
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
    // OAuth client IDs are config, not secrets — safe to log for diagnosing the mismatch.
    logger.warn('Google audience mismatch', {
      audience: error.audience,
      authorizedParty: error.authorizedParty,
      allowedClientIds: error.allowedClientIds,
    });
    // Internal OAuth config (allowed client IDs, token aud/azp) is logged above
    // for debugging but never returned to the client.
    res.status(401).json({
      message: 'Google authentication failed. OAuth client ID mismatch.',
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
  const sent = await sendPasswordResetEmail(email, rawToken, role);

  if (!sent) {
    await PasswordResetToken.deleteOne({ tokenHash });
    return false;
  }

  return true;
};

/**
 * Establishes a persistent session and returns the access token.
 *
 * Every authentication method funnels through here — password, Google, and (later)
 * phone OTP. Those methods only *prove identity*; session creation, token lifetimes
 * and transport are decided in exactly one place, so adding an OTP login later needs
 * no changes to any of this.
 *
 * Transport:
 *   • browser  → refresh token goes out as an HttpOnly cookie, never in the body.
 *   • native   → no usable cookie jar, so it is stashed on res.locals and merged into
 *                the JSON body by the `refreshTokenTransport` middleware.
 */
const issueTokens = async (
  req: Request,
  res: Response,
  userId: string,
  role: 'customer' | 'worker' | 'admin'
): Promise<string> => {
  const device = readDeviceContext(req);
  const { accessToken, refreshToken } = await createSession(userId, role, device);

  if (isNativeClient(req)) {
    res.locals.pendingRefreshToken = refreshToken;
  } else {
    setRefreshCookie(res, refreshToken);
  }

  return accessToken;
};

const toWorkerAuthPayload = (worker: {
  _id: unknown;
  fullName: string;
  phone: string;
  email?: string;
  accountStatus: string;
  verificationStatus?: string;
  verificationSlot?: string | null;
  whatsappNumber?: string;
  rejectionReason?: string;
  profileCompleted: boolean;
  isActive: boolean;
  balance: number;
  profileImage?: string;
  aadhaarFront?: string;
  aadhaarBack?: string;
  skills?: unknown[];
  updatedAt?: Date | string | null;
}) => ({
  id: worker._id,
  fullName: worker.fullName,
  phone: worker.phone,
  email: worker.email,
  profileImage: worker.profileImage,
  accountStatus: worker.accountStatus,
  verificationStatus: worker.verificationStatus,
  verificationSlot: worker.verificationSlot,
  whatsappNumber: worker.whatsappNumber,
  rejectionReason: worker.rejectionReason,
  // Monotonic version marker for the client's stale-response guard (Phase 4).
  updatedAt: worker.updatedAt ? new Date(worker.updatedAt).toISOString() : undefined,
  profileCompleted: worker.profileCompleted,
  isActive: worker.isActive,
  balance: worker.balance,
  // Onboarding progress (aadhaar upload + skills selection happen after signup).
  aadhaarSubmitted: Boolean(worker.aadhaarFront && worker.aadhaarBack),
  skillsCount: Array.isArray(worker.skills) ? worker.skills.length : 0,
});

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

    const accessToken = await issueTokens(req, res, user._id.toString(), 'customer');

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
    logger.error('Register customer error:', { err: error });
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

    const accessToken = await issueTokens(req, res, user._id.toString(), 'customer');

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
    logger.error('Google auth error:', { err: error });
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

      const accessToken = await issueTokens(req, res, existingByGoogle._id.toString(), 'customer');
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

    const accessToken = await issueTokens(req, res, user._id.toString(), 'customer');

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
    logger.error('Complete Google registration error:', { err: error });
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

    const accessToken = await issueTokens(req, res, user._id.toString(), 'customer');

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
    logger.error('Login customer error:', { err: error });
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

    const accessToken = await issueTokens(req, res, worker._id.toString(), 'worker');

    res.json({
      message: 'Login successful',
      accessToken,
      worker: toWorkerAuthPayload(worker),
    });
  } catch (error) {
    logger.error('Worker Google auth error:', { err: error });
    handleGoogleErrorResponse(res, error, 'Google authentication failed');
  }
};

// ─── Worker Google Registration ───
export const registerWorkerWithGoogle = async (req: Request, res: Response): Promise<void> => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

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

    // Aadhaar is optional here (account-first) — uploaded later via onboarding.
    let gFrontUrl = '';
    let gBackUrl = '';
    if (files?.aadhaarFront?.[0] && files?.aadhaarBack?.[0]) {
      const [frontUpload, backUpload] = await Promise.all([
        uploadBufferToCloudinary(files.aadhaarFront[0].buffer, 'aadhaar'),
        uploadBufferToCloudinary(files.aadhaarBack[0].buffer, 'aadhaar'),
      ]);
      gFrontUrl = frontUpload.url;
      gBackUrl = backUpload.url;
    }

    if (existingWorker) {
      existingWorker.fullName = existingWorker.fullName || fullName;
      existingWorker.email = existingWorker.email || email;
      existingWorker.googleId = existingWorker.googleId || googleId;
      existingWorker.profileImage = existingWorker.profileImage || profileImage;
      if (gFrontUrl) existingWorker.aadhaarFront = existingWorker.aadhaarFront || gFrontUrl;
      if (gBackUrl) existingWorker.aadhaarBack = existingWorker.aadhaarBack || gBackUrl;

      // Do NOT set a placeholder password. A Google-only worker keeps no password
      // so email/phone login offers "Set Password" (needsPassword), same as customer.

      await existingWorker.save();

      const accessToken = await issueTokens(req, res, existingWorker._id.toString(), 'worker');
      res.json({
        message: 'Login successful',
        accessToken,
        worker: toWorkerAuthPayload(existingWorker),
      });
      return;
    }

    // Skills are optional here — selected later via onboarding (account-first).
    const gSkillsInput = parseSkillsInput(req.body?.skills);
    const gSkills = gSkillsInput
      .filter((s) => s.confirmed)
      .map((s) => ({
        category: s.categoryId, experienceYears: s.experienceYears, confirmed: s.confirmed,
        status: 'pending_kyc' as const, experienceBumpsUsed: 0, callAttempts: 0, requestedAt: new Date(),
      }));

    const worker = await Worker.create({
      fullName,
      phone,
      email,
      googleId,
      profileImage,
      // No password: Google-only account. Login with email/phone will offer
      // "Set Password" (needsPassword) just like the customer flow.
      aadhaarFront: gFrontUrl,
      aadhaarBack: gBackUrl,
      accountStatus: 'test',
      skills: gSkills,
    });

    const accessToken = await issueTokens(req, res, worker._id.toString(), 'worker');

    res.status(201).json({
      message: 'Registration successful. Complete your profile to start working.',
      accessToken,
      worker: toWorkerAuthPayload(worker),
    });
  } catch (error) {
    logger.error('Register worker with Google error:', { err: error });
    handleGoogleErrorResponse(res, error, 'Server error');
  }
};

// ─── Worker Registration ───
export const registerWorker = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fullName, phone, email, password } = req.body;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

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

    // Account-first onboarding: aadhaar + skills are submitted AFTER signup via the
    // onboarding endpoints. They remain optional here so the account can be created
    // from just the basic details. (Legacy single-step signups may still send them.)
    const skillsInput = parseSkillsInput(req.body?.skills);
    const skills = skillsInput
      .filter((s) => s.confirmed)
      .map((s) => ({
        category: s.categoryId,
        experienceYears: s.experienceYears,
        confirmed: s.confirmed,
        status: 'pending_kyc' as const,
        experienceBumpsUsed: 0,
        callAttempts: 0,
        requestedAt: new Date(),
      }));

    let aadhaarFrontUrl = '';
    let aadhaarBackUrl = '';
    if (files?.aadhaarFront?.[0] && files?.aadhaarBack?.[0]) {
      const [frontUpload, backUpload] = await Promise.all([
        uploadBufferToCloudinary(files.aadhaarFront[0].buffer, 'aadhaar'),
        uploadBufferToCloudinary(files.aadhaarBack[0].buffer, 'aadhaar'),
      ]);
      aadhaarFrontUrl = frontUpload.url;
      aadhaarBackUrl = backUpload.url;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const worker = await Worker.create({
      fullName,
      phone,
      email: email || undefined,
      password: hashedPassword,
      aadhaarFront: aadhaarFrontUrl,
      aadhaarBack: aadhaarBackUrl,
      accountStatus: 'test',
      skills,
    });

    const accessToken = await issueTokens(req, res, worker._id.toString(), 'worker');

    res.status(201).json({
      message: 'Registration successful. Complete your profile to start working.',
      accessToken,
      worker: toWorkerAuthPayload(worker),
    });
  } catch (error) {
    logger.error('Register worker error:', { err: error });
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

    const accessToken = await issueTokens(req, res, worker._id.toString(), 'worker');

    res.json({
      message: 'Login successful',
      accessToken,
      worker: toWorkerAuthPayload(worker),
    });
  } catch (error) {
    logger.error('Login worker error:', { err: error });
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

    const accessToken = await issueTokens(req, res, admin._id.toString(), 'admin');

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
    logger.error('Login admin error:', { err: error });
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
    logger.error('Forgot password error:', { err: error });
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Verify OTP ───
export const verifyOTPHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, otp } = req.body;

    const result = await verifyOTP(String(phone), otp);
    if (!result.ok) {
      const message = result.reason === 'locked'
        ? 'Too many incorrect attempts. Please request a new OTP.'
        : 'Invalid or expired OTP';
      res.status(400).json({ message });
      return;
    }

    const customer = await User.findOne({ phone: String(phone) });
    const worker = customer ? null : await Worker.findOne({ phone: String(phone) });
    const account = customer || worker;

    if (!account) {
      res.status(404).json({ message: 'Account not found' });
      return;
    }

    const role: PasswordResetRole = customer ? 'customer' : 'worker';
    const { rawToken } = await createResetToken(account._id.toString(), role, OTP_RESET_TOKEN_TTL_MS);

    res.json({ message: 'OTP verified', resetToken: rawToken });
  } catch (error) {
    logger.error('Verify OTP error:', { err: error });
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

    // A reset is the remediation path for a lost or compromised account, so EVERY
    // session dies — including any the attacker holds. No exception for the caller:
    // they came in unauthenticated and must sign in with the new password.
    await revokeAllSessions(tokenData.id, tokenData.role, 'password_reset');
    await RefreshToken.deleteMany({ userId: tokenData.id }).catch(() => undefined);
    clearRefreshCookie(res);

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    logger.error('Reset password error:', { err: error });
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Change Password (authenticated) ───
export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ message: 'Current password and new password are required' });
      return;
    }

    // Validate strong password
    const pwdError = validateStrongPassword(newPassword);
    if (pwdError) {
      res.status(400).json({ message: pwdError });
      return;
    }

    let account: any = null;
    if (req.user.role === 'customer') {
      account = await User.findById(req.user.id).select('+password');
    } else if (req.user.role === 'worker') {
      account = await Worker.findById(req.user.id).select('+password');
    }

    if (!account) {
      res.status(404).json({ message: 'Account not found' });
      return;
    }

    // If account has no password (Google OAuth only), reject
    if (!account.password) {
      res.status(400).json({ message: 'Your account uses Google Sign-In. Set a password first using the "Set Password" option.' });
      return;
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, account.password);
    if (!isMatch) {
      res.status(400).json({ message: 'Current password is incorrect' });
      return;
    }

    // Hash and update
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    account.password = hashedPassword;
    await account.save();

    // Sign out every OTHER device: if the old password leaked, those sessions are
    // suspect. The acting session is preserved (req.user.sessionId) so the user is
    // not bounced to the login screen for changing their own password.
    const revoked = await revokeAllSessions(
      req.user.id,
      req.user.role,
      'password_changed',
      req.user.sessionId
    );
    await RefreshToken.deleteMany({ userId: req.user.id }).catch(() => undefined);

    res.json({ message: 'Password changed successfully', otherSessionsRevoked: revoked });
  } catch (error) {
    logger.error('Change password error:', { err: error });
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
        // Augment with onboarding-progress flags so the client wizard can gate steps.
        const workerPayload = worker
          ? {
              ...worker.toObject(),
              aadhaarSubmitted: Boolean(worker.aadhaarFront && worker.aadhaarBack),
              skillsCount: Array.isArray(worker.skills) ? worker.skills.length : 0,
            }
          : worker;
        res.json({ role: 'worker', worker: workerPayload, block: blockPayload(worker?.block) });
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
    logger.error('Get me error:', { err: error });
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
    const sent = await sendPasswordSetupOtpEmail(email, otp, name);

    // The mailer reports delivery failure by returning false rather than throwing. Ignoring it
    // told the user "OTP sent" while nothing left the server — drop the unusable OTP instead.
    if (!sent) {
      await clearOTP(email);
      res.status(502).json({ message: 'Unable to send OTP email. Please try again.' });
      return;
    }

    res.json({ message: 'OTP sent to your email', email: email.replace(/(.{2})(.*)(@.*)/, '$1***$3') });
  } catch (error) {
    logger.error('Send password setup OTP error:', { err: error });
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

    // Validate password strength (same policy as the rest of the app)
    const passwordError = validateStrongPassword(String(password));
    if (passwordError) {
      res.status(400).json({ message: passwordError });
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
    const result = await verifyOTP(email, otp);
    if (!result.ok) {
      const message = result.reason === 'locked'
        ? 'Too many incorrect attempts. Please request a new OTP.'
        : 'Invalid or expired OTP';
      res.status(400).json({ message });
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
    logger.error('Set password error:', { err: error });
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Refresh / session restore ---
/**
 * Rotating refresh endpoint. This is the call every client makes on startup to
 * restore a session, and the call the API client makes when an access token expires.
 *
 * On success the presented refresh token is retired and a new one issued, so no
 * refresh token is ever usable twice. The response also carries the full user
 * profile, so a client can restore a session in ONE round trip instead of
 * refresh-then-/auth/me.
 */
export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const presented = readRefreshToken(req);
    const device = readDeviceContext(req);

    // -- Legacy migration ----------------------------------------------------
    // Sessions created before rotation existed live in the old `RefreshToken`
    // collection with the token stored in plaintext. Rather than logging those
    // users out, the old token is redeemed once for a real AuthSession and then
    // destroyed. Existing users therefore stay signed in across this deploy.
    if (presented) {
      const legacy = await RefreshToken.findOne({ token: presented });
      if (legacy) {
        await legacy.deleteOne();

        if (legacy.expiresAt < new Date()) {
          clearRefreshCookie(res);
          res.status(401).json({ message: 'Session expired', code: 'SESSION_EXPIRED' });
          return;
        }

        const status = await checkAccountUsable(legacy.userId.toString(), legacy.role);
        if (!status.usable) {
          clearRefreshCookie(res);
          res.status(401).json({ message: status.reason, code: 'SESSION_INVALID' });
          return;
        }

        const accessToken = await issueTokens(req, res, legacy.userId.toString(), legacy.role);
        logger.info('Legacy refresh token migrated to AuthSession', {
          userId: legacy.userId.toString(),
          role: legacy.role,
        });
        await respondWithSession(res, accessToken, legacy.role, legacy.userId.toString());
        return;
      }
    }

    const result = await rotateSession(presented, device);

    if (!result.ok) {
      clearRefreshCookie(res);
      // A stable machine-readable code lets clients tell "your session ended" from
      // "the network failed" -- the latter must never wipe local credentials.
      const code =
        result.failure === 'reuse_detected' ? 'SESSION_REVOKED'
        : result.failure === 'expired' ? 'SESSION_EXPIRED'
        : result.failure === 'no_token' ? 'NO_SESSION'
        : 'SESSION_INVALID';
      res.status(401).json({ message: result.message, code });
      return;
    }

    if (isNativeClient(req)) {
      res.locals.pendingRefreshToken = result.refreshToken;
    } else {
      setRefreshCookie(res, result.refreshToken);
    }

    await respondWithSession(
      res,
      result.accessToken,
      result.session.role,
      String(result.session.userId)
    );
  } catch (error) {
    logger.error('Refresh token error:', { err: error });
    // 500, NOT 401 -- a database blip must not be read by the client as "logged out".
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Shared body for /auth/refresh, so session restore is a single round trip.
 * Mirrors the shape of /auth/me.
 */
const respondWithSession = async (
  res: Response,
  accessToken: string,
  role: 'customer' | 'worker' | 'admin',
  userId: string
): Promise<void> => {
  const base = { accessToken, role };

  if (role === 'customer') {
    const user = await User.findById(userId);
    if (user) await clearExpiredBlock(user);
    res.json({ ...base, user, block: blockPayload(user?.block) });
    return;
  }

  if (role === 'worker') {
    const worker = await Worker.findById(userId).populate('categories');
    if (worker) await clearExpiredBlock(worker);
    const workerPayload = worker
      ? {
          ...worker.toObject(),
          aadhaarSubmitted: Boolean(worker.aadhaarFront && worker.aadhaarBack),
          skillsCount: Array.isArray(worker.skills) ? worker.skills.length : 0,
        }
      : worker;
    res.json({ ...base, worker: workerPayload, block: blockPayload(worker?.block) });
    return;
  }

  const admin = await Admin.findById(userId);
  res.json({
    ...base,
    admin: admin
      ? {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          permissions: effectivePermissions(admin),
        }
      : null,
  });
};

// --- Logout (this device) ---
/**
 * Logout is a backend action: the session row is revoked so the refresh token is
 * dead server-side. Clearing client state alone would leave a usable token behind.
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const presented = readRefreshToken(req);
    await revokeSessionByToken(presented, 'logout');
    // Drain any legacy row for the same token so it cannot resurrect the session.
    if (presented) {
      await RefreshToken.deleteOne({ token: presented }).catch(() => undefined);
    }
  } catch (error) {
    logger.error('Logout error:', { err: error });
  } finally {
    // Always clear the cookie and report success -- a client must never be stuck
    // "logged in" because logout bookkeeping failed.
    clearRefreshCookie(res);
    res.json({ message: 'Logged out' });
  }
};

// --- Logout everywhere ---
export const logoutAll = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    const count = await revokeAllSessions(req.user.id, req.user.role, 'logout_all');
    await RefreshToken.deleteMany({ userId: req.user.id }).catch(() => undefined);

    clearRefreshCookie(res);
    res.json({ message: 'Signed out on all devices', sessionsRevoked: count });
  } catch (error) {
    logger.error('Logout-all error:', { err: error });
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Exchanges a valid access token for a persistent session.
 *
 * Needed for one case: mobile installs upgraded from the previous version, which
 * persisted an ACCESS token in the keychain and had no refresh token at all. Those
 * users would otherwise be forced to sign in again on first launch after the update.
 *
 * It is `protect`-guarded, so the caller must already hold a valid, unexpired access
 * token — this grants no authority the caller does not already have; it only makes
 * that authority renewable. Idempotent per device: `createSession` replaces any
 * existing session for the same deviceId rather than stacking new ones.
 */
export const bootstrapSession = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    // A token already bound to a session has nothing to bootstrap.
    if (req.user.sessionId) {
      res.json({ message: 'Session already active', sessionId: req.user.sessionId });
      return;
    }

    const status = await checkAccountUsable(req.user.id, req.user.role);
    if (!status.usable) {
      res.status(401).json({ message: status.reason, code: 'SESSION_INVALID' });
      return;
    }

    const accessToken = await issueTokens(req, res, req.user.id, req.user.role);
    logger.info('Bootstrapped session from legacy access token', {
      userId: req.user.id,
      role: req.user.role,
    });

    res.json({ accessToken, role: req.user.role });
  } catch (error) {
    logger.error('Bootstrap session error:', { err: error });
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Active sessions (multi-device) ---
export const getSessions = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    const sessions = await listSessions(req.user.id, req.user.role, req.user.sessionId);
    res.json({ sessions });
  } catch (error) {
    logger.error('List sessions error:', { err: error });
    res.status(500).json({ message: 'Server error' });
  }
};

export const revokeSession = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    const sessionId = String(req.params.sessionId || '');
    // Scoped to req.user.id, so one user can never revoke another user's session.
    const revoked = await revokeSessionById(sessionId, req.user.id, 'logout');
    if (!revoked) {
      res.status(404).json({ message: 'Session not found' });
      return;
    }

    // Revoking your own current session is a logout -- clear the cookie too.
    if (req.user.sessionId === sessionId) {
      clearRefreshCookie(res);
    }

    res.json({ message: 'Session revoked' });
  } catch (error) {
    logger.error('Revoke session error:', { err: error });
    res.status(500).json({ message: 'Server error' });
  }
};
