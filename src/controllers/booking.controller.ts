import { Request, Response } from 'express';
import Booking from '../models/Booking';
import WorkBid from '../models/WorkBid';
import Worker from '../models/Worker';
import Notification from '../models/Notification';
import { createOrder, fetchSuccessfulPaymentForOrder, verifyPayment, verifyWebhookSignature } from '../services/payment.service';
import { uploadAudioBufferToCloudinary } from '../services/cloudinary.service';
import { generatePin } from '../utils/generatePin';
import { generateTID } from '../utils/generateTID';
import Transaction from '../models/Transaction';
import { notifyWorkers, notifyUser, sendNotification, sendAdminNotification } from '../socket';

const RAZORPAY_SUCCESS_EVENTS = new Set(['payment.captured', 'order.paid']);

interface RazorpayWebhookBody {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        status?: string;
      };
    };
    order?: {
      entity?: {
        id?: string;
      };
    };
  };
}

const WORKER_SEARCH_RADIUS_METERS = 10_000;
const WORKER_SUMMARY_RADIUS_METERS = 25_000;

const hasValidCoordinates = (coordinates: unknown): coordinates is [number, number] => {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) return false;
  return Number.isFinite(Number(coordinates[0])) && Number.isFinite(Number(coordinates[1]));
};

const toRadians = (value: number): number => (value * Math.PI) / 180;

const distanceMetersBetween = (a: [number, number], b: [number, number]): number => {
  // Coordinates are [longitude, latitude]
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const earthRadiusMeters = 6_371_000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);

  const haversine =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLng / 2) ** 2;

  const arc = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return earthRadiusMeters * arc;
};

const isGeoIndexMissingError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return (
    message.includes('$geonear') ||
    message.includes('unable to find index') ||
    message.includes('2dsphere index')
  );
};

const findNearbyWorkers = async (categoryId: string, coordinates: [number, number]) => {
  return Worker.find({
    accountStatus: 'live',
    isActive: true,
    categories: categoryId,
    location: {
      $nearSphere: {
        $geometry: {
          type: 'Point',
          coordinates,
        },
        $maxDistance: WORKER_SEARCH_RADIUS_METERS,
      },
    },
  }).select('_id fullName');
};

const resolveMatchingWorkers = async (categoryId: string, coordinates: [number, number]) => {
  try {
    return await findNearbyWorkers(categoryId, coordinates);
  } catch (error) {
    if (!isGeoIndexMissingError(error)) {
      throw error;
    }

    console.error('Geo index missing for worker location. Attempting self-heal.', error);

    try {
      await Worker.collection.createIndex(
        { location: '2dsphere' },
        { name: 'location_2dsphere' }
      );
      return await findNearbyWorkers(categoryId, coordinates);
    } catch (retryError) {
      console.error('Geo index self-heal failed. Proceeding without worker notifications.', retryError);
      return [];
    }
  }
};

const fetchWorkerAvailabilitySummary = async (
  categoryId: string,
  coordinates: [number, number]
): Promise<{ total: number; active: number; radiusMeters: number }> => {
  const nearbyFilter = {
    categories: categoryId,
    location: {
      $nearSphere: {
        $geometry: {
          type: 'Point',
          coordinates,
        },
        $maxDistance: WORKER_SUMMARY_RADIUS_METERS,
      },
    },
  };

  const [total, active] = await Promise.all([
    Worker.countDocuments(nearbyFilter),
    Worker.countDocuments({ ...nearbyFilter, isActive: true, accountStatus: 'live' }),
  ]);

  return { total, active, radiusMeters: WORKER_SUMMARY_RADIUS_METERS };
};

const computeWorkerAvailabilitySummaryFallback = async (
  categoryId: string,
  targetCoordinates: [number, number]
): Promise<{ total: number; active: number; radiusMeters: number }> => {
  const workers = await Worker.find({ categories: categoryId })
    .select('location isActive accountStatus')
    .lean();

  let total = 0;
  let active = 0;

  for (const worker of workers) {
    const coordinates = worker?.location?.coordinates;
    if (!hasValidCoordinates(coordinates)) continue;

    const workerCoordinates: [number, number] = [Number(coordinates[0]), Number(coordinates[1])];
    const distance = distanceMetersBetween(workerCoordinates, targetCoordinates);

    if (distance > WORKER_SUMMARY_RADIUS_METERS) continue;

    total += 1;
    if (worker.isActive === true && worker.accountStatus === 'live') {
      active += 1;
    }
  }

  return { total, active, radiusMeters: WORKER_SUMMARY_RADIUS_METERS };
};

const resolveWorkerAvailabilitySummary = async (
  categoryId: string,
  coordinates: [number, number]
): Promise<{ total: number; active: number; radiusMeters: number }> => {
  try {
    return await fetchWorkerAvailabilitySummary(categoryId, coordinates);
  } catch (error) {
    if (!isGeoIndexMissingError(error)) {
      console.error('Primary availability summary query failed. Falling back to manual distance scan.', error);
      return computeWorkerAvailabilitySummaryFallback(categoryId, coordinates);
    }

    console.error('Geo index missing while fetching worker availability summary. Attempting self-heal.', error);

    try {
      await Worker.collection.createIndex(
        { location: '2dsphere' },
        { name: 'location_2dsphere' }
      );

      return await fetchWorkerAvailabilitySummary(categoryId, coordinates);
    } catch (retryError) {
      console.error('Geo index self-heal failed while fetching worker availability summary. Falling back to manual distance scan.', retryError);
      return computeWorkerAvailabilitySummaryFallback(categoryId, coordinates);
    }
  }
};

// ─── Worker Availability Summary (Customer Preview) ───
export const getWorkerAvailabilitySummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const categoryId = String(req.query.category || '').trim();
    const latitude = Number(req.query.latitude);
    const longitude = Number(req.query.longitude);

    if (!categoryId) {
      res.status(400).json({ message: 'Category is required' });
      return;
    }

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      res.status(400).json({ message: 'Valid latitude and longitude are required' });
      return;
    }

    const coordinates: [number, number] = [longitude, latitude];
    const summary = await resolveWorkerAvailabilitySummary(categoryId, coordinates);

    res.json({
      summary: {
        total: summary.total,
        active: summary.active,
        inactive: Math.max(0, summary.total - summary.active),
        radiusMeters: summary.radiusMeters,
      },
    });
  } catch (error) {
    console.error('Get worker availability summary error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const finalizeOnlineBookingPayment = async (
  booking: any,
  orderId: string,
  paymentId: string
): Promise<{ alreadyFinalized: boolean }> => {
  const alreadyFinalized = booking.paymentStatus === 'paid' && booking.status === 'payment_done';

  booking.razorpayOrderId = orderId;
  booking.razorpayPaymentId = paymentId;
  booking.paymentStatus = 'paid';
  booking.status = 'payment_done';
  if (!booking.completionPin) {
    booking.completionPin = generatePin();
  }
  booking.completionRequestedByWorkerAt = undefined;
  booking.completionCodeRevealedAt = undefined;
  await booking.save();

  const existingPayment = await Transaction.findOne({
    booking: booking._id,
    type: 'booking_payment',
    method: 'online',
  });

  if (existingPayment) {
    existingPayment.user = booking.customer;
    existingPayment.worker = booking.assignedWorker;
    existingPayment.amount = booking.amount;
    existingPayment.razorpayPaymentId = paymentId;
    existingPayment.razorpayOrderId = orderId;
    existingPayment.status = 'completed';
    await existingPayment.save();
  } else {
    await Transaction.create({
      tid: generateTID(),
      booking: booking._id,
      user: booking.customer,
      worker: booking.assignedWorker,
      type: 'booking_payment',
      amount: booking.amount,
      method: 'online',
      razorpayPaymentId: paymentId,
      razorpayOrderId: orderId,
      status: 'completed',
    });
  }

  if (!alreadyFinalized && booking.assignedWorker) {
    const customerId = booking.customer.toString();
    const bookingStatusPayload = {
      bookingId: booking._id,
      status: 'payment_done',
      paymentStatus: booking.paymentStatus,
      paymentMethod: 'online',
    };

    notifyUser(booking.assignedWorker.toString(), 'booking_status_updated', bookingStatusPayload);
    notifyUser(customerId, 'booking_status_updated', bookingStatusPayload);
    await sendNotification({
      recipientId: booking.assignedWorker.toString(),
      recipientModel: 'Worker',
      type: 'payment_success',
      title: 'Payment Received (Online)',
      message: 'Online payment completed. You can proceed to the location.',
      data: { bookingId: booking._id },
    });
  }

  return { alreadyFinalized };
};

const reconcileBookingPaymentByOrder = async (
  booking: any,
  requestedOrderId?: string
): Promise<{ reconciled: boolean; alreadyFinalized: boolean; paymentId?: string }> => {
  const orderId = String(requestedOrderId || booking.razorpayOrderId || '');
  if (!orderId) {
    return { reconciled: false, alreadyFinalized: false };
  }

  if (booking.paymentStatus === 'paid' && booking.status === 'payment_done') {
    return {
      reconciled: true,
      alreadyFinalized: true,
      paymentId: booking.razorpayPaymentId || undefined,
    };
  }

  const successfulPayment = await fetchSuccessfulPaymentForOrder(orderId);
  if (!successfulPayment?.id) {
    return { reconciled: false, alreadyFinalized: false };
  }

  const { alreadyFinalized } = await finalizeOnlineBookingPayment(booking, orderId, successfulPayment.id);
  return {
    reconciled: true,
    alreadyFinalized,
    paymentId: successfulPayment.id,
  };
};

// ─── Create Booking ───
export const createBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, workDescription, latitude, longitude, address, timeSlot, voiceLanguage, voiceTranscript, voiceDurationSec } = req.body;

    const normalizedDescription = String(workDescription ?? '').trim();

    let voiceNote: {
      url: string;
      publicId: string;
      mimeType?: string;
      durationSec?: number;
      language?: string;
      transcript?: string;
      createdAt: Date;
    } | undefined;

    if (req.file) {
      const uploadedVoice = await uploadAudioBufferToCloudinary(req.file.buffer, 'booking-voice');
      const parsedDurationSec = Number(voiceDurationSec);

      voiceNote = {
        url: uploadedVoice.url,
        publicId: uploadedVoice.publicId,
        mimeType: req.file.mimetype,
        durationSec: Number.isFinite(parsedDurationSec) && parsedDurationSec > 0
          ? Math.round(parsedDurationSec)
          : undefined,
        language: typeof voiceLanguage === 'string' ? voiceLanguage.trim() : undefined,
        transcript: typeof voiceTranscript === 'string' && voiceTranscript.trim()
          ? voiceTranscript.trim()
          : undefined,
        createdAt: new Date(),
      };
    }

    const finalDescription = normalizedDescription || voiceNote?.transcript || 'Voice note attached by customer';

    const normalizedLatitude = Number(latitude);
    const normalizedLongitude = Number(longitude);
    if (!Number.isFinite(normalizedLatitude) || !Number.isFinite(normalizedLongitude)) {
      res.status(400).json({ message: 'Valid latitude and longitude are required' });
      return;
    }

    const coordinates: [number, number] = [normalizedLongitude, normalizedLatitude]; // MongoDB expects [lng, lat]

    const booking = await Booking.create({
      customer: req.user!.id,
      category,
      workDescription: finalDescription,
      voiceNote,
      customerLocation: {
        type: 'Point',
        coordinates,
        address,
      },
      timeSlot: timeSlot || 'anytime',
      status: 'finding_workers',
    });

    // Find matching active workers within 10km.
    // If lookup fails, keep booking successful and retry worker discovery later via ops.
    let matchingWorkers: Array<{ _id: { toString(): string }; fullName: string }> = [];
    try {
      matchingWorkers = await resolveMatchingWorkers(String(category), coordinates);
    } catch (workerLookupError) {
      console.error('Worker lookup failed after booking creation. Returning success without notifications.', workerLookupError);
    }

    const populated = await Booking.findById(booking._id)
      .populate('category', 'name slug image');

    // Real-time: Notify matching workers about new work request
    const workerIds = matchingWorkers.map((w) => w._id.toString());
    if (workerIds.length > 0) {
      notifyWorkers(workerIds, 'new_job_request', {
        booking: populated,
        bookingId: booking._id,
        status: booking.status,
        message: `New ${(populated?.category as any)?.name || 'service'} request nearby!`,
      });

      // Create notifications in DB + emit via socket
      await Promise.all(
        workerIds.map((wId) =>
          sendNotification({
            recipientId: wId,
            recipientModel: 'Worker',
            type: 'new_work_request',
            title: 'New Work Request',
            message: `New ${(populated?.category as any)?.name || 'service'} request: "${booking.workDescription.slice(0, 50)}"`,
            data: { bookingId: booking._id },
          })
        )
      );
    }

    res.status(201).json({
      message: `Booking created. ${matchingWorkers.length} workers notified.`,
      booking: populated,
      workersNotified: matchingWorkers.length,
    });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Get Bids for Booking ───
export const getBookingBids = async (req: Request, res: Response): Promise<void> => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      customer: req.user!.id,
    });

    if (!booking) {
      res.status(404).json({ message: 'Booking not found' });
      return;
    }

    const bids = await WorkBid.find({
      booking: req.params.id,
      status: 'pending',
    }).populate('worker', 'fullName profileImage rating bio regularPhone totalWorkDone isActive');

    // Filter out bids from inactive workers
    const activeBids = bids.filter((b: any) => b.worker && b.worker.isActive !== false);

    res.json({ bids: activeBids });
  } catch (error) {
    console.error('Get booking bids error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Accept Bid ───
export const acceptBid = async (req: Request, res: Response): Promise<void> => {
  try {
    const { bidId } = req.params;

    const bid = await WorkBid.findById(bidId).populate('worker', 'fullName phone profileImage');
    if (!bid) {
      res.status(404).json({ message: 'Bid not found' });
      return;
    }

    const booking = await Booking.findOne({
      _id: bid.booking,
      customer: req.user!.id,
      status: { $in: ['finding_workers', 'bids_received'] },
    });

    if (!booking) {
      res.status(400).json({ message: 'Cannot accept bid for this booking' });
      return;
    }

    // Accept this bid, reject others
    bid.status = 'accepted';
    await bid.save();

    await WorkBid.updateMany(
      { booking: booking._id, _id: { $ne: bidId } },
      { status: 'rejected' }
    );

    booking.status = 'worker_accepted';
    booking.acceptedBid = bid._id as any;
    booking.assignedWorker = bid.worker._id as any;
    booking.amount = bid.agreedAmount ?? bid.priceOffered;
    await booking.save();

    const populatedBooking = await Booking.findById(booking._id)
      .populate('category', 'name slug image')
      .populate('assignedWorker', 'fullName phone profileImage rating');

    // Real-time: Notify the accepted worker
    const workerId = (bid.worker._id || bid.worker).toString();
    const customerId = booking.customer.toString();
    notifyUser(workerId, 'booking_accepted', {
      booking: populatedBooking,
      bookingId: booking._id,
      status: booking.status,
      message: 'Your bid has been accepted! Please approve to proceed.',
    });
    notifyUser(customerId, 'booking_accepted', {
      booking: populatedBooking,
      bookingId: booking._id,
      status: booking.status,
      message: 'Worker bid accepted successfully.',
    });

    await sendNotification({
      recipientId: workerId,
      recipientModel: 'Worker',
      type: 'bid_accepted',
      title: 'Bid Accepted!',
      message: `Your bid of ₹${bid.priceOffered} was accepted by the customer.`,
      data: { bookingId: booking._id },
    });

    res.json({
      message: 'Bid accepted. Waiting for worker approval.',
      booking: populatedBooking,
    });
  } catch (error) {
    console.error('Accept bid error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Counter Bid (Customer negotiates) ───
export const counterBid = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: bookingId, bidId } = req.params;
    const { amount, message } = req.body;

    if (!amount || Number(amount) <= 0) {
      res.status(400).json({ message: 'A valid counter amount is required' });
      return;
    }

    const bid = await WorkBid.findById(bidId);
    if (!bid) {
      res.status(404).json({ message: 'Bid not found' });
      return;
    }

    const booking = await Booking.findOne({
      _id: bookingId,
      customer: req.user!.id,
      status: { $in: ['finding_workers', 'bids_received'] },
    });
    if (!booking) {
      res.status(400).json({ message: 'Cannot negotiate on this booking' });
      return;
    }

    if (!['none', 'worker_offered', 'declined'].includes(bid.negotiationStatus)) {
      res.status(400).json({ message: 'Cannot send counter offer at this stage' });
      return;
    }

    if (bid.negotiations.length >= 10) {
      res.status(400).json({ message: 'Maximum negotiation rounds reached' });
      return;
    }

    bid.negotiations.push({ by: 'customer', amount: Number(amount), message: message || '', createdAt: new Date() });
    bid.negotiationStatus = 'customer_offered';
    await bid.save();

    const workerId = bid.worker.toString();
    notifyUser(workerId, 'booking:bid-negotiation', { bookingId, bid });

    await sendNotification({
      recipientId: workerId,
      recipientModel: 'Worker',
      type: 'new_message',
      title: 'Customer Counter Offer',
      message: `Customer offered ₹${Number(amount).toLocaleString('en-IN')} — accept, counter, or decline.`,
      data: { bookingId },
    });

    res.json({ message: 'Counter offer sent', bid });
  } catch (error) {
    console.error('Counter bid error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Initiate Payment ───
export const initiatePayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { method } = req.body;
    const booking = await Booking.findOne({
      _id: req.params.id,
      customer: req.user!.id,
      status: 'worker_approved',
    });

    if (!booking) {
      res.status(404).json({ message: 'Booking not found or not approved yet' });
      return;
    }

    booking.paymentMethod = method;

    if (method === 'cash') {
      booking.cashSurcharge = 100;
      // Cash is collected at completion, so keep it pending for now.
      booking.paymentStatus = 'pending';
      booking.status = 'payment_done';
      booking.completionPin = generatePin();
      booking.completionRequestedByWorkerAt = undefined;
      booking.completionCodeRevealedAt = undefined;
      await booking.save();

      // Real-time: Notify worker that cash payment mode is selected
      if (booking.assignedWorker) {
        const customerId = booking.customer.toString();
        const bookingStatusPayload = {
          bookingId: booking._id,
          status: 'payment_done',
          paymentStatus: booking.paymentStatus,
          paymentMethod: 'cash',
        };

        notifyUser(booking.assignedWorker.toString(), 'booking_status_updated', bookingStatusPayload);
        notifyUser(customerId, 'booking_status_updated', bookingStatusPayload);
        await sendNotification({
          recipientId: booking.assignedWorker.toString(),
          recipientModel: 'Worker',
          type: 'payment_success',
          title: 'Cash Payment Selected',
          message: 'Customer chose cash payment. Collect payment after completing the service.',
          data: { bookingId: booking._id },
        });
      }

      res.json({
        message: `Cash payment selected. Total: ₹${booking.amount + 100} (includes ₹100 service fee). Payment will be marked paid after service completion. Your PIN: ${booking.completionPin}`,
        booking,
        pin: booking.completionPin,
        totalAmount: booking.amount + 100,
      });
      return;
    }

    // Online payment
    const order = await createOrder(booking.amount, booking._id.toString());

    booking.razorpayOrderId = order.id;
    await booking.save();

    res.json({
      razorpayOrder: {
        id: order.id,
        amount: booking.amount * 100, // Razorpay uses paise
      },
      booking,
    });
  } catch (error) {
    console.error('Initiate payment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Verify Online Payment ───
export const verifyBookingPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const isValid = verifyPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isValid) {
      res.status(400).json({ message: 'Payment verification failed' });
      return;
    }

    const booking = await Booking.findOne({
      _id: req.params.id,
      customer: req.user!.id,
      razorpayOrderId: razorpay_order_id,
    });

    if (!booking) {
      res.status(404).json({ message: 'Booking not found' });
      return;
    }

    const { alreadyFinalized } = await finalizeOnlineBookingPayment(
      booking,
      razorpay_order_id,
      razorpay_payment_id
    );

    res.json({
      message: alreadyFinalized ? 'Payment already verified.' : 'Payment successful!',
      pin: booking.completionPin,
      booking,
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Reconcile Online Payment (client fallback for missed callback/webhook lag) ───
export const reconcileBookingPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const requestedOrderId = typeof req.body?.razorpay_order_id === 'string'
      ? req.body.razorpay_order_id
      : '';

    const booking = await Booking.findOne({
      _id: req.params.id,
      customer: req.user!.id,
    });

    if (!booking) {
      res.status(404).json({ message: 'Booking not found' });
      return;
    }

    const { reconciled, alreadyFinalized, paymentId } = await reconcileBookingPaymentByOrder(
      booking,
      requestedOrderId
    );

    if (!reconciled) {
      res.status(202).json({
        message: 'Payment is not confirmed yet. Please retry shortly.',
        reconciled: false,
        booking,
      });
      return;
    }

    res.json({
      message: alreadyFinalized ? 'Payment already confirmed.' : 'Payment confirmed successfully.',
      reconciled: true,
      alreadyFinalized,
      paymentId,
      pin: booking.completionPin,
      booking,
    });
  } catch (error) {
    console.error('Reconcile payment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Razorpay Webhook (server-side reconciliation) ───
export const handleRazorpayWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const signature = req.header('x-razorpay-signature');
    const rawBody = (req as Request & { rawBody?: string }).rawBody;

    if (!signature || !rawBody) {
      res.status(400).json({ message: 'Missing webhook signature or body' });
      return;
    }

    const isValid = verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      res.status(400).json({ message: 'Invalid webhook signature' });
      return;
    }

    const body = req.body as RazorpayWebhookBody;
    if (!RAZORPAY_SUCCESS_EVENTS.has(body.event || '')) {
      res.status(200).json({ received: true, ignored: true });
      return;
    }

    const paymentEntity = body.payload?.payment?.entity;
    const orderEntity = body.payload?.order?.entity;

    const orderId = paymentEntity?.order_id || orderEntity?.id;
    const paymentId = paymentEntity?.id;

    if (!orderId || !paymentId) {
      res.status(200).json({ received: true, ignored: true });
      return;
    }

    if (paymentEntity?.status && !['captured', 'authorized'].includes(paymentEntity.status)) {
      res.status(200).json({ received: true, ignored: true });
      return;
    }

    const booking = await Booking.findOne({ razorpayOrderId: orderId });
    if (!booking) {
      res.status(200).json({ received: true, ignored: true });
      return;
    }

    const { alreadyFinalized } = await finalizeOnlineBookingPayment(booking, orderId, paymentId);

    res.status(200).json({ received: true, reconciled: true, alreadyFinalized });
  } catch (error) {
    console.error('Razorpay webhook error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
