"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const upload_middleware_1 = require("../middlewares/upload.middleware");
const idempotency_middleware_1 = require("../middlewares/idempotency.middleware");
const customer_controller_1 = require("../controllers/customer.controller");
const router = (0, express_1.Router)();
const mutationGuard = (0, idempotency_middleware_1.idempotencyGuard)(15000);
// Public routes
router.get('/categories', customer_controller_1.getCategories);
router.get('/categories/:id', customer_controller_1.getCategoryDetail);
router.get('/banners', customer_controller_1.getBanners);
// Protected customer routes
router.use(auth_middleware_1.protect, (0, auth_middleware_1.authorize)('customer'), auth_middleware_1.verifyUser);
router.get('/profile', customer_controller_1.getProfile);
router.put('/profile', upload_middleware_1.uploadSingle, customer_controller_1.updateProfile);
router.post('/account/deactivation/send-otp', mutationGuard, customer_controller_1.sendDeactivateAccountOtp);
router.post('/account/deactivation/confirm', mutationGuard, customer_controller_1.confirmDeactivateAccount);
router.get('/bookings', customer_controller_1.getBookings);
router.get('/bookings/:id', customer_controller_1.getBookingDetail);
router.get('/transactions', customer_controller_1.getTransactions);
router.post('/bookings/:id/cancel', mutationGuard, customer_controller_1.cancelBooking);
router.post('/bookings/:id/reveal-completion-code', mutationGuard, customer_controller_1.revealCompletionCode);
router.post('/bookings/:id/refund-details', mutationGuard, customer_controller_1.submitRefundDetails);
router.post('/bookings/:id/review', mutationGuard, customer_controller_1.submitReview);
router.get('/notifications', customer_controller_1.getNotifications);
router.patch('/notifications/:id/read', customer_controller_1.markNotificationRead);
router.patch('/notifications/read-all', customer_controller_1.markAllNotificationsRead);
router.delete('/notifications/:id', customer_controller_1.deleteNotification);
// Chatbot QA (public-ish, but behind auth for user context)
router.get('/chatbot-qa', customer_controller_1.getChatbotQA);
// Help Tickets
router.post('/help-tickets', mutationGuard, customer_controller_1.createHelpTicket);
router.get('/help-tickets', customer_controller_1.getHelpTickets);
router.get('/help-tickets/:id', customer_controller_1.getHelpTicketDetail);
router.post('/help-tickets/:id/message', mutationGuard, customer_controller_1.appendHelpTicketMessage);
router.post('/help-tickets/:id/escalate', mutationGuard, customer_controller_1.escalateHelpTicket);
exports.default = router;
//# sourceMappingURL=customer.routes.js.map