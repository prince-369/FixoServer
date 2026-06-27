"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleRazorpayWebhook = exports.reconcileBookingPayment = exports.verifyBookingPayment = exports.initiatePayment = exports.counterBid = exports.acceptBid = exports.getBookingBids = exports.createBooking = exports.getWorkerAvailabilitySummary = void 0;
const Booking_1 = __importDefault(require("../models/Booking"));
const WorkBid_1 = __importDefault(require("../models/WorkBid"));
const Worker_1 = __importDefault(require("../models/Worker"));
const payment_service_1 = require("../services/payment.service");
const cloudinary_service_1 = require("../services/cloudinary.service");
const generatePin_1 = require("../utils/generatePin");
const generateTID_1 = require("../utils/generateTID");
const Transaction_1 = __importDefault(require("../models/Transaction"));
const socket_1 = require("../socket");
const incentive_service_1 = require("../services/incentive.service");
const RAZORPAY_SUCCESS_EVENTS = new Set(['payment.captured', 'order.paid']);
const WORKER_SEARCH_RADIUS_METERS = 10000;
// Customer availability preview uses the SAME radius as real job matching (10 km),
// so the counts shown to the customer reflect exactly who could actually serve them.
const WORKER_SUMMARY_RADIUS_METERS = WORKER_SEARCH_RADIUS_METERS;
const hasValidCoordinates = (coordinates) => {
    if (!Array.isArray(coordinates) || coordinates.length !== 2)
        return false;
    return Number.isFinite(Number(coordinates[0])) && Number.isFinite(Number(coordinates[1]));
};
const toRadians = (value) => (value * Math.PI) / 180;
const distanceMetersBetween = (a, b) => {
    // Coordinates are [longitude, latitude]
    const [lng1, lat1] = a;
    const [lng2, lat2] = b;
    const earthRadiusMeters = 6371000;
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);
    const lat1Rad = toRadians(lat1);
    const lat2Rad = toRadians(lat2);
    const haversine = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLng / 2) ** 2;
    const arc = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
    return earthRadiusMeters * arc;
};
const isGeoIndexMissingError = (error) => {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    return (message.includes('$geonear') ||
        message.includes('unable to find index') ||
        message.includes('2dsphere index'));
};
const findNearbyWorkers = async (categoryId, coordinates) => {
    return Worker_1.default.find({
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
const resolveMatchingWorkers = async (categoryId, coordinates) => {
    try {
        return await findNearbyWorkers(categoryId, coordinates);
    }
    catch (error) {
        if (!isGeoIndexMissingError(error)) {
            throw error;
        }
        console.error('Geo index missing for worker location. Attempting self-heal.', error);
        try {
            await Worker_1.default.collection.createIndex({ location: '2dsphere' }, { name: 'location_2dsphere' });
            return await findNearbyWorkers(categoryId, coordinates);
        }
        catch (retryError) {
            console.error('Geo index self-heal failed. Proceeding without worker notifications.', retryError);
            return [];
        }
    }
};
const fetchWorkerAvailabilitySummary = async (categoryId, coordinates) => {
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
        Worker_1.default.countDocuments(nearbyFilter),
        Worker_1.default.countDocuments({ ...nearbyFilter, isActive: true, accountStatus: 'live' }),
    ]);
    return { total, active, radiusMeters: WORKER_SUMMARY_RADIUS_METERS };
};
const computeWorkerAvailabilitySummaryFallback = async (categoryId, targetCoordinates) => {
    const workers = await Worker_1.default.find({ categories: categoryId })
        .select('location isActive accountStatus')
        .lean();
    let total = 0;
    let active = 0;
    for (const worker of workers) {
        const coordinates = worker?.location?.coordinates;
        if (!hasValidCoordinates(coordinates))
            continue;
        const workerCoordinates = [Number(coordinates[0]), Number(coordinates[1])];
        const distance = distanceMetersBetween(workerCoordinates, targetCoordinates);
        if (distance > WORKER_SUMMARY_RADIUS_METERS)
            continue;
        total += 1;
        if (worker.isActive === true && worker.accountStatus === 'live') {
            active += 1;
        }
    }
    return { total, active, radiusMeters: WORKER_SUMMARY_RADIUS_METERS };
};
const resolveWorkerAvailabilitySummary = async (categoryId, coordinates) => {
    try {
        return await fetchWorkerAvailabilitySummary(categoryId, coordinates);
    }
    catch (error) {
        if (!isGeoIndexMissingError(error)) {
            console.error('Primary availability summary query failed. Falling back to manual distance scan.', error);
            return computeWorkerAvailabilitySummaryFallback(categoryId, coordinates);
        }
        console.error('Geo index missing while fetching worker availability summary. Attempting self-heal.', error);
        try {
            await Worker_1.default.collection.createIndex({ location: '2dsphere' }, { name: 'location_2dsphere' });
            return await fetchWorkerAvailabilitySummary(categoryId, coordinates);
        }
        catch (retryError) {
            console.error('Geo index self-heal failed while fetching worker availability summary. Falling back to manual distance scan.', retryError);
            return computeWorkerAvailabilitySummaryFallback(categoryId, coordinates);
        }
    }
};
// ─── Worker Availability Summary (Customer Preview) ───
const getWorkerAvailabilitySummary = async (req, res) => {
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
        const coordinates = [longitude, latitude];
        const summary = await resolveWorkerAvailabilitySummary(categoryId, coordinates);
        res.json({
            summary: {
                total: summary.total,
                active: summary.active,
                inactive: Math.max(0, summary.total - summary.active),
                radiusMeters: summary.radiusMeters,
            },
        });
    }
    catch (error) {
        console.error('Get worker availability summary error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getWorkerAvailabilitySummary = getWorkerAvailabilitySummary;
const finalizeOnlineBookingPayment = async (booking, orderId, paymentId) => {
    const alreadyFinalized = booking.paymentStatus === 'paid' && booking.status === 'payment_done';
    booking.razorpayOrderId = orderId;
    booking.razorpayPaymentId = paymentId;
    booking.paymentStatus = 'paid';
    booking.status = 'payment_done';
    if (!booking.completionPin) {
        booking.completionPin = (0, generatePin_1.generatePin)();
    }
    booking.completionRequestedByWorkerAt = undefined;
    booking.completionCodeRevealedAt = undefined;
    await booking.save();
    const existingPayment = await Transaction_1.default.findOne({
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
    }
    else {
        await Transaction_1.default.create({
            tid: (0, generateTID_1.generateTID)(),
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
        (0, socket_1.notifyUser)(booking.assignedWorker.toString(), 'booking_status_updated', bookingStatusPayload);
        (0, socket_1.notifyUser)(customerId, 'booking_status_updated', bookingStatusPayload);
        // No persistent notification to worker for payment — they already know via realtime status update.
    }
    // Record coupon redemption once payment is confirmed (idempotent on booking).
    if (!alreadyFinalized && booking.couponCampaign && booking.discountAmount > 0) {
        void (0, incentive_service_1.recordCouponRedemption)({
            couponId: booking.couponCampaign,
            couponCode: booking.couponCode,
            userId: booking.customer,
            bookingId: booking._id,
            discountAmount: booking.discountAmount,
            orderAmount: booking.amount,
        });
    }
    return { alreadyFinalized };
};
const reconcileBookingPaymentByOrder = async (booking, requestedOrderId) => {
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
    const successfulPayment = await (0, payment_service_1.fetchSuccessfulPaymentForOrder)(orderId);
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
const createBooking = async (req, res) => {
    try {
        const { category, workDescription, latitude, longitude, address, timeSlot, scheduledAt: scheduledAtRaw, voiceLanguage, voiceTranscript, voiceDurationSec } = req.body;
        const normalizedDescription = String(workDescription ?? '').trim();
        // Optional scheduled time chosen by the customer. Null = as soon as possible.
        let scheduledAt = null;
        if (scheduledAtRaw) {
            const parsed = new Date(scheduledAtRaw);
            if (Number.isNaN(parsed.getTime())) {
                res.status(400).json({ message: 'Invalid scheduled time' });
                return;
            }
            // Must be in the future (allow a small 2-min clock skew) and within 30 days.
            if (parsed.getTime() < Date.now() - 2 * 60 * 1000) {
                res.status(400).json({ message: 'Scheduled time must be in the future' });
                return;
            }
            if (parsed.getTime() > Date.now() + 30 * 24 * 60 * 60 * 1000) {
                res.status(400).json({ message: 'Scheduled time cannot be more than 30 days away' });
                return;
            }
            scheduledAt = parsed;
        }
        let voiceNote;
        if (req.file) {
            const uploadedVoice = await (0, cloudinary_service_1.uploadAudioBufferToCloudinary)(req.file.buffer, 'booking-voice');
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
        const coordinates = [normalizedLongitude, normalizedLatitude]; // MongoDB expects [lng, lat]
        const booking = await Booking_1.default.create({
            customer: req.user.id,
            category,
            workDescription: finalDescription,
            voiceNote,
            customerLocation: {
                type: 'Point',
                coordinates,
                address,
            },
            timeSlot: timeSlot || 'anytime',
            scheduledAt,
            scheduleNotified: false,
            status: 'finding_workers',
        });
        // Find matching active workers within 10km.
        // If lookup fails, keep booking successful and retry worker discovery later via ops.
        let matchingWorkers = [];
        try {
            matchingWorkers = await resolveMatchingWorkers(String(category), coordinates);
        }
        catch (workerLookupError) {
            console.error('Worker lookup failed after booking creation. Returning success without notifications.', workerLookupError);
        }
        const populated = await Booking_1.default.findById(booking._id)
            .populate('category', 'name slug image');
        // Real-time: Notify matching workers about new work request
        const workerIds = matchingWorkers.map((w) => w._id.toString());
        if (workerIds.length > 0) {
            (0, socket_1.notifyWorkers)(workerIds, 'new_job_request', {
                booking: populated,
                bookingId: booking._id,
                status: booking.status,
                message: `New ${populated?.category?.name || 'service'} request nearby!`,
            });
            // Create notifications in DB + emit via socket
            await Promise.all(workerIds.map((wId) => (0, socket_1.sendNotification)({
                recipientId: wId,
                recipientModel: 'Worker',
                type: 'new_work_request',
                title: 'New Work Request',
                message: `New ${populated?.category?.name || 'service'} request: "${booking.workDescription.slice(0, 50)}"`,
                data: { bookingId: booking._id },
            })));
        }
        res.status(201).json({
            message: `Booking created. ${matchingWorkers.length} workers notified.`,
            booking: populated,
            workersNotified: matchingWorkers.length,
        });
    }
    catch (error) {
        console.error('Create booking error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.createBooking = createBooking;
// ─── Get Bids for Booking ───
const getBookingBids = async (req, res) => {
    try {
        const booking = await Booking_1.default.findOne({
            _id: req.params.id,
            customer: req.user.id,
        });
        if (!booking) {
            res.status(404).json({ message: 'Booking not found' });
            return;
        }
        const bids = await WorkBid_1.default.find({
            booking: req.params.id,
            status: 'pending',
        }).populate('worker', 'fullName profileImage rating bio regularPhone totalWorkDone isActive');
        // Filter out bids from inactive workers
        const activeBids = bids.filter((b) => b.worker && b.worker.isActive !== false);
        res.json({ bids: activeBids });
    }
    catch (error) {
        console.error('Get booking bids error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getBookingBids = getBookingBids;
// ─── Accept Bid ───
const acceptBid = async (req, res) => {
    try {
        const { bidId } = req.params;
        const bid = await WorkBid_1.default.findById(bidId).populate('worker', 'fullName phone profileImage');
        if (!bid) {
            res.status(404).json({ message: 'Bid not found' });
            return;
        }
        const booking = await Booking_1.default.findOne({
            _id: bid.booking,
            customer: req.user.id,
            status: { $in: ['finding_workers', 'bids_received'] },
        });
        if (!booking) {
            res.status(400).json({ message: 'Cannot accept bid for this booking' });
            return;
        }
        // Accept this bid, reject others
        bid.status = 'accepted';
        await bid.save();
        await WorkBid_1.default.updateMany({ booking: booking._id, _id: { $ne: bidId } }, { status: 'rejected' });
        booking.status = 'worker_accepted';
        // (other-worker notifications are sent below, after the booking is saved)
        booking.acceptedBid = bid._id;
        booking.assignedWorker = bid.worker._id;
        booking.amount = bid.agreedAmount ?? bid.priceOffered;
        await booking.save();
        const populatedBooking = await Booking_1.default.findById(booking._id)
            .populate('category', 'name slug image')
            .populate('assignedWorker', 'fullName phone profileImage rating');
        // Real-time: Notify the accepted worker
        const workerId = (bid.worker._id || bid.worker).toString();
        const customerId = booking.customer.toString();
        (0, socket_1.notifyUser)(workerId, 'booking_accepted', {
            booking: populatedBooking,
            bookingId: booking._id,
            status: booking.status,
            message: 'Your bid has been accepted! Please approve to proceed.',
        });
        (0, socket_1.notifyUser)(customerId, 'booking_accepted', {
            booking: populatedBooking,
            bookingId: booking._id,
            status: booking.status,
            message: 'Worker bid accepted successfully.',
        });
        await (0, socket_1.sendNotification)({
            recipientId: workerId,
            recipientModel: 'Worker',
            type: 'bid_accepted',
            title: 'Bid Accepted!',
            message: `Your bid of ₹${bid.priceOffered} was accepted by the customer.`,
            data: { bookingId: booking._id },
        });
        // Notify the OTHER workers who bid that the job went to someone else, so it
        // disappears from their available list in real-time.
        try {
            const otherBids = await WorkBid_1.default.find({ booking: booking._id, _id: { $ne: bidId } }).select('worker');
            const notified = new Set();
            for (const ob of otherBids) {
                const wid = ob.worker.toString();
                if (wid === workerId || notified.has(wid))
                    continue;
                notified.add(wid);
                (0, socket_1.notifyUser)(wid, 'booking_status_updated', {
                    bookingId: booking._id,
                    status: 'worker_accepted',
                    taken: true,
                    message: 'The customer selected another worker for this job.',
                });
            }
        }
        catch { /* non-blocking */ }
        res.json({
            message: 'Bid accepted. Waiting for worker approval.',
            booking: populatedBooking,
        });
    }
    catch (error) {
        console.error('Accept bid error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.acceptBid = acceptBid;
// ─── Counter Bid (Customer negotiates) ───
const counterBid = async (req, res) => {
    try {
        const { id: bookingId, bidId } = req.params;
        const { amount, message } = req.body;
        if (!amount || Number(amount) <= 0) {
            res.status(400).json({ message: 'A valid counter amount is required' });
            return;
        }
        const bid = await WorkBid_1.default.findById(bidId);
        if (!bid) {
            res.status(404).json({ message: 'Bid not found' });
            return;
        }
        const booking = await Booking_1.default.findOne({
            _id: bookingId,
            customer: req.user.id,
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
        (0, socket_1.notifyUser)(workerId, 'booking:bid-negotiation', { bookingId, bid });
        await (0, socket_1.sendNotification)({
            recipientId: workerId,
            recipientModel: 'Worker',
            type: 'new_message',
            title: 'Customer Counter Offer',
            message: `Customer offered ₹${Number(amount).toLocaleString('en-IN')} — accept, counter, or decline.`,
            data: { bookingId },
        });
        res.json({ message: 'Counter offer sent', bid });
    }
    catch (error) {
        console.error('Counter bid error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.counterBid = counterBid;
// ─── Initiate Payment ───
const initiatePayment = async (req, res) => {
    try {
        const { method } = req.body;
        const booking = await Booking_1.default.findOne({
            _id: req.params.id,
            customer: req.user.id,
            status: 'worker_approved',
        });
        if (!booking) {
            res.status(404).json({ message: 'Booking not found or not approved yet' });
            return;
        }
        booking.paymentMethod = method;
        if (method === 'cash') {
            booking.cashSurcharge = 0;
            // Cash is collected at completion, so keep it pending for now.
            booking.paymentStatus = 'pending';
            booking.status = 'payment_done';
            booking.completionPin = (0, generatePin_1.generatePin)();
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
                (0, socket_1.notifyUser)(booking.assignedWorker.toString(), 'booking_status_updated', bookingStatusPayload);
                (0, socket_1.notifyUser)(customerId, 'booking_status_updated', bookingStatusPayload);
                // No persistent notification to worker for payment — they already know via realtime status update.
            }
            res.json({
                message: `Cash payment selected. Total: ₹${booking.amount}. Payment will be marked paid after service completion. Your PIN: ${booking.completionPin}`,
                booking,
                pin: booking.completionPin,
                totalAmount: booking.amount,
            });
            return;
        }
        // Online payment — optional coupon discount (platform-absorbed; worker earning is unchanged)
        let payableAmount = booking.amount;
        if (req.body.couponCode) {
            try {
                const couponResult = await (0, incentive_service_1.validateAndPriceCoupon)({
                    code: String(req.body.couponCode),
                    customerId: req.user.id,
                    amount: booking.amount,
                });
                if (couponResult.valid && couponResult.campaign) {
                    booking.couponCode = couponResult.campaign.code;
                    booking.couponCampaign = couponResult.campaign._id;
                    booking.discountAmount = couponResult.discountAmount;
                    payableAmount = Math.max(0, booking.amount - couponResult.discountAmount);
                }
            }
            catch {
                // On any coupon error, fall back to full price — never block payment.
                payableAmount = booking.amount;
            }
        }
        const order = await (0, payment_service_1.createOrder)(payableAmount, booking._id.toString());
        booking.razorpayOrderId = order.id;
        await booking.save();
        res.json({
            razorpayOrder: {
                id: order.id,
                amount: payableAmount * 100, // Razorpay uses paise
            },
            booking,
            discountAmount: booking.discountAmount || 0,
            payableAmount,
        });
    }
    catch (error) {
        console.error('Initiate payment error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.initiatePayment = initiatePayment;
// ─── Verify Online Payment ───
const verifyBookingPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        const isValid = (0, payment_service_1.verifyPayment)(razorpay_order_id, razorpay_payment_id, razorpay_signature);
        if (!isValid) {
            res.status(400).json({ message: 'Payment verification failed' });
            return;
        }
        const booking = await Booking_1.default.findOne({
            _id: req.params.id,
            customer: req.user.id,
            razorpayOrderId: razorpay_order_id,
        });
        if (!booking) {
            res.status(404).json({ message: 'Booking not found' });
            return;
        }
        const { alreadyFinalized } = await finalizeOnlineBookingPayment(booking, razorpay_order_id, razorpay_payment_id);
        res.json({
            message: alreadyFinalized ? 'Payment already verified.' : 'Payment successful!',
            pin: booking.completionPin,
            booking,
        });
    }
    catch (error) {
        console.error('Verify payment error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.verifyBookingPayment = verifyBookingPayment;
// ─── Reconcile Online Payment (client fallback for missed callback/webhook lag) ───
const reconcileBookingPayment = async (req, res) => {
    try {
        const requestedOrderId = typeof req.body?.razorpay_order_id === 'string'
            ? req.body.razorpay_order_id
            : '';
        const booking = await Booking_1.default.findOne({
            _id: req.params.id,
            customer: req.user.id,
        });
        if (!booking) {
            res.status(404).json({ message: 'Booking not found' });
            return;
        }
        const { reconciled, alreadyFinalized, paymentId } = await reconcileBookingPaymentByOrder(booking, requestedOrderId);
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
    }
    catch (error) {
        console.error('Reconcile payment error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.reconcileBookingPayment = reconcileBookingPayment;
// ─── Razorpay Webhook (server-side reconciliation) ───
const handleRazorpayWebhook = async (req, res) => {
    try {
        const signature = req.header('x-razorpay-signature');
        const rawBody = req.rawBody;
        if (!signature || !rawBody) {
            res.status(400).json({ message: 'Missing webhook signature or body' });
            return;
        }
        const isValid = (0, payment_service_1.verifyWebhookSignature)(rawBody, signature);
        if (!isValid) {
            res.status(400).json({ message: 'Invalid webhook signature' });
            return;
        }
        const body = req.body;
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
        const booking = await Booking_1.default.findOne({ razorpayOrderId: orderId });
        if (!booking) {
            res.status(200).json({ received: true, ignored: true });
            return;
        }
        const { alreadyFinalized } = await finalizeOnlineBookingPayment(booking, orderId, paymentId);
        res.status(200).json({ received: true, reconciled: true, alreadyFinalized });
    }
    catch (error) {
        console.error('Razorpay webhook error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.handleRazorpayWebhook = handleRazorpayWebhook;
//# sourceMappingURL=booking.controller.js.map