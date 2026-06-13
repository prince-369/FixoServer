"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const upload_middleware_1 = require("../middlewares/upload.middleware");
const idempotency_middleware_1 = require("../middlewares/idempotency.middleware");
const admin_controller_1 = require("../controllers/admin.controller");
const incentiveAdmin_controller_1 = require("../controllers/incentiveAdmin.controller");
const router = (0, express_1.Router)();
const mutationGuard = (0, idempotency_middleware_1.idempotencyGuard)(20000);
router.use(auth_middleware_1.protect, (0, auth_middleware_1.authorize)('admin'));
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
// Customers
router.get('/customers', admin_controller_1.getCustomers);
// Commissions
router.get('/commissions', admin_controller_1.getCommissions);
// Worker Dues
router.get('/worker-dues', admin_controller_1.getWorkerDues);
router.post('/worker-dues/:workerId/notify', mutationGuard, admin_controller_1.notifyWorkerDues);
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
// Cash payments
router.get('/cash-payments', admin_controller_1.getCashPayments);
// Workers
router.get('/workers', admin_controller_1.getAllWorkers);
router.get('/workers/:id', admin_controller_1.getWorkerDetail);
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