"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleRazorpayWebhook = exports.verifyBookingPayment = exports.initiatePayment = exports.acceptBid = exports.getBookingBids = exports.createBooking = void 0;
const Booking_1 = __importDefault(require("../models/Booking"));
const WorkBid_1 = __importDefault(require("../models/WorkBid"));
const Worker_1 = __importDefault(require("../models/Worker"));
const payment_service_1 = require("../services/payment.service");
const generatePin_1 = require("../utils/generatePin");
const generateTID_1 = require("../utils/generateTID");
const Transaction_1 = __importDefault(require("../models/Transaction"));
const socket_1 = require("../socket");
const RAZORPAY_SUCCESS_EVENTS = new Set(['payment.captured', 'order.paid']);
const finalizeOnlineBookingPayment = async (booking, orderId, paymentId) => {
    const alreadyFinalized = booking.paymentStatus === 'paid' && booking.status === 'payment_done';
    booking.razorpayOrderId = orderId;
    booking.razorpayPaymentId = paymentId;
    booking.paymentStatus = 'paid';
    booking.status = 'payment_done';
    if (!booking.completionPin) {
        booking.completionPin = (0, generatePin_1.generatePin)();
    }
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
        await (0, socket_1.sendNotification)({
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
// ─── Create Booking ───
const createBooking = async (req, res) => {
    try {
        const { category, workDescription, latitude, longitude, address, timeSlot } = req.body;
        const coordinates = [longitude, latitude]; // MongoDB expects [lng, lat]
        const booking = await Booking_1.default.create({
            customer: req.user.id,
            category,
            workDescription,
            customerLocation: {
                type: 'Point',
                coordinates,
                address,
            },
            timeSlot: timeSlot || 'anytime',
            status: 'finding_workers',
        });
        // Find matching active workers within 10km
        const matchingWorkers = await Worker_1.default.find({
            accountStatus: 'live',
            isActive: true,
            categories: category,
            location: {
                $nearSphere: {
                    $geometry: {
                        type: 'Point',
                        coordinates,
                    },
                    $maxDistance: 10000,
                },
            },
        }).select('_id fullName');
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
        booking.acceptedBid = bid._id;
        booking.assignedWorker = bid.worker._id;
        booking.amount = bid.priceOffered;
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
            booking.cashSurcharge = 100;
            // Cash is collected at completion, so keep it pending for now.
            booking.paymentStatus = 'pending';
            booking.status = 'payment_done';
            booking.completionPin = (0, generatePin_1.generatePin)();
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
                await (0, socket_1.sendNotification)({
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
        const order = await (0, payment_service_1.createOrder)(booking.amount, booking._id.toString());
        booking.razorpayOrderId = order.id;
        await booking.save();
        res.json({
            razorpayOrder: {
                id: order.id,
                amount: booking.amount * 100, // Razorpay uses paise
            },
            booking,
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