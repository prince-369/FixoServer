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
  getMe,
  logout,
  refresh,
  sendPasswordSetupOtp,
  setPasswordForOAuthUser,
} from '../controllers/auth.controller';
import { protect } from '../middlewares/auth.middleware';
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
router.post('/refresh', refresh);
router.post('/logout', logout);

export default router;
