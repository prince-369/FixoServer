"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const error_middleware_1 = require("../middlewares/error.middleware");
const idempotency_middleware_1 = require("../middlewares/idempotency.middleware");
const validators_1 = require("../utils/validators");
const booking_controller_1 = require("../controllers/booking.controller");
const router = (0, express_1.Router)();
const mutationGuard = (0, idempotency_middleware_1.idempotencyGuard)(20000);
router.use(auth_middleware_1.protect, (0, auth_middleware_1.authorize)('customer'));
router.post('/', validators_1.createBookingValidation, error_middleware_1.handleValidationErrors, mutationGuard, booking_controller_1.createBooking);
router.get('/:id/bids', booking_controller_1.getBookingBids);
router.post('/:id/bids/:bidId/accept', mutationGuard, booking_controller_1.acceptBid);
router.post('/:id/payment', mutationGuard, booking_controller_1.initiatePayment);
router.post('/:id/payment/verify', mutationGuard, booking_controller_1.verifyBookingPayment);
exports.default = router;
//# sourceMappingURL=booking.routes.js.map