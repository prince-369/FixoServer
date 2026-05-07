import { Router } from 'express';
import { protect, authorize, verifyUser } from '../middlewares/auth.middleware';
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
  deleteAccount,
} from '../controllers/customer.controller';

const router = Router();
const mutationGuard = idempotencyGuard(15_000);

// Public routes
router.get('/categories', getCategories);
router.get('/categories/:id', getCategoryDetail);
router.get('/banners', getBanners);

// Protected customer routes
router.use(protect, authorize('customer'), verifyUser);

router.get('/profile', getProfile);
router.put('/profile', uploadSingle, updateProfile);
router.delete('/account', mutationGuard, deleteAccount);
router.get('/bookings', getBookings);
router.get('/bookings/:id', getBookingDetail);
router.get('/transactions', getTransactions);
router.post('/bookings/:id/cancel', mutationGuard, cancelBooking);
router.post('/bookings/:id/reveal-completion-code', mutationGuard, revealCompletionCode);
router.post('/bookings/:id/refund-details', mutationGuard, submitRefundDetails);
router.post('/bookings/:id/review', mutationGuard, submitReview);

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
