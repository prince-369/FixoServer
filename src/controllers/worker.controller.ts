import { Request, Response } from 'express';
import Worker from '../models/Worker';
import Booking from '../models/Booking';
import WorkBid from '../models/WorkBid';
import Transaction from '../models/Transaction';
import Withdrawal from '../models/Withdrawal';
import Notification from '../models/Notification';
import HelpTicket from '../models/HelpTicket';
import ChatbotQA from '../models/ChatbotQA';
import { uploadBufferToCloudinary } from '../services/cloudinary.service';
import { generateTID } from '../utils/generateTID';
import { generateTicketNumber } from '../services/ticketNumber.service';
import { createDuesPaymentOrder, verifyPayment } from '../services/payment.service';
import env from '../config/env';
import { notifyUser, notifyBookingRoom, notifyRole, sendNotification, sendAdminNotification } from '../socket';

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ─── Get Worker Profile ───
export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const worker = await Worker.findById(req.user!.id).populate('categories');
    if (!worker) {
      res.status(404).json({ message: 'Worker not found' });
      return;
    }
    res.json({ worker });
  } catch (error) {
    console.error('Get worker profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Update Worker Profile ───
export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { bio, regularPhone, extraPhones, categories, location } = req.body;
    const updateData: Record<string, unknown> = {};

    if (bio !== undefined) updateData.bio = bio;
    if (regularPhone) updateData.regularPhone = regularPhone;
    if (extraPhones) updateData.extraPhones = extraPhones;
    if (categories) updateData.categories = categories;
    if (location) updateData.location = location;

    if (req.file) {
      const uploaded = await uploadBufferToCloudinary(req.file.buffer, 'workers');
      updateData.profileImage = uploaded.url;
    }

    const worker = await Worker.findByIdAndUpdate(req.user!.id, updateData, { new: true }).populate('categories');
    res.json({ message: 'Profile updated', worker });
  } catch (error) {
    console.error('Update worker profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Complete Profile ───
export const completeProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { categories, bio, regularPhone, latitude, longitude, address } = req.body;

    const worker = await Worker.findById(req.user!.id);
    if (!worker) {
      res.status(404).json({ message: 'Worker not found' });
      return;
    }

    if (worker.accountStatus !== 'approved') {
      res.status(400).json({ message: 'Account must be approved before completing profile' });
      return;
    }

    // Build location from lat/lng/address
    if (latitude && longitude) {
      worker.location = {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
        address: address || '',
      };
    }

    // Categories come as JSON string from FormData
    if (categories) {
      const parsed = typeof categories === 'string' ? JSON.parse(categories) : categories;
      if (Array.isArray(parsed) && parsed.length) worker.categories = parsed;
    }

    if (bio) worker.bio = bio;
    if (regularPhone) worker.regularPhone = regularPhone;

    if (req.file) {
      const uploaded = await uploadBufferToCloudinary(req.file.buffer, 'workers');
      worker.profileImage = uploaded.url;
    }

    worker.profileCompleted = true;
    worker.accountStatus = 'live';
    await worker.save();

    const populated = await Worker.findById(worker._id).populate('categories');
    res.json({ message: 'Profile completed! You are now live.', worker: populated });
  } catch (error) {
    console.error('Complete profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Toggle Active Status ───
export const toggleActive = async (req: Request, res: Response): Promise<void> => {
  try {
    const worker = await Worker.findById(req.user!.id);
    if (!worker) {
      res.status(404).json({ message: 'Worker not found' });
      return;
    }

    if (worker.accountStatus !== 'live') {
      res.status(400).json({ message: 'Account must be live to toggle active status' });
      return;
    }

    worker.isActive = !worker.isActive;
    await worker.save();

    res.json({ message: `You are now ${worker.isActive ? 'Active' : 'Inactive'}`, isActive: worker.isActive });
  } catch (error) {
    console.error('Toggle active error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Update Location ───
export const updateLocation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { latitude, longitude, address } = req.body;
    const coordinates = [longitude, latitude]; // MongoDB expects [lng, lat]
    const worker = await Worker.findByIdAndUpdate(
      req.user!.id,
      { location: { type: 'Point', coordinates, address } },
      { new: true }
    );
    res.json({ message: 'Location updated', location: worker?.location });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Dashboard Stats ───
export const getDashboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const worker = await Worker.findById(req.user!.id);
    if (!worker) {
      res.status(404).json({ message: 'Worker not found' });
      return;
    }

    const workerId = worker._id;

    // ── Active/Pending bookings ──
    const activeBookings = await Booking.find({
      assignedWorker: workerId,
      status: { $nin: ['completed', 'cancelled'] },
    })
      .populate('category', 'name slug')
      .populate('customer', 'fullName phone')
      .sort({ createdAt: -1 })
      .limit(5);

    // ── Completed bookings for reviews & stats ──
    const completedBookings = await Booking.find({
      assignedWorker: workerId,
      status: 'completed',
    });

    const reviews = completedBookings
      .filter((b) => b.review?.rating)
      .map((b) => ({
        rating: b.review!.rating,
        feedback: b.review!.feedback,
        createdAt: b.review!.createdAt,
      }));

    // ── Daily earnings for last 30 days (for graph) ──
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyEarnings = await Transaction.aggregate([
      {
        $match: {
          worker: workerId,
          type: 'worker_earning',
          status: 'completed',
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
          cash: { $sum: { $cond: [{ $eq: ['$method', 'cash'] }, '$amount', 0] } },
          online: { $sum: { $cond: [{ $eq: ['$method', 'online'] }, '$amount', 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // ── Monthly earnings for last 6 months ──
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyEarnings = await Transaction.aggregate([
      {
        $match: {
          worker: workerId,
          type: 'worker_earning',
          status: 'completed',
          createdAt: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
          cash: { $sum: { $cond: [{ $eq: ['$method', 'cash'] }, '$amount', 0] } },
          online: { $sum: { $cond: [{ $eq: ['$method', 'online'] }, '$amount', 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // ── Payment method breakdown ──
    const paymentBreakdown = await Transaction.aggregate([
      {
        $match: {
          worker: workerId,
          type: 'worker_earning',
          status: 'completed',
        },
      },
      {
        $group: {
          _id: '$method',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    const cashTotal = paymentBreakdown.find((p) => p._id === 'cash')?.total || 0;
    const onlineTotal = paymentBreakdown.find((p) => p._id === 'online')?.total || 0;
    const cashJobs = paymentBreakdown.find((p) => p._id === 'cash')?.count || 0;
    const onlineJobs = paymentBreakdown.find((p) => p._id === 'online')?.count || 0;

    // ── This week vs last week comparison ──
    const now = new Date();
    const startOfThisWeek = new Date(now);
    startOfThisWeek.setDate(now.getDate() - now.getDay());
    startOfThisWeek.setHours(0, 0, 0, 0);
    const startOfLastWeek = new Date(startOfThisWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

    const weeklyComparison = await Transaction.aggregate([
      {
        $match: {
          worker: workerId,
          type: 'worker_earning',
          status: 'completed',
          createdAt: { $gte: startOfLastWeek },
        },
      },
      {
        $group: {
          _id: {
            $cond: [{ $gte: ['$createdAt', startOfThisWeek] }, 'thisWeek', 'lastWeek'],
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    const thisWeekEarnings = weeklyComparison.find((w) => w._id === 'thisWeek')?.total || 0;
    const lastWeekEarnings = weeklyComparison.find((w) => w._id === 'lastWeek')?.total || 0;
    const thisWeekJobs = weeklyComparison.find((w) => w._id === 'thisWeek')?.count || 0;

    // ── Pending bids count ──
    const pendingBids = await WorkBid.countDocuments({
      worker: workerId,
      status: 'pending',
    });

    // ── Today's earnings ──
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayAgg = await Transaction.aggregate([
      {
        $match: {
          worker: workerId,
          type: 'worker_earning',
          status: 'completed',
          createdAt: { $gte: startOfToday },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);
    const todayEarnings = todayAgg[0]?.total || 0;
    const todayJobs = todayAgg[0]?.count || 0;

    res.json({
      stats: {
        totalWorkDone: worker.totalWorkDone,
        totalEarnings: worker.totalEarnings,
        totalCommissionPaid: worker.totalCommissionPaid,
        rating: worker.rating,
        balance: worker.balance,
        dues: worker.dues,
        isActive: worker.isActive,
        cashTotal,
        onlineTotal,
        cashJobs,
        onlineJobs,
        thisWeekEarnings,
        lastWeekEarnings,
        thisWeekJobs,
        todayEarnings,
        todayJobs,
        pendingBids,
        pendingBookings: activeBookings.filter((b) => ['worker_accepted', 'worker_approved', 'payment_done'].includes(b.status)).length,
        activeBookings: activeBookings.filter((b) => b.status === 'in_progress').length,
      },
      activeBookings,
      reviews,
      dailyEarnings,
      monthlyEarnings,
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Get Work Requests ───
export const getWorkRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const worker = await Worker.findById(req.user!.id);
    if (!worker) {
      res.status(404).json({ message: 'Worker not found' });
      return;
    }

    // 1) Available bookings — in worker's categories + 10km radius
    // Show finding_workers jobs within the same stale-window used by cleanup.
    const findingWorkersSince = new Date(Date.now() - env.JOB_STALE_BOOKING_MINUTES * 60 * 1000);
    const availableBookings = await Booking.find({
      $or: [
        { status: 'finding_workers', createdAt: { $gte: findingWorkersSince } },
        { status: 'bids_received' },
      ],
      category: { $in: worker.categories },
      customerLocation: {
        $nearSphere: {
          $geometry: {
            type: 'Point',
            coordinates: worker.location.coordinates,
          },
          $maxDistance: 10000,
        },
      },
    })
      .populate('category', 'name slug image')
      .populate('customer', 'fullName')
      .sort({ createdAt: -1 });

    // Check which ones this worker already bid on
    const existingBids = await WorkBid.find({
      worker: req.user!.id,
      booking: { $in: availableBookings.map((b) => b._id) },
    });
    const bidMap = new Map(existingBids.map((b) => [b.booking.toString(), b]));

    const available = availableBookings.map((booking) => ({
      ...booking.toObject(),
      myBid: bidMap.get(booking._id.toString()) || null,
    }));

    // 2) Active bookings — assigned to this worker, in progress
    const activeBookings = await Booking.find({
      assignedWorker: req.user!.id,
      status: { $in: ['worker_accepted', 'worker_approved', 'payment_done', 'in_progress'] },
    })
      .populate('category', 'name slug image')
      .populate('customer', 'fullName phone')
      .sort({ createdAt: -1 });

    // 3) Completed/cancelled bookings for this worker
    const completedBookings = await Booking.find({
      assignedWorker: req.user!.id,
      status: { $in: ['completed', 'cancelled'] },
    })
      .populate('category', 'name slug image')
      .populate('customer', 'fullName')
      .sort({ createdAt: -1 })
      .limit(20);

    const requests = [...available, ...activeBookings.map((b) => b.toObject()), ...completedBookings.map((b) => b.toObject())];

    res.json({ requests });
  } catch (error) {
    console.error('Get work requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Get Single Work Request Detail ───
export const getWorkRequestDetail = async (req: Request, res: Response): Promise<void> => {
  try {
    const worker = await Worker.findById(req.user!.id);
    if (!worker) {
      res.status(404).json({ message: 'Worker not found' });
      return;
    }

    const booking = await Booking.findById(req.params.id)
      .populate('category', 'name slug image')
      .populate('customer', 'fullName phone');

    if (!booking) {
      res.status(404).json({ message: 'Booking not found' });
      return;
    }

    // Only allow access if: worker is assigned, or booking is available (in worker's categories + radius)
    const isAssigned = booking.assignedWorker?.toString() === req.user!.id;
    const isAvailable = ['finding_workers', 'bids_received'].includes(booking.status);

    if (!isAssigned && !isAvailable) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    // Check if this worker already bid
    const myBid = await WorkBid.findOne({ booking: booking._id, worker: req.user!.id });

    res.json({
      booking: {
        ...booking.toObject(),
        myBid: myBid || null,
      },
    });
  } catch (error) {
    console.error('Get work request detail error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Submit Bid ───
export const submitBid = async (req: Request, res: Response): Promise<void> => {
  try {
    const { priceOffered } = req.body;
    const bookingIdParam = req.params.bookingId;
    const bookingId = Array.isArray(bookingIdParam) ? bookingIdParam[0] : bookingIdParam;
    if (!bookingId) {
      res.status(400).json({ message: 'Invalid booking id' });
      return;
    }

    const workerDoc = await Worker.findById(req.user!.id).select('isActive');
    if (!workerDoc?.isActive) {
      res.status(403).json({ message: 'You must be active to place bids. Turn on your availability toggle.' });
      return;
    }

    const booking = await Booking.findById(bookingId);
    if (!booking || !['finding_workers', 'bids_received'].includes(booking.status)) {
      res.status(400).json({ message: 'Cannot bid on this booking' });
      return;
    }

    const existingBid = await WorkBid.findOne({ booking: bookingId, worker: req.user!.id });
    if (existingBid) {
      if (existingBid.status === 'rejected') {
        existingBid.priceOffered = priceOffered;
        existingBid.status = 'pending';
        await existingBid.save();

        if (booking.status === 'finding_workers') {
          booking.status = 'bids_received';
          await booking.save();

          notifyUser(booking.customer.toString(), 'booking_status_updated', {
            bookingId,
            status: 'bids_received',
          });
        }

        const worker = await Worker.findById(req.user!.id).select('fullName rating profileImage');
        const customerId = booking.customer.toString();
        notifyBookingRoom(bookingId, 'booking:new-bid', {
          bookingId,
          bid: { ...existingBid.toObject(), worker },
        });

        await sendNotification({
          recipientId: customerId,
          recipientModel: 'User',
          type: 'new_bid',
          title: 'New Bid Received',
          message: `${worker?.fullName} offered ₹${priceOffered} for your service request.`,
          data: { bookingId },
        });

        res.status(200).json({ message: 'Bid re-submitted', bid: existingBid });
        return;
      }

      res.status(400).json({ message: 'You already bid on this booking' });
      return;
    }

    const bid = await WorkBid.create({
      booking: bookingId,
      worker: req.user!.id,
      priceOffered,
    });

    if (booking.status === 'finding_workers') {
      booking.status = 'bids_received';
      await booking.save();

      notifyUser(booking.customer.toString(), 'booking_status_updated', {
        bookingId,
        status: 'bids_received',
      });
    }
    // Real-time: Notify customer about new bid
    const worker = await Worker.findById(req.user!.id).select('fullName rating profileImage');
    const customerId = booking.customer.toString();
    notifyBookingRoom(bookingId, 'booking:new-bid', {
      bookingId,
      bid: { ...bid.toObject(), worker },
    });

    await sendNotification({
      recipientId: customerId,
      recipientModel: 'User',
      type: 'new_bid',
      title: 'New Bid Received',
      message: `${worker?.fullName} offered ₹${priceOffered} for your service request.`,
      data: { bookingId },
    });
    res.status(201).json({ message: 'Bid submitted', bid });
  } catch (error) {
    console.error('Submit bid error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Approve Booking (Worker confirms to go) ───
export const approveBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      assignedWorker: req.user!.id,
      status: 'worker_accepted',
    });

    if (!booking) {
      res.status(404).json({ message: 'Booking not found or not in correct state' });
      return;
    }

    booking.status = 'worker_approved';
    await booking.save();

    // Real-time: Notify customer that worker approved
    const customerId = booking.customer.toString();
    notifyUser(customerId, 'booking_confirmed', {
      bookingId: booking._id,
      status: booking.status,
      message: 'Worker has approved the job. Please proceed to payment.',
    });
    notifyUser(req.user!.id, 'booking_confirmed', {
      bookingId: booking._id,
      status: booking.status,
      message: 'You approved this booking.',
    });

    await sendNotification({
      recipientId: customerId,
      recipientModel: 'User',
      type: 'worker_approved',
      title: 'Worker Approved',
      message: 'The worker has approved your booking. Please proceed to payment.',
      data: { bookingId: booking._id },
    });

    res.json({ message: 'Booking approved. Customer will proceed to payment.', booking });
  } catch (error) {
    console.error('Approve booking error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Reject Booking (Worker declines) ───
export const rejectBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      assignedWorker: req.user!.id,
      status: 'worker_accepted',
    });

    if (!booking) {
      res.status(404).json({ message: 'Booking not found or not in correct state' });
      return;
    }

    // Reject the accepted worker's bid first.
    await WorkBid.findOneAndUpdate(
      { booking: booking._id, worker: req.user!.id },
      { status: 'rejected' }
    );

    // Re-open previously rejected alternatives so customer is not stuck with no pending bids.
    await WorkBid.updateMany(
      {
        booking: booking._id,
        worker: { $ne: req.user!.id },
        status: 'rejected',
      },
      { status: 'pending' }
    );

    const hasPendingBids = await WorkBid.exists({ booking: booking._id, status: 'pending' });

    // Keep booking open in bids_received so workers can continue bidding even on older requests.
    booking.status = 'bids_received';
    booking.assignedWorker = undefined;
    booking.acceptedBid = undefined;
    booking.amount = 0;
    booking.paymentMethod = undefined;
    booking.paymentStatus = 'pending';
    booking.completionPin = undefined;
    await booking.save();

    const customerMessage = hasPendingBids
      ? 'Assigned worker rejected. Previous bids are available again.'
      : 'Assigned worker rejected. Booking reopened for fresh bids.';

    notifyUser(booking.customer.toString(), 'booking_status_updated', {
      bookingId: booking._id,
      status: booking.status,
      message: customerMessage,
    });
    notifyUser(req.user!.id, 'booking_status_updated', {
      bookingId: booking._id,
      status: booking.status,
      message: 'You rejected this booking.',
    });

    res.json({ message: 'Booking rejected', booking });
  } catch (error) {
    console.error('Reject booking error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Cancel Booking (Worker cancels before payment) ───
export const cancelBookingByWorker = async (req: Request, res: Response): Promise<void> => {
  try {
    const { reason } = req.body;
    const booking = await Booking.findOne({
      _id: req.params.id,
      assignedWorker: req.user!.id,
    });

    if (!booking) {
      res.status(404).json({ message: 'Booking not found' });
      return;
    }

    // Worker can only cancel before payment
    if (['payment_done', 'in_progress', 'completed', 'cancelled'].includes(booking.status)) {
      res.status(400).json({ message: 'Cannot cancel after payment has been made' });
      return;
    }

    booking.status = 'cancelled';
    booking.cancellation = {
      cancelledBy: 'worker',
      reason: reason || 'Worker cancelled',
      cancelledAt: new Date(),
    };
    await booking.save();

    // Notify customer
    notifyUser(booking.customer.toString(), 'booking_status_updated', {
      bookingId: booking._id,
      status: 'cancelled',
      reason: booking.cancellation.reason,
      cancelledBy: 'worker',
    });
    notifyUser(req.user!.id, 'booking_status_updated', {
      bookingId: booking._id,
      status: 'cancelled',
      reason: booking.cancellation.reason,
      cancelledBy: 'worker',
    });

    await sendNotification({
      recipientId: booking.customer.toString(),
      recipientModel: 'User',
      type: 'booking_cancelled',
      title: 'Booking Cancelled by Worker',
      message: `The worker has cancelled the booking. Reason: ${booking.cancellation.reason}`,
      data: { bookingId: booking._id },
    });

    res.json({ message: 'Booking cancelled', booking });
  } catch (error) {
    console.error('Worker cancel booking error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Send Message to Customer ───
export const sendMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { message } = req.body;
    const booking = await Booking.findOneAndUpdate(
      {
        _id: req.params.id,
        assignedWorker: req.user!.id,
        status: { $in: ['worker_approved', 'payment_done', 'in_progress'] },
      },
      { workerMessage: message },
      { new: true }
    );

    if (!booking) {
      res.status(404).json({ message: 'Booking not found' });
      return;
    }

    // Real-time: Send ETA message to customer
    const customerId = booking.customer.toString();
    notifyUser(customerId, 'worker:message', {
      bookingId: booking._id,
      message,
    });

    res.json({ message: 'Message sent to customer' });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Dues Policy Helpers ───
const DUES_GRACE_PERIOD_DAYS = 10;

// Check if dues are overdue without auto-deducting (read-only check)
const isDuesOverdue = (worker: any): boolean => {
  if (worker.dues > 0 && worker.duesSince) {
    const daysSinceDues = Math.floor((Date.now() - new Date(worker.duesSince).getTime()) / (1000 * 60 * 60 * 24));
    return daysSinceDues >= DUES_GRACE_PERIOD_DAYS;
  }
  return false;
};

// ─── Complete Work (with PIN) ───
export const completeWork = async (req: Request, res: Response): Promise<void> => {
  try {
    const { pin } = req.body;
    const booking = await Booking.findOne({
      _id: req.params.id,
      assignedWorker: req.user!.id,
      status: { $in: ['payment_done', 'in_progress'] },
    });

    if (!booking) {
      res.status(404).json({ message: 'Booking not found' });
      return;
    }

    if (booking.completionPin !== pin) {
      res.status(400).json({ message: 'Invalid PIN' });
      return;
    }

    const isCashBooking = booking.paymentMethod === 'cash';

    booking.status = 'completed';
    if (isCashBooking) {
      booking.paymentStatus = 'paid';
    }
    await booking.save();

    const worker = await Worker.findById(req.user!.id);
    if (!worker) {
      res.status(404).json({ message: 'Worker not found' });
      return;
    }

    let commission = 0;
    let workerEarning = 0;

    if (booking.paymentMethod === 'online') {
      // Online: 20% commission, worker gets 80%
      const amountInPaise = Math.round(booking.amount * 100);
      const commissionInPaise = Math.round(amountInPaise * 0.20);
      const workerEarningInPaise = amountInPaise - commissionInPaise;

      commission = commissionInPaise / 100;
      workerEarning = workerEarningInPaise / 100;
      worker.balance += workerEarning;
    } else {
      // Cash: NO commission — worker keeps 100% of bid amount in hand
      // ₹100 surcharge IS the platform fee (added to dues)
      workerEarning = booking.amount;
      commission = 0;
      // Track when dues started accumulating
      if (worker.dues === 0) {
        worker.duesSince = new Date();
      }
      worker.dues += 100;
    }

    worker.totalWorkDone += 1;
    worker.totalEarnings += workerEarning;
    worker.totalCommissionPaid += commission;
    await worker.save();

    if (isCashBooking) {
      const cashPaymentAmount = booking.amount + (booking.cashSurcharge || 100);
      const existingCashPayment = await Transaction.findOne({
        booking: booking._id,
        type: 'booking_payment',
        method: 'cash',
      });

      if (existingCashPayment) {
        existingCashPayment.amount = cashPaymentAmount;
        existingCashPayment.status = 'completed';
        existingCashPayment.user = booking.customer;
        existingCashPayment.worker = worker._id;
        await existingCashPayment.save();
      } else {
        await Transaction.create({
          tid: generateTID(),
          booking: booking._id,
          user: booking.customer,
          worker: worker._id,
          type: 'booking_payment',
          amount: cashPaymentAmount,
          method: 'cash',
          status: 'completed',
        });
      }
    }

    // Create earning transaction
    await Transaction.create({
      tid: generateTID(),
      booking: booking._id,
      user: booking.customer,
      worker: worker._id,
      type: 'worker_earning',
      amount: workerEarning,
      method: booking.paymentMethod!,
      status: 'completed',
    });

    // Commission transaction (only for online — cash has no commission)
    if (commission > 0) {
      await Transaction.create({
        tid: generateTID(),
        booking: booking._id,
        user: booking.customer,
        worker: worker._id,
        type: 'commission',
        amount: commission,
        method: booking.paymentMethod!,
        status: 'completed',
      });
    }

    // Real-time: Notify customer that work is completed
    const customerId = booking.customer.toString();
    const completionPayload = {
      bookingId: booking._id,
      status: 'completed',
      paymentStatus: booking.paymentStatus,
    };
    notifyUser(customerId, 'booking_status_updated', completionPayload);
    notifyUser(req.user!.id, 'booking_status_updated', completionPayload);

    await sendNotification({
      recipientId: customerId,
      recipientModel: 'User',
      type: 'work_completed',
      title: 'Work Completed!',
      message: 'The worker has completed the job. Please rate your experience.',
      data: { bookingId: booking._id },
    });

    res.json({
      message: 'Work completed successfully!',
      earning: workerEarning,
      commission,
      newBalance: worker.balance,
    });
  } catch (error) {
    console.error('Complete work error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Get Funds ───
export const getFunds = async (req: Request, res: Response): Promise<void> => {
  try {
    const worker = await Worker.findById(req.user!.id);
    if (!worker) {
      res.status(404).json({ message: 'Worker not found' });
      return;
    }

    res.json({
      balance: worker.balance,
      dues: worker.dues,
      totalEarnings: worker.totalEarnings,
      totalCommissionPaid: worker.totalCommissionPaid,
      bankDetails: worker.bankDetails,
    });
  } catch (error) {
    console.error('Get funds error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Get Earnings History ───
export const getEarningsHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const transactions = await Transaction.find({
      worker: req.user!.id,
      type: { $in: ['worker_earning', 'commission'] },
    })
      .populate('booking', 'workDescription')
      .sort({ createdAt: -1 });

    res.json({ transactions });
  } catch (error) {
    console.error('Get earnings history error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Get Wallet Transactions (full history) ───
export const getWalletTransactions = async (req: Request, res: Response): Promise<void> => {
  try {
    const worker = await Worker.findById(req.user!.id);
    if (!worker) {
      res.status(404).json({ message: 'Worker not found' });
      return;
    }

    // All transactions for this worker (exclude customer payment records)
    const transactions = await Transaction.find({ worker: req.user!.id, type: { $ne: 'booking_payment' } })
      .populate({
        path: 'booking',
        select: 'workDescription category amount cashSurcharge paymentMethod customer',
        populate: [
          { path: 'category', select: 'name' },
          { path: 'customer', select: 'fullName' },
        ],
      })
      .sort({ createdAt: -1 });

    // Withdrawals
    const withdrawals = await Withdrawal.find({ worker: req.user!.id }).sort({ createdAt: -1 });

    // Summary
    const summary = await Transaction.aggregate([
      { $match: { worker: worker._id, status: 'completed' } },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
          cashAmount: { $sum: { $cond: [{ $eq: ['$method', 'cash'] }, '$amount', 0] } },
          onlineAmount: { $sum: { $cond: [{ $eq: ['$method', 'online'] }, '$amount', 0] } },
        },
      },
    ]);

    const earningsSummary = summary.find((s) => s._id === 'worker_earning');
    const commissionSummary = summary.find((s) => s._id === 'commission');

    // Check dues status
    const hasPendingDues = worker.dues > 0;
    const isOverdue = isDuesOverdue(worker);
    const duesDaysRemaining = worker.dues > 0 && worker.duesSince
      ? Math.max(0, DUES_GRACE_PERIOD_DAYS - Math.floor((Date.now() - new Date(worker.duesSince).getTime()) / (1000 * 60 * 60 * 24)))
      : null;

    res.json({
      balance: worker.balance,
      dues: worker.dues,
      duesSince: worker.duesSince,
      duesDaysRemaining,
      duesOverdue: isOverdue,
      withdrawalDisabled: hasPendingDues,
      totalEarnings: worker.totalEarnings,
      totalCommissionPaid: worker.totalCommissionPaid,
      cashEarnings: earningsSummary?.cashAmount || 0,
      onlineEarnings: earningsSummary?.onlineAmount || 0,
      totalJobs: earningsSummary?.count || 0,
      commissionRate: '20%',
      transactions,
      withdrawals,
    });
  } catch (error) {
    console.error('Get wallet transactions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Save Bank Details ───
export const saveBankDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { holderName, bankName, accountNumber, ifscCode } = req.body;

    const worker = await Worker.findByIdAndUpdate(
      req.user!.id,
      { bankDetails: { holderName, bankName, accountNumber, ifscCode } },
      { new: true }
    );

    res.json({ message: 'Bank details saved', bankDetails: worker?.bankDetails });
  } catch (error) {
    console.error('Save bank details error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Request Withdrawal ───
export const requestWithdrawal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { amount } = req.body;
    const worker = await Worker.findById(req.user!.id);

    if (!worker) {
      res.status(404).json({ message: 'Worker not found' });
      return;
    }

    if (
      !worker.bankDetails?.holderName ||
      !worker.bankDetails?.bankName ||
      !worker.bankDetails?.accountNumber ||
      !worker.bankDetails?.ifscCode
    ) {
      res.status(400).json({ message: 'Please complete bank details first' });
      return;
    }

    if (worker.dues > 0) {
      res.status(403).json({
        message: `Please clear your dues of ₹${worker.dues} first. Withdrawals are locked until dues are paid.`,
        withdrawalDisabled: true,
        dues: worker.dues,
      });
      return;
    }

    if (amount > worker.balance) {
      res.status(400).json({ message: 'Insufficient balance' });
      return;
    }

    if (amount <= 0) {
      res.status(400).json({ message: 'Invalid amount' });
      return;
    }

    const withdrawal = await Withdrawal.create({
      worker: worker._id,
      amount,
      bankDetails: worker.bankDetails,
    });

    worker.balance -= amount;
    await worker.save();

    notifyUser(req.user!.id, 'withdrawal_update', {
      withdrawalId: withdrawal._id,
      status: 'pending',
      withdrawal,
      balance: worker.balance,
      dues: worker.dues,
    });
    notifyRole('admin', 'withdrawal_update', {
      withdrawalId: withdrawal._id,
      status: 'pending',
      withdrawal,
      workerId: worker._id,
    });

    // Persist notification for admins
    sendAdminNotification({
      type: 'new_withdrawal',
      title: 'New Withdrawal Request',
      message: `Worker requested ₹${amount} withdrawal.`,
      data: { withdrawalId: withdrawal._id, workerId: worker._id },
    }).catch(() => {});

    res.status(201).json({
      message: 'Withdrawal request submitted. Will be processed within 3 hours.',
      withdrawal,
    });
  } catch (error) {
    console.error('Request withdrawal error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Get Withdrawal History ───
export const getWithdrawals = async (req: Request, res: Response): Promise<void> => {
  try {
    const withdrawals = await Withdrawal.find({ worker: req.user!.id })
      .sort({ requestedAt: -1 });

    res.json({ withdrawals });
  } catch (error) {
    console.error('Get withdrawals error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Pay Dues ───
export const payDues = async (req: Request, res: Response): Promise<void> => {
  try {
    const worker = await Worker.findById(req.user!.id);
    if (!worker || worker.dues <= 0) {
      res.status(400).json({ message: 'No dues to pay' });
      return;
    }

    const order = await createDuesPaymentOrder(worker.dues, worker._id.toString());

    res.json({
      razorpayOrderId: order.id,
      amount: worker.dues * 100, // in paise for Razorpay
      displayAmount: worker.dues,
      currency: 'INR',
    });
  } catch (error) {
    console.error('Pay dues error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Pay Dues from Wallet (full/partial) ───
export const payDuesFromWallet = async (req: Request, res: Response): Promise<void> => {
  try {
    const worker = await Worker.findById(req.user!.id);
    if (!worker || worker.dues <= 0) {
      res.status(400).json({ message: 'No dues to pay' });
      return;
    }

    if (worker.balance <= 0) {
      res.status(400).json({ message: 'Insufficient wallet balance to pay dues' });
      return;
    }

    const deductedAmount = Math.min(worker.balance, worker.dues);
    worker.balance -= deductedAmount;
    worker.dues -= deductedAmount;

    if (worker.dues <= 0) {
      worker.dues = 0;
      worker.duesSince = null;
    }

    await worker.save();

    await Transaction.create({
      tid: generateTID(),
      worker: worker._id,
      type: 'dues_wallet_deduct',
      amount: deductedAmount,
      method: 'online',
      status: 'completed',
    });

    res.json({
      message: worker.dues === 0
        ? `Dues fully cleared by deducting ₹${deductedAmount} from wallet.`
        : `₹${deductedAmount} deducted from wallet. ₹${worker.dues} dues still pending.`,
      deductedAmount,
      dues: worker.dues,
      balance: worker.balance,
      duesCleared: worker.dues === 0,
    });
  } catch (error) {
    console.error('Pay dues from wallet error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Verify Dues Payment ───
export const verifyDuesPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const isValid = verifyPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isValid) {
      res.status(400).json({ message: 'Payment verification failed' });
      return;
    }

    const worker = await Worker.findById(req.user!.id);
    if (!worker) {
      res.status(404).json({ message: 'Worker not found' });
      return;
    }

    const paidAmount = worker.dues;
    worker.dues = 0;
    worker.duesSince = null; // Clear the dues timer
    await worker.save();

    await Transaction.create({
      tid: generateTID(),
      worker: worker._id,
      type: 'dues_deposit',
      amount: paidAmount,
      method: 'online',
      razorpayPaymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
      status: 'completed',
    });

    res.json({ message: 'Dues paid successfully', dues: 0 });
  } catch (error) {
    console.error('Verify dues payment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Get Notifications ───
export const getNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const notifications = await Notification.find({ recipient: req.user!.id, recipientModel: 'Worker' })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ notifications });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Mark Notification Read ───
export const markNotificationRead = async (req: Request, res: Response): Promise<void> => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user!.id },
      { isRead: true }
    );
    res.json({ message: 'Marked as read' });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Mark All Notifications Read ───
export const markAllNotificationsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    await Notification.updateMany(
      { recipient: req.user!.id, recipientModel: 'Worker', isRead: false },
      { isRead: true }
    );
    res.json({ message: 'All marked as read' });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Delete Notification ───
export const deleteNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user!.id });
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Get Chatbot QA ───
export const getChatbotQA = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category } = req.query;
    const query: Record<string, unknown> = {
      isActive: true,
      $or: [
        { targetAudience: { $in: ['all', 'worker'] } },
        { targetAudience: { $exists: false } },
      ],
    };
    if (category) query.category = category;

    const qas = await ChatbotQA.find(query).sort({ category: 1, order: 1 });
    const categories = await ChatbotQA.distinct('category', {
      isActive: true,
      $or: [
        { targetAudience: { $in: ['all', 'worker'] } },
        { targetAudience: { $exists: false } },
      ],
    });

    res.json({ qas, categories });
  } catch (error) {
    console.error('Get chatbot QA error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Create Help Ticket ───
export const createHelpTicket = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, message, phoneNumber } = req.body;

    if (!category || !message) {
      res.status(400).json({ message: 'Category and message are required' });
      return;
    }

    const ticketNumber = await generateTicketNumber();

    const ticket = await HelpTicket.create({
      ticketNumber,
      user: req.user!.id,
      userModel: 'Worker',
      category,
      chatHistory: [
        { sender: 'user', message, timestamp: new Date() },
        {
          sender: 'bot',
          message: `Your ticket ${ticketNumber} has been created. Share this number for faster support.`,
          timestamp: new Date(),
        },
      ],
      phoneNumber,
      status: 'open',
    });

    const ticketForAdmin = await HelpTicket.findById(ticket._id)
      .populate('user', 'fullName phone email');

    notifyUser(req.user!.id, 'help_ticket_updated', {
      action: 'created',
      ticket,
    });

    if (ticketForAdmin) {
      notifyRole('admin', 'help_ticket_updated', {
        action: 'created',
        ticket: ticketForAdmin,
      });
    }

    // Persist notification for admins
    sendAdminNotification({
      type: 'new_help_ticket',
      title: 'New Support Ticket',
      message: `Worker created ticket #${ticketNumber}: ${category}`,
      data: { ticketId: ticket._id },
    }).catch(() => {});

    res.status(201).json({ message: 'Ticket created', ticket });
  } catch (error) {
    console.error('Create help ticket error:', error);

    if (
      error &&
      typeof error === 'object' &&
      'name' in error &&
      (error as { name?: string }).name === 'ValidationError'
    ) {
      res.status(400).json({ message: 'Invalid ticket data', error: (error as { message?: string }).message });
      return;
    }

    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Get My Help Tickets ───
export const getHelpTickets = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q, status } = req.query;
    const query: Record<string, unknown> = { user: req.user!.id, userModel: 'Worker' };

    if (typeof status === 'string' && ['open', 'escalated', 'resolved'].includes(status)) {
      query.status = status;
    }

    if (typeof q === 'string' && q.trim()) {
      const pattern = new RegExp(escapeRegex(q.trim()), 'i');
      query.$or = [
        { ticketNumber: pattern },
        { category: pattern },
      ];
    }

    const tickets = await HelpTicket.find(query)
      .sort({ updatedAt: -1 });

    const baseSummaryQuery = { user: req.user!.id, userModel: 'Worker' };
    const [totalTickets, openTickets, escalatedTickets, resolvedTickets] = await Promise.all([
      HelpTicket.countDocuments(baseSummaryQuery),
      HelpTicket.countDocuments({ ...baseSummaryQuery, status: 'open' }),
      HelpTicket.countDocuments({ ...baseSummaryQuery, status: 'escalated' }),
      HelpTicket.countDocuments({ ...baseSummaryQuery, status: 'resolved' }),
    ]);

    res.json({
      tickets,
      summary: {
        totalTickets,
        openTickets,
        escalatedTickets,
        resolvedTickets,
      },
    });
  } catch (error) {
    console.error('Get help tickets error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Get Help Ticket Detail ───
export const getHelpTicketDetail = async (req: Request, res: Response): Promise<void> => {
  try {
    const ticket = await HelpTicket.findOne({ _id: req.params.id, user: req.user!.id });
    if (!ticket) {
      res.status(404).json({ message: 'Ticket not found' });
      return;
    }
    res.json({ ticket });
  } catch (error) {
    console.error('Get ticket detail error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Append Message to Help Ticket ───
export const appendHelpTicketMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { message } = req.body;
    const ticket = await HelpTicket.findOne({ _id: req.params.id, user: req.user!.id });

    if (!ticket) {
      res.status(404).json({ message: 'Ticket not found' });
      return;
    }

    if (ticket.status === 'resolved') {
      res.status(400).json({ message: 'Cannot reply to a resolved ticket' });
      return;
    }

    ticket.chatHistory.push({ sender: 'user', message, timestamp: new Date() });
    await ticket.save();

    const ticketForAdmin = await HelpTicket.findById(ticket._id)
      .populate('user', 'fullName phone email');

    notifyUser(req.user!.id, 'help_ticket_updated', {
      action: 'message',
      ticket,
    });

    if (ticketForAdmin) {
      notifyRole('admin', 'help_ticket_updated', {
        action: 'message',
        ticket: ticketForAdmin,
      });
    }

    res.json({ message: 'Message sent', ticket });
  } catch (error) {
    console.error('Append help ticket message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Escalate Help Ticket ───
export const escalateHelpTicket = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phoneNumber } = req.body;
    const ticket = await HelpTicket.findOne({ _id: req.params.id, user: req.user!.id });

    if (!ticket) {
      res.status(404).json({ message: 'Ticket not found' });
      return;
    }

    ticket.status = 'escalated';
    if (phoneNumber) ticket.phoneNumber = phoneNumber;
    ticket.chatHistory.push({
      sender: 'bot',
      message: 'Your issue has been escalated. Our team will contact you within 24 hours.',
      timestamp: new Date(),
    });
    await ticket.save();

    const ticketForAdmin = await HelpTicket.findById(ticket._id)
      .populate('user', 'fullName phone email');

    notifyUser(req.user!.id, 'help_ticket_updated', {
      action: 'escalated',
      ticket,
    });

    if (ticketForAdmin) {
      notifyRole('admin', 'help_ticket_updated', {
        action: 'escalated',
        ticket: ticketForAdmin,
      });
    }

    res.json({ message: 'Ticket escalated', ticket });
  } catch (error) {
    console.error('Escalate help ticket error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
