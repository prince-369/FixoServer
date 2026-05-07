import { Router } from 'express';
import { protect, authorize } from '../middlewares/auth.middleware';
import { uploadSingle } from '../middlewares/upload.middleware';
import { handleValidationErrors } from '../middlewares/error.middleware';
import { idempotencyGuard } from '../middlewares/idempotency.middleware';
import { bidValidation, withdrawalValidation, bankDetailsValidation } from '../utils/validators';
import {
  getProfile,
  updateProfile,
  completeProfile,
  toggleActive,
  updateLocation,
  getDashboard,
  getWorkRequests,
  getWorkRequestDetail,
  submitBid,
  approveBooking,
  rejectBooking,
  cancelBookingByWorker,
  sendMessage,
  requestCompletionCode,
  completeWork,
  getFunds,
  getEarningsHistory,
  getWalletTransactions,
  saveBankDetails,
  requestWithdrawal,
  getWithdrawals,
  payDues,
  payDuesFromWallet,
  verifyDuesPayment,
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
} from '../controllers/worker.controller';

const router = Router();
const mutationGuard = idempotencyGuard(15_000);

router.use(protect, authorize('worker'));

router.get('/profile', getProfile);
router.put('/profile', uploadSingle, updateProfile);
router.post('/complete-profile', uploadSingle, completeProfile);
router.put('/toggle-active', toggleActive);
router.put('/location', updateLocation);

router.get('/dashboard', getDashboard);
router.get('/work-requests', getWorkRequests);
router.get('/work-requests/:id', getWorkRequestDetail);
router.post('/work-requests/:bookingId/bid', bidValidation, handleValidationErrors, mutationGuard, submitBid);

router.post('/booking/:id/approve', mutationGuard, approveBooking);
router.post('/booking/:id/reject', mutationGuard, rejectBooking);
router.post('/booking/:id/cancel', mutationGuard, cancelBookingByWorker);
router.post('/booking/:id/message', sendMessage);
router.post('/booking/:id/request-completion-code', mutationGuard, requestCompletionCode);
router.post('/booking/:id/complete', mutationGuard, completeWork);

router.get('/funds', getFunds);
router.get('/funds/history', getEarningsHistory);
router.get('/wallet/transactions', getWalletTransactions);
router.put('/bank-details', bankDetailsValidation, handleValidationErrors, saveBankDetails);
router.post('/withdraw', withdrawalValidation, handleValidationErrors, mutationGuard, requestWithdrawal);
router.get('/withdrawals', getWithdrawals);

router.post('/dues/pay', mutationGuard, payDues);
router.post('/dues/pay-wallet', mutationGuard, payDuesFromWallet);
router.post('/dues/verify', mutationGuard, verifyDuesPayment);

router.get('/notifications', getNotifications);
router.patch('/notifications/:id/read', markNotificationRead);
router.patch('/notifications/read-all', markAllNotificationsRead);
router.delete('/notifications/:id', deleteNotification);

// Chatbot QA
router.get('/chatbot-qa', getChatbotQA);

// Help Tickets
router.post('/help-tickets', mutationGuard, createHelpTicket);
router.get('/help-tickets', getHelpTickets);
router.get('/help-tickets/:id', getHelpTicketDetail);
router.post('/help-tickets/:id/message', mutationGuard, appendHelpTicketMessage);
router.post('/help-tickets/:id/escalate', mutationGuard, escalateHelpTicket);

export default router;
