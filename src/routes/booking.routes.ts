import { Router } from 'express';
import { protect, authorize, verifyUser } from '../middlewares/auth.middleware';
import { handleValidationErrors } from '../middlewares/error.middleware';
import { idempotencyGuard } from '../middlewares/idempotency.middleware';
import { uploadBookingVoice } from '../middlewares/upload.middleware';
import { createBookingValidation } from '../utils/validators';
import {
  createBooking,
  getWorkerAvailabilitySummary,
  getBookingBids,
  acceptBid,
  initiatePayment,
  verifyBookingPayment,
  reconcileBookingPayment,
  handleRazorpayWebhook,
} from '../controllers/booking.controller';

const router = Router();
const mutationGuard = idempotencyGuard(20_000);

// Public webhook endpoint (no auth) for server-side payment reconciliation.
router.post('/webhook/razorpay', handleRazorpayWebhook);

router.use(protect, authorize('customer'), verifyUser);

router.post('/', uploadBookingVoice, createBookingValidation, handleValidationErrors, mutationGuard, createBooking);
router.get('/workers/availability-summary', getWorkerAvailabilitySummary);
router.get('/:id/bids', getBookingBids);
router.post('/:id/bids/:bidId/accept', mutationGuard, acceptBid);
router.post('/:id/payment', mutationGuard, initiatePayment);
router.post('/:id/payment/verify', mutationGuard, verifyBookingPayment);
router.post('/:id/payment/reconcile', reconcileBookingPayment);

export default router;
