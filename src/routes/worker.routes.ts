import { Router } from 'express';
import { protect, authorize } from '../middlewares/auth.middleware';
import { blockGuard } from '../middlewares/block.middleware';
import { uploadAadhaar, uploadSingle } from '../middlewares/upload.middleware';
import { handleValidationErrors } from '../middlewares/error.middleware';
import { idempotencyGuard } from '../middlewares/idempotency.middleware';
import { bidValidation, withdrawalValidation, bankDetailsValidation } from '../utils/validators';
import {
  getProfile,
  updateProfile,
  reRequestEKYC,
  completeProfile,
  toggleActive,
  updateLocation,
  updateCurrentLocation,
  getSkills,
  requestSkill,
  bumpSkillExperience,
  unselectSkill,
  getDashboard,
  getReviews,
  getWorkRequests,
  getWorkRequestDetail,
  submitBid,
  respondToNegotiation,
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
  generateVideoKycToken,
} from '../controllers/worker.controller';
import { getWorkerPromotions, getPromotionHistory, claimPromotionBonus } from '../controllers/rewards.controller';

const router = Router();
const mutationGuard = idempotencyGuard(15_000);

router.use(protect, authorize('worker'));
router.use(blockGuard);

router.get('/profile', getProfile);
router.put('/profile', uploadSingle, updateProfile);
router.post('/ekyc/re-request', mutationGuard, uploadAadhaar, reRequestEKYC);
router.post('/video-kyc-token', mutationGuard, generateVideoKycToken);
router.post('/complete-profile', uploadSingle, completeProfile);
router.put('/toggle-active', toggleActive);
router.put('/location', updateLocation);
router.put('/current-location', updateCurrentLocation);

// Skill management
router.get('/skills', getSkills);
router.post('/skills/request', mutationGuard, requestSkill);
router.post('/skills/:skillId/bump-experience', mutationGuard, bumpSkillExperience);
router.post('/skills/:skillId/unselect', mutationGuard, unselectSkill);

router.get('/dashboard', getDashboard);
router.get('/reviews', getReviews);
router.get('/work-requests', getWorkRequests);
router.get('/work-requests/:id', getWorkRequestDetail);
router.post('/work-requests/:bookingId/bid', bidValidation, handleValidationErrors, mutationGuard, submitBid);

router.post('/booking/:id/bids/:bidId/negotiate-respond', mutationGuard, respondToNegotiation);
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



// Promotions & Incentives
router.get('/promotions', getWorkerPromotions);
router.get('/promotions/history', getPromotionHistory);
router.post('/promotions/:id/claim-bonus', mutationGuard, claimPromotionBonus);

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
