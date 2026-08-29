import { Router } from 'express';
import {
  registerCustomer,
  googleAuthCustomer,
  completeGoogleRegistration,
  loginCustomer,
  googleAuthWorker,
  registerWorkerWithGoogle,
  registerWorker,
  loginWorker,
  loginAdmin,
  forgotPassword,
  verifyOTPHandler,
  resetPassword,
  changePassword,
  getMe,
  logout,
  logoutAll,
  refresh,
  getSessions,
  revokeSession,
  bootstrapSession,
  sendPasswordSetupOtp,
  setPasswordForOAuthUser,
} from '../controllers/auth.controller';
import { protect } from '../middlewares/auth.middleware';
import { refreshTokenTransport } from '../middlewares/refreshTransport';
import { refreshLimiter } from '../middlewares/rateLimit.middleware';
import { requireTrustedOrigin } from '../middlewares/originGuard';
import { uploadAadhaar } from '../middlewares/upload.middleware';
import { handleValidationErrors } from '../middlewares/error.middleware';
import {
  registerCustomerValidation,
  registerWorkerValidation,
  loginValidation,
  workerLoginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
} from '../utils/validators';

const router = Router();

// Native clients receive their refresh token in the JSON body (no cookie jar).
// Browsers are unaffected: nothing is added to their responses.
router.use(refreshTokenTransport);

// Customer auth
router.post('/customer/register', registerCustomerValidation, handleValidationErrors, registerCustomer);
router.post('/customer/google', googleAuthCustomer);
router.post('/customer/google/complete', completeGoogleRegistration);
router.post('/customer/login', loginValidation, handleValidationErrors, loginCustomer);

// Worker auth
router.post('/worker/register', uploadAadhaar, registerWorkerValidation, handleValidationErrors, registerWorker);
router.post('/worker/google', googleAuthWorker);
router.post('/worker/google/register', uploadAadhaar, registerWorkerWithGoogle);
router.post('/worker/login', workerLoginValidation, handleValidationErrors, loginWorker);

// Admin auth
router.post('/admin/login', loginAdmin);

// Password recovery
router.post('/forgot-password', forgotPasswordValidation, handleValidationErrors, forgotPassword);
router.post('/verify-otp', verifyOTPHandler);
router.post('/reset-password', resetPasswordValidation, handleValidationErrors, resetPassword);

// Password setup for Google OAuth users
router.post('/send-password-setup-otp', sendPasswordSetupOtp);
router.post('/set-password', setPasswordForOAuthUser);

// Common
router.get('/me', protect, getMe);
router.post('/change-password', protect, changePassword);

// Session lifecycle.
// `/refresh` is intentionally NOT behind `protect` — it is called precisely when the
// access token is missing or expired. It authenticates with the refresh token alone.
router.post('/refresh', requireTrustedOrigin, refreshLimiter, refresh);
router.post('/logout', requireTrustedOrigin, logout);
router.post('/logout-all', requireTrustedOrigin, protect, logoutAll);

// One-time migration path for mobile installs that stored an access token and had
// no refresh token (see bootstrapSession).
router.post('/session', protect, bootstrapSession);

// Multi-device management.
router.get('/sessions', protect, getSessions);
router.delete('/sessions/:sessionId', protect, revokeSession);

export default router;
