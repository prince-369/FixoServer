import { Router } from 'express';
import { protect, authorize, verifyUser } from '../middlewares/auth.middleware';
import { handleValidationErrors } from '../middlewares/error.middleware';
import { idempotencyGuard } from '../middlewares/idempotency.middleware';
import { createBookingValidation } from '../utils/validators';
import {
  createBooking,
  getBookingBids,
  acceptBid,
  initiatePayment,
  verifyBookingPayment,
  handleRazorpayWebhook,
} from '../controllers/booking.controller';

const router = Router();
const mutationGuard = idempotencyGuard(20_000);

// Public webhook endpoint (no auth) for server-side payment reconciliation.
router.post('/webhook/razorpay', handleRazorpayWebhook);

router.use(protect, authorize('customer'), verifyUser);

router.post('/', createBookingValidation, handleValidationErrors, mutationGuard, createBooking);
router.get('/:id/bids', getBookingBids);
router.post('/:id/bids/:bidId/accept', mutationGuard, acceptBid);
router.post('/:id/payment', mutationGuard, initiatePayment);
router.post('/:id/payment/verify', mutationGuard, verifyBookingPayment);

export default router;
