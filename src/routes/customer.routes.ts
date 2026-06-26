import { Router } from 'express';
import { protect, authorize, verifyUser } from '../middlewares/auth.middleware';
import { blockGuard } from '../middlewares/block.middleware';
import { uploadSingle } from '../middlewares/upload.middleware';
import { handleValidationErrors } from '../middlewares/error.middleware';
import { idempotencyGuard } from '../middlewares/idempotency.middleware';
import {
  getProfile,
  updateProfile,
  getCategories,
  getCategoryDetail,
  getBanners,
  getBookings,
  getBookingDetail,
  getTransactions,
  cancelBooking,
  revealCompletionCode,
  submitRefundDetails,
  submitReview,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  getChatbotQA,
  createHelpTicket,
  getHelpTickets,
  getHelpTicketDetail,
  appendHelpTicketMessage,
  escalateHelpTicket,
  sendDeactivateAccountOtp,
  confirmDeactivateAccount,
  getServiceAvailability,
  joinWaitlist,
} from '../controllers/customer.controller';
import {
  getRewards,
  claimReward,
  getRewardClaims,
  getAvailableCoupons,
  validateCoupon,
} from '../controllers/rewards.controller';

const router = Router();
const mutationGuard = idempotencyGuard(15_000);

// Public routes
router.get('/categories', getCategories);
router.get('/categories/:id', getCategoryDetail);
router.get('/banners', getBanners);
router.get('/service-availability', getServiceAvailability);

// Protected customer routes
router.use(protect, authorize('customer'), verifyUser);
router.use(blockGuard);

router.post('/waitlist', mutationGuard, joinWaitlist);

router.get('/profile', getProfile);
router.put('/profile', uploadSingle, updateProfile);
router.post('/account/deactivation/send-otp', mutationGuard, sendDeactivateAccountOtp);
router.post('/account/deactivation/confirm', mutationGuard, confirmDeactivateAccount);
router.get('/bookings', getBookings);
router.get('/bookings/:id', getBookingDetail);
router.get('/transactions', getTransactions);
router.post('/bookings/:id/cancel', mutationGuard, cancelBooking);
router.post('/bookings/:id/reveal-completion-code', mutationGuard, revealCompletionCode);
router.post('/bookings/:id/refund-details', mutationGuard, submitRefundDetails);
router.post('/bookings/:id/review', mutationGuard, submitReview);

// Rewards & Coupons
router.get('/rewards', getRewards);
router.post('/rewards/:milestoneKey/claim', mutationGuard, claimReward);
router.get('/rewards/claims', getRewardClaims);
router.get('/coupons', getAvailableCoupons);
router.post('/coupons/validate', validateCoupon);

router.get('/notifications', getNotifications);
router.patch('/notifications/:id/read', markNotificationRead);
router.patch('/notifications/read-all', markAllNotificationsRead);
router.delete('/notifications/:id', deleteNotification);

// Chatbot QA (public-ish, but behind auth for user context)
router.get('/chatbot-qa', getChatbotQA);

// Help Tickets
router.post('/help-tickets', mutationGuard, createHelpTicket);
router.get('/help-tickets', getHelpTickets);
router.get('/help-tickets/:id', getHelpTicketDetail);
router.post('/help-tickets/:id/message', mutationGuard, appendHelpTicketMessage);
router.post('/help-tickets/:id/escalate', mutationGuard, escalateHelpTicket);

export default router;
