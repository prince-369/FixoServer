"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const refreshTransport_1 = require("../middlewares/refreshTransport");
const rateLimit_middleware_1 = require("../middlewares/rateLimit.middleware");
const originGuard_1 = require("../middlewares/originGuard");
const upload_middleware_1 = require("../middlewares/upload.middleware");
const error_middleware_1 = require("../middlewares/error.middleware");
const validators_1 = require("../utils/validators");
const router = (0, express_1.Router)();
// Native clients receive their refresh token in the JSON body (no cookie jar).
// Browsers are unaffected: nothing is added to their responses.
router.use(refreshTransport_1.refreshTokenTransport);
// Customer auth
router.post('/customer/register', validators_1.registerCustomerValidation, error_middleware_1.handleValidationErrors, auth_controller_1.registerCustomer);
router.post('/customer/google', auth_controller_1.googleAuthCustomer);
router.post('/customer/google/complete', auth_controller_1.completeGoogleRegistration);
router.post('/customer/login', validators_1.loginValidation, error_middleware_1.handleValidationErrors, auth_controller_1.loginCustomer);
// Worker auth
router.post('/worker/register', upload_middleware_1.uploadAadhaar, validators_1.registerWorkerValidation, error_middleware_1.handleValidationErrors, auth_controller_1.registerWorker);
router.post('/worker/google', auth_controller_1.googleAuthWorker);
router.post('/worker/google/register', upload_middleware_1.uploadAadhaar, auth_controller_1.registerWorkerWithGoogle);
router.post('/worker/login', validators_1.workerLoginValidation, error_middleware_1.handleValidationErrors, auth_controller_1.loginWorker);
// Admin auth
router.post('/admin/login', auth_controller_1.loginAdmin);
// Password recovery
router.post('/forgot-password', validators_1.forgotPasswordValidation, error_middleware_1.handleValidationErrors, auth_controller_1.forgotPassword);
router.post('/verify-otp', auth_controller_1.verifyOTPHandler);
router.post('/reset-password', validators_1.resetPasswordValidation, error_middleware_1.handleValidationErrors, auth_controller_1.resetPassword);
// Password setup for Google OAuth users
router.post('/send-password-setup-otp', auth_controller_1.sendPasswordSetupOtp);
router.post('/set-password', auth_controller_1.setPasswordForOAuthUser);
// Common
router.get('/me', auth_middleware_1.protect, auth_controller_1.getMe);
router.post('/change-password', auth_middleware_1.protect, auth_controller_1.changePassword);
// Session lifecycle.
// `/refresh` is intentionally NOT behind `protect` — it is called precisely when the
// access token is missing or expired. It authenticates with the refresh token alone.
router.post('/refresh', originGuard_1.requireTrustedOrigin, rateLimit_middleware_1.refreshLimiter, auth_controller_1.refresh);
router.post('/logout', originGuard_1.requireTrustedOrigin, auth_controller_1.logout);
router.post('/logout-all', originGuard_1.requireTrustedOrigin, auth_middleware_1.protect, auth_controller_1.logoutAll);
// One-time migration path for mobile installs that stored an access token and had
// no refresh token (see bootstrapSession).
router.post('/session', auth_middleware_1.protect, auth_controller_1.bootstrapSession);
// Multi-device management.
router.get('/sessions', auth_middleware_1.protect, auth_controller_1.getSessions);
router.delete('/sessions/:sessionId', auth_middleware_1.protect, auth_controller_1.revokeSession);
exports.default = router;
//# sourceMappingURL=auth.routes.js.map