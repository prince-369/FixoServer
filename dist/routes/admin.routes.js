"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const permission_middleware_1 = require("../middlewares/permission.middleware");
const upload_middleware_1 = require("../middlewares/upload.middleware");
const idempotency_middleware_1 = require("../middlewares/idempotency.middleware");
const staff_controller_1 = require("../controllers/staff.controller");
const admin_controller_1 = require("../controllers/admin.controller");
const incentiveAdmin_controller_1 = require("../controllers/incentiveAdmin.controller");
const router = (0, express_1.Router)();
const mutationGuard = (0, idempotency_middleware_1.idempotencyGuard)(20000);
router.use(auth_middleware_1.protect, (0, auth_middleware_1.authorize)('admin'));
// ─── Staff Management (Super Admin only) ───
router.get('/staff/meta', permission_middleware_1.requireSuperAdmin, staff_controller_1.getStaffMeta);
router.get('/staff/activity', permission_middleware_1.requireSuperAdmin, staff_controller_1.getStaffActivity);
router.get('/staff', permission_middleware_1.requireSuperAdmin, staff_controller_1.listStaff);
router.post('/staff', permission_middleware_1.requireSuperAdmin, mutationGuard, staff_controller_1.createStaff);
router.put('/staff/:id', permission_middleware_1.requireSuperAdmin, mutationGuard, staff_controller_1.updateStaff);
router.delete('/staff/:id', permission_middleware_1.requireSuperAdmin, staff_controller_1.deleteStaff);
// ─── Per-section permission gates (super admin always passes) ───
router.use('/dashboard', (0, permission_middleware_1.requirePermission)('dashboard'));
router.use('/ekyc', (0, permission_middleware_1.requirePermission)('kyc'));
router.use('/withdrawals', (0, permission_middleware_1.requirePermission)('withdrawals'));
router.use('/categories', (0, permission_middleware_1.requirePermission)('categories'));
router.use('/banners', (0, permission_middleware_1.requirePermission)('banners'));
router.use('/customers', (0, permission_middleware_1.requirePermission)('customers'));
router.use('/help-tickets', (0, permission_middleware_1.requirePermission)('support_customer', 'support_worker'));
router.use('/refunds', (0, permission_middleware_1.requirePermission)('refunds'));
router.use('/chatbot-qa', (0, permission_middleware_1.requirePermission)('chatbot'));
router.use('/workers', (0, permission_middleware_1.requirePermission)('workers'));
router.use('/coupons', (0, permission_middleware_1.requirePermission)('coupons'));
router.use('/coupon-redemptions', (0, permission_middleware_1.requirePermission)('coupons', 'analytics'));
router.use('/promotions', (0, permission_middleware_1.requirePermission)('promotions'));
router.use('/reward-milestones', (0, permission_middleware_1.requirePermission)('incentives'));
router.use('/reward-claims', (0, permission_middleware_1.requirePermission)('reward_claims'));
router.use('/incentive-analytics', (0, permission_middleware_1.requirePermission)('analytics', 'incentives'));
// Dashboard
router.get('/dashboard', admin_controller_1.getDashboard);
router.get('/bootstrap-status', admin_controller_1.getAdminBootstrapStatus);
router.get('/pending-badges', admin_controller_1.getPendingAdminBadges);
// EKYC
router.get('/ekyc/pending', admin_controller_1.getPendingEKYC);
router.get('/ekyc/:workerId', admin_controller_1.getWorkerEKYCDetails);
router.post('/ekyc/:workerId/video-result', mutationGuard, admin_controller_1.updateVideoKycResult);
router.post('/ekyc/:workerId/approve', mutationGuard, admin_controller_1.approveWorker);
router.post('/ekyc/:workerId/reject', mutationGuard, admin_controller_1.rejectWorker);
router.post('/ekyc/:workerId/capture', admin_controller_1.saveEkycCapture);
// Withdrawals
router.get('/withdrawals', admin_controller_1.getWithdrawals);
router.post('/withdrawals/:id/complete', mutationGuard, admin_controller_1.completeWithdrawal);
router.post('/withdrawals/:id/decline', mutationGuard, admin_controller_1.declineWithdrawal);
// Categories
router.get('/categories', admin_controller_1.getCategories);
router.post('/categories', mutationGuard, upload_middleware_1.uploadSingle, admin_controller_1.createCategory);
router.put('/categories/:id', mutationGuard, upload_middleware_1.uploadSingle, admin_controller_1.updateCategory);
router.put('/categories/:id/details', mutationGuard, admin_controller_1.updateCategoryDetails);
router.delete('/categories/:id', mutationGuard, admin_controller_1.deleteCategory);
// Banners
router.get('/banners', admin_controller_1.getBanners);
router.post('/banners', mutationGuard, upload_middleware_1.uploadSingle, admin_controller_1.createBanner);
router.post('/banners/reorder', mutationGuard, admin_controller_1.reorderBanners);
router.put('/banners/:id', mutationGuard, upload_middleware_1.uploadSingle, admin_controller_1.updateBanner);
router.delete('/banners/:id', mutationGuard, admin_controller_1.deleteBanner);
// Customers (gated by the /customers path-permission above)
router.get('/customers', admin_controller_1.getCustomers);
// Help Tickets
router.get('/help-tickets', admin_controller_1.getHelpTickets);
router.post('/help-tickets/:id/resolve', mutationGuard, admin_controller_1.resolveHelpTicket);
router.post('/help-tickets/:id/reply', mutationGuard, admin_controller_1.replyHelpTicket);
// Refunds
router.get('/refunds', admin_controller_1.getRefunds);
router.post('/refunds/:bookingId/process', mutationGuard, admin_controller_1.processRefund);
router.post('/refunds/:bookingId/reject', mutationGuard, admin_controller_1.rejectRefund);
// Chatbot QA
router.get('/chatbot-qa', admin_controller_1.getChatbotQA);
router.post('/chatbot-qa', mutationGuard, admin_controller_1.createChatbotQA);
router.put('/chatbot-qa/:id', mutationGuard, admin_controller_1.updateChatbotQA);
router.delete('/chatbot-qa/:id', mutationGuard, admin_controller_1.deleteChatbotQA);
// Workers (gated by the /workers path-permission above)
router.get('/workers', admin_controller_1.getAllWorkers);
router.get('/workers/:id', admin_controller_1.getWorkerDetail);
// ─── Cancellation moderation (customer-side and worker-side permissions) ───
router.get('/moderation/flags', (0, permission_middleware_1.requirePermission)('moderation_customer', 'moderation_worker'), admin_controller_1.getCancellationFlags);
router.post('/moderation/customer/:id/block', (0, permission_middleware_1.requirePermission)('moderation_customer'), mutationGuard, admin_controller_1.blockCustomer);
router.post('/moderation/customer/:id/unblock', (0, permission_middleware_1.requirePermission)('moderation_customer'), mutationGuard, admin_controller_1.unblockCustomer);
router.post('/moderation/worker/:id/block', (0, permission_middleware_1.requirePermission)('moderation_worker'), mutationGuard, admin_controller_1.blockWorkerAccount);
router.post('/moderation/worker/:id/unblock', (0, permission_middleware_1.requirePermission)('moderation_worker'), mutationGuard, admin_controller_1.unblockWorkerAccount);
// ─── Admin push / broadcast notifications (per-audience permission) ───
const requireNotifyPerm = (req, res, next) => (0, permission_middleware_1.requirePermission)(req.params.audience === 'worker' ? 'notify_worker' : 'notify_customer')(req, res, next);
router.get('/push/:audience/recipients', requireNotifyPerm, admin_controller_1.searchNotificationRecipients);
router.post('/push/:audience/broadcast', requireNotifyPerm, mutationGuard, admin_controller_1.broadcastNotification);
router.post('/push/:audience/personal', requireNotifyPerm, mutationGuard, admin_controller_1.personalNotification);
// ─── Service-area waitlist (customer-side) ───
router.get('/waitlist', (0, permission_middleware_1.requirePermission)('customers'), admin_controller_1.getWaitlist);
router.post('/waitlist/:id/reached', (0, permission_middleware_1.requirePermission)('customers'), mutationGuard, admin_controller_1.markWaitlistReached);
// ─── Worker skill review (worker-side) ───
router.get('/skill-requests', (0, permission_middleware_1.requirePermission)('skill_review'), admin_controller_1.getSkillRequests);
router.post('/skill-requests/:workerId/:skillId/decision', (0, permission_middleware_1.requirePermission)('skill_review'), mutationGuard, admin_controller_1.reviewSkill);
router.post('/skill-requests/:workerId/:skillId/call-attempt', (0, permission_middleware_1.requirePermission)('skill_review'), mutationGuard, admin_controller_1.logSkillCallAttempt);
// ── Incentives: Coupons ──
router.get('/coupons', incentiveAdmin_controller_1.adminListCoupons);
router.post('/coupons', mutationGuard, incentiveAdmin_controller_1.adminCreateCoupon);
router.put('/coupons/:id', mutationGuard, incentiveAdmin_controller_1.adminUpdateCoupon);
router.post('/coupons/:id/toggle', mutationGuard, incentiveAdmin_controller_1.adminToggleCoupon);
router.delete('/coupons/:id', mutationGuard, incentiveAdmin_controller_1.adminDeleteCoupon);
// ── Incentives: Worker Promotions ──
router.get('/promotions', incentiveAdmin_controller_1.adminListPromotions);
router.post('/promotions', mutationGuard, incentiveAdmin_controller_1.adminCreatePromotion);
router.put('/promotions/:id', mutationGuard, incentiveAdmin_controller_1.adminUpdatePromotion);
router.post('/promotions/:id/toggle', mutationGuard, incentiveAdmin_controller_1.adminTogglePromotion);
router.delete('/promotions/:id', mutationGuard, incentiveAdmin_controller_1.adminDeletePromotion);
// ── Incentives: Reward Milestones ──
router.get('/reward-milestones', incentiveAdmin_controller_1.adminListMilestones);
router.post('/reward-milestones', mutationGuard, incentiveAdmin_controller_1.adminUpsertMilestone);
router.put('/reward-milestones/:id', mutationGuard, incentiveAdmin_controller_1.adminUpdateMilestone);
// ── Incentives: Reward Claims ──
router.get('/reward-claims', incentiveAdmin_controller_1.adminListRewardClaims);
router.post('/reward-claims/:id/approve', mutationGuard, incentiveAdmin_controller_1.adminApproveRewardClaim);
router.post('/reward-claims/:id/reject', mutationGuard, incentiveAdmin_controller_1.adminRejectRewardClaim);
// ── Incentives: Analytics ──
router.get('/incentive-analytics', incentiveAdmin_controller_1.adminIncentiveAnalytics);
router.get('/coupon-redemptions', incentiveAdmin_controller_1.adminListCouponRedemptions);
// Notifications
router.get('/notifications', admin_controller_1.getAdminNotifications);
router.patch('/notifications/:id/read', admin_controller_1.markAdminNotificationRead);
router.patch('/notifications/read-all', admin_controller_1.markAllAdminNotificationsRead);
router.delete('/notifications/:id', admin_controller_1.deleteAdminNotification);
exports.default = router;
//# sourceMappingURL=admin.routes.js.map