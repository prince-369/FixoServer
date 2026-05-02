import { Request, Response } from 'express';
import Booking from '../models/Booking';
import WorkBid from '../models/WorkBid';
import Worker from '../models/Worker';
import Notification from '../models/Notification';
import { createOrder, verifyPayment } from '../services/payment.service';
import { generatePin } from '../utils/generatePin';
import { generateTID } from '../utils/generateTID';
import Transaction from '../models/Transaction';
import { notifyWorkers, notifyUser, sendNotification, sendAdminNotification } from '../socket';

// ─── Create Booking ───
export const createBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, workDescription, latitude, longitude, address } = req.body;
    const coordinates = [longitude, latitude]; // MongoDB expects [lng, lat]

    const booking = await Booking.create({
      customer: req.user!.id,
      category,
      workDescription,
      customerLocation: {
        type: 'Point',
        coordinates,
        address,
      },
      status: 'finding_workers',
    });

    // Find matching active workers within 10km
    const matchingWorkers = await Worker.find({
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
    booking.amount = bid.priceOffered;
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
      booking.paymentStatus = 'paid';
      booking.status = 'payment_done';
      booking.completionPin = generatePin();
      await booking.save();

      // Create cash payment transaction
      await Transaction.create({
        tid: generateTID(),
        booking: booking._id,
        user: booking.customer,
        worker: booking.assignedWorker,
        type: 'booking_payment',
        amount: booking.amount + 100,
        method: 'cash',
        status: 'completed',
      });

      // Real-time: Notify worker that payment is done
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
          title: 'Payment Received (Cash)',
          message: 'Customer chose cash payment. You can proceed to the location.',
          data: { bookingId: booking._id },
        });
      }

      res.json({
        message: `Cash payment selected. Total: ₹${booking.amount + 100} (includes ₹100 service fee). Your PIN: ${booking.completionPin}`,
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

    booking.razorpayPaymentId = razorpay_payment_id;
    booking.paymentStatus = 'paid';
    booking.status = 'payment_done';
    booking.completionPin = generatePin();
    await booking.save();

    // Create payment transaction
    await Transaction.create({
      tid: generateTID(),
      booking: booking._id,
      user: booking.customer,
      worker: booking.assignedWorker,
      type: 'booking_payment',
      amount: booking.amount,
      method: 'online',
      razorpayPaymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
      status: 'completed',
    });

    // Real-time: Notify worker that online payment is done
    if (booking.assignedWorker) {
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

    res.json({
      message: 'Payment successful!',
      pin: booking.completionPin,
      booking,
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
