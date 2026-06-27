import { Router } from 'express';
import { protect, authorize } from '../middlewares/auth.middleware';
import { requirePermission, requireSuperAdmin } from '../middlewares/permission.middleware';
import { uploadSingle } from '../middlewares/upload.middleware';
import { idempotencyGuard } from '../middlewares/idempotency.middleware';
import {
  getStaffMeta, listStaff, createStaff, updateStaff, deleteStaff, getStaffActivity,
} from '../controllers/staff.controller';
import {
  getDashboard,
  getAdminBootstrapStatus,
  getPendingAdminBadges,
  getPendingEKYC,
  getWorkerEKYCDetails,
  updateVideoKycResult,
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
  getHelpTickets,
  resolveHelpTicket,
  replyHelpTicket,
  getChatbotQA,
  createChatbotQA,
  updateChatbotQA,
  deleteChatbotQA,
  processRefund,
  getRefunds,
  rejectRefund,
  getAllWorkers,
  getWorkerDetail,
  blockCustomer,
  unblockCustomer,
  blockWorkerAccount,
  unblockWorkerAccount,
  getCancellationFlags,
  broadcastNotification,
  personalNotification,
  searchNotificationRecipients,
  getWaitlist,
  markWaitlistReached,
  getSkillRequests,
  reviewSkill,
  logSkillCallAttempt,
  getAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
  deleteAdminNotification,
} from '../controllers/admin.controller';
import {
  adminListCoupons,
  adminCreateCoupon,
  adminUpdateCoupon,
  adminToggleCoupon,
  adminDeleteCoupon,
  adminListPromotions,
  adminCreatePromotion,
  adminUpdatePromotion,
  adminTogglePromotion,
  adminDeletePromotion,
  adminListMilestones,
  adminUpsertMilestone,
  adminUpdateMilestone,
  adminListRewardClaims,
  adminApproveRewardClaim,
  adminRejectRewardClaim,
  adminIncentiveAnalytics,
  adminListCouponRedemptions,
} from '../controllers/incentiveAdmin.controller';

const router = Router();
const mutationGuard = idempotencyGuard(20_000);

router.use(protect, authorize('admin'));

// ─── Staff Management (Super Admin only) ───
router.get('/staff/meta', requireSuperAdmin, getStaffMeta);
router.get('/staff/activity', requireSuperAdmin, getStaffActivity);
router.get('/staff', requireSuperAdmin, listStaff);
router.post('/staff', requireSuperAdmin, mutationGuard, createStaff);
router.put('/staff/:id', requireSuperAdmin, mutationGuard, updateStaff);
router.delete('/staff/:id', requireSuperAdmin, deleteStaff);

// ─── Per-section permission gates (super admin always passes) ───
router.use('/dashboard', requirePermission('dashboard'));
router.use('/ekyc', requirePermission('kyc'));
router.use('/withdrawals', requirePermission('withdrawals'));
router.use('/categories', requirePermission('categories'));
router.use('/banners', requirePermission('banners'));
router.use('/customers', requirePermission('customers'));
router.use('/help-tickets', requirePermission('support_customer', 'support_worker'));
router.use('/refunds', requirePermission('refunds'));
router.use('/chatbot-qa', requirePermission('chatbot'));
router.use('/workers', requirePermission('workers'));
router.use('/coupons', requirePermission('coupons'));
router.use('/coupon-redemptions', requirePermission('coupons', 'analytics'));
router.use('/promotions', requirePermission('promotions'));
router.use('/reward-milestones', requirePermission('incentives'));
router.use('/reward-claims', requirePermission('reward_claims'));
router.use('/incentive-analytics', requirePermission('analytics', 'incentives'));

// Dashboard
router.get('/dashboard', getDashboard);
router.get('/bootstrap-status', getAdminBootstrapStatus);
router.get('/pending-badges', getPendingAdminBadges);

// EKYC
router.get('/ekyc/pending', getPendingEKYC);
router.get('/ekyc/:workerId', getWorkerEKYCDetails);
router.post('/ekyc/:workerId/video-result', mutationGuard, updateVideoKycResult);
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

// Customers (gated by the /customers path-permission above)
router.get('/customers', getCustomers);

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

// Workers (gated by the /workers path-permission above)
router.get('/workers', getAllWorkers);
router.get('/workers/:id', getWorkerDetail);

// ─── Cancellation moderation (customer-side and worker-side permissions) ───
router.get('/moderation/flags', requirePermission('moderation_customer', 'moderation_worker'), getCancellationFlags);
router.post('/moderation/customer/:id/block', requirePermission('moderation_customer'), mutationGuard, blockCustomer);
router.post('/moderation/customer/:id/unblock', requirePermission('moderation_customer'), mutationGuard, unblockCustomer);
router.post('/moderation/worker/:id/block', requirePermission('moderation_worker'), mutationGuard, blockWorkerAccount);
router.post('/moderation/worker/:id/unblock', requirePermission('moderation_worker'), mutationGuard, unblockWorkerAccount);

// ─── Admin push / broadcast notifications (per-audience permission) ───
const requireNotifyPerm = (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) =>
  requirePermission(req.params.audience === 'worker' ? 'notify_worker' : 'notify_customer')(req, res, next);
router.get('/push/:audience/recipients', requireNotifyPerm, searchNotificationRecipients);
router.post('/push/:audience/broadcast', requireNotifyPerm, mutationGuard, broadcastNotification);
router.post('/push/:audience/personal', requireNotifyPerm, mutationGuard, personalNotification);

// ─── Service-area waitlist (customer-side) ───
router.get('/waitlist', requirePermission('customers'), getWaitlist);
router.post('/waitlist/:id/reached', requirePermission('customers'), mutationGuard, markWaitlistReached);

// ─── Worker skill review (worker-side) ───
router.get('/skill-requests', requirePermission('skill_review'), getSkillRequests);
router.post('/skill-requests/:workerId/:skillId/decision', requirePermission('skill_review'), mutationGuard, reviewSkill);
router.post('/skill-requests/:workerId/:skillId/call-attempt', requirePermission('skill_review'), mutationGuard, logSkillCallAttempt);

// ── Incentives: Coupons ──
router.get('/coupons', adminListCoupons);
router.post('/coupons', mutationGuard, adminCreateCoupon);
router.put('/coupons/:id', mutationGuard, adminUpdateCoupon);
router.post('/coupons/:id/toggle', mutationGuard, adminToggleCoupon);
router.delete('/coupons/:id', mutationGuard, adminDeleteCoupon);

// ── Incentives: Worker Promotions ──
router.get('/promotions', adminListPromotions);
router.post('/promotions', mutationGuard, adminCreatePromotion);
router.put('/promotions/:id', mutationGuard, adminUpdatePromotion);
router.post('/promotions/:id/toggle', mutationGuard, adminTogglePromotion);
router.delete('/promotions/:id', mutationGuard, adminDeletePromotion);

// ── Incentives: Reward Milestones ──
router.get('/reward-milestones', adminListMilestones);
router.post('/reward-milestones', mutationGuard, adminUpsertMilestone);
router.put('/reward-milestones/:id', mutationGuard, adminUpdateMilestone);

// ── Incentives: Reward Claims ──
router.get('/reward-claims', adminListRewardClaims);
router.post('/reward-claims/:id/approve', mutationGuard, adminApproveRewardClaim);
router.post('/reward-claims/:id/reject', mutationGuard, adminRejectRewardClaim);

// ── Incentives: Analytics ──
router.get('/incentive-analytics', adminIncentiveAnalytics);
router.get('/coupon-redemptions', adminListCouponRedemptions);

// Notifications
router.get('/notifications', getAdminNotifications);
router.patch('/notifications/:id/read', markAdminNotificationRead);
router.patch('/notifications/read-all', markAllAdminNotificationsRead);
router.delete('/notifications/:id', deleteAdminNotification);

export default router;
