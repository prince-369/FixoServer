import { Router } from 'express';
import { protect, authorize } from '../middlewares/auth.middleware';
import { uploadSingle } from '../middlewares/upload.middleware';
import { idempotencyGuard } from '../middlewares/idempotency.middleware';
import {
  getDashboard,
  getAdminBootstrapStatus,
  getPendingAdminBadges,
  getPendingEKYC,
  getWorkerEKYCDetails,
  approveWorker,
  rejectWorker,
  saveEkycCapture,
  getWithdrawals,
  completeWithdrawal,
  declineWithdrawal,
  getCategories,
  createCategory,
  updateCategory,
  updateCategoryDetails,
  deleteCategory,
  getBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  reorderBanners,
  getCustomers,
  getCommissions,
  getWorkerDues,
  getHelpTickets,
  resolveHelpTicket,
  replyHelpTicket,
  getChatbotQA,
  createChatbotQA,
  updateChatbotQA,
  deleteChatbotQA,
  getCashPayments,
  notifyWorkerDues,
  processRefund,
  getRefunds,
  rejectRefund,
  getAllWorkers,
  getWorkerDetail,
  getAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
  deleteAdminNotification,
} from '../controllers/admin.controller';

const router = Router();
const mutationGuard = idempotencyGuard(20_000);

router.use(protect, authorize('admin'));

// Dashboard
router.get('/dashboard', getDashboard);
router.get('/bootstrap-status', getAdminBootstrapStatus);
router.get('/pending-badges', getPendingAdminBadges);

// EKYC
router.get('/ekyc/pending', getPendingEKYC);
router.get('/ekyc/:workerId', getWorkerEKYCDetails);
router.post('/ekyc/:workerId/approve', mutationGuard, approveWorker);
router.post('/ekyc/:workerId/reject', mutationGuard, rejectWorker);
router.post('/ekyc/:workerId/capture', saveEkycCapture);

// Withdrawals
router.get('/withdrawals', getWithdrawals);
router.post('/withdrawals/:id/complete', mutationGuard, completeWithdrawal);
router.post('/withdrawals/:id/decline', mutationGuard, declineWithdrawal);

// Categories
router.get('/categories', getCategories);
router.post('/categories', mutationGuard, uploadSingle, createCategory);
router.put('/categories/:id', mutationGuard, uploadSingle, updateCategory);
router.put('/categories/:id/details', mutationGuard, updateCategoryDetails);
router.delete('/categories/:id', mutationGuard, deleteCategory);

// Banners
router.get('/banners', getBanners);
router.post('/banners', mutationGuard, uploadSingle, createBanner);
router.post('/banners/reorder', mutationGuard, reorderBanners);
router.put('/banners/:id', mutationGuard, uploadSingle, updateBanner);
router.delete('/banners/:id', mutationGuard, deleteBanner);

// Customers
router.get('/customers', getCustomers);

// Commissions
router.get('/commissions', getCommissions);

// Worker Dues
router.get('/worker-dues', getWorkerDues);
router.post('/worker-dues/:workerId/notify', mutationGuard, notifyWorkerDues);

// Help Tickets
router.get('/help-tickets', getHelpTickets);
router.post('/help-tickets/:id/resolve', mutationGuard, resolveHelpTicket);
router.post('/help-tickets/:id/reply', mutationGuard, replyHelpTicket);

// Refunds
router.get('/refunds', getRefunds);
router.post('/refunds/:bookingId/process', mutationGuard, processRefund);
router.post('/refunds/:bookingId/reject', mutationGuard, rejectRefund);

// Chatbot QA
router.get('/chatbot-qa', getChatbotQA);
router.post('/chatbot-qa', mutationGuard, createChatbotQA);
router.put('/chatbot-qa/:id', mutationGuard, updateChatbotQA);
router.delete('/chatbot-qa/:id', mutationGuard, deleteChatbotQA);

// Cash payments
router.get('/cash-payments', getCashPayments);

// Workers
router.get('/workers', getAllWorkers);
router.get('/workers/:id', getWorkerDetail);

// Notifications
router.get('/notifications', getAdminNotifications);
router.patch('/notifications/:id/read', markAdminNotificationRead);
router.patch('/notifications/read-all', markAllAdminNotificationsRead);
router.delete('/notifications/:id', deleteAdminNotification);

export default router;
