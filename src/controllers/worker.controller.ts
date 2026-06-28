import { Request, Response } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import Worker from '../models/Worker';
import Category from '../models/Category';
import Booking from '../models/Booking';
import { syncCategoriesFromSkills, maxExperienceBumps, accountAgeMonths } from '../utils/workerSkills';
import WorkBid from '../models/WorkBid';
import Transaction from '../models/Transaction';
import Withdrawal from '../models/Withdrawal';
import Notification from '../models/Notification';
import HelpTicket from '../models/HelpTicket';
import ChatbotQA from '../models/ChatbotQA';
import { uploadBufferToCloudinary } from '../services/cloudinary.service';
import { generateTID } from '../utils/generateTID';
import { generateTicketNumber } from '../services/ticketNumber.service';
import { removeBookingVoiceNote } from '../services/bookingVoice.service';
import { verifyPayment } from '../services/payment.service';
import env from '../config/env';
import { notifyUser, notifyBookingRoom, notifyRole, sendNotification, sendAdminNotification } from '../socket';

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const WORKER_SEARCH_RADIUS_METERS = 10_000;

const hasValidCoordinates = (coordinates: unknown): coordinates is [number, number] => {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) return false;
  return Number.isFinite(Number(coordinates[0])) && Number.isFinite(Number(coordinates[1]));
};

const toCoordinateTuple = (coordinates: unknown): [number, number] | null => {
  if (!hasValidCoordinates(coordinates)) return null;
  return [Number(coordinates[0]), Number(coordinates[1])];
};

const isGeoIndexMissingError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return (
    message.includes('$geonear') ||
    message.includes('unable to find index') ||
    message.includes('2dsphere index')
  );
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

const findAvailableBookingsForWorker = async (worker: any, findingWorkersSince: Date) => {
  return Booking.find({
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
        $maxDistance: WORKER_SEARCH_RADIUS_METERS,
      },
    },
  })
    .populate('category', 'name slug image')
    .populate('customer', 'fullName')
    .sort({ createdAt: -1 });
};

const resolveAvailableBookingsForWorker = async (worker: any, findingWorkersSince: Date) => {
  try {
    return await findAvailableBookingsForWorker(worker, findingWorkersSince);
  } catch (error) {
    if (!isGeoIndexMissingError(error)) {
      throw error;
    }

    console.error('Booking geo index missing for work requests. Attempting self-heal.', error);
    try {
      await Booking.collection.createIndex(
        { customerLocation: '2dsphere' },
        { name: 'customerLocation_2dsphere' }
      );
      return await findAvailableBookingsForWorker(worker, findingWorkersSince);
    } catch (retryError) {
      console.error('Booking geo index self-heal failed. Returning without available bookings.', retryError);
      return [];
    }
  }
};

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

// ─── Re-request eKYC after rejection ───
export const reRequestEKYC = async (req: Request, res: Response): Promise<void> => {
  try {
    const worker = await Worker.findById(req.user!.id);
    if (!worker) {
      res.status(404).json({ message: 'Worker not found' });
      return;
    }

    if (worker.accountStatus !== 'rejected') {
      res.status(400).json({ message: 'eKYC re-request is only allowed for rejected workers' });
      return;
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const nextFullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '';
    const nextEmailRaw = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';

    if (!nextFullName) {
      res.status(400).json({ message: 'Full name is required' });
      return;
    }

    if (nextEmailRaw && nextEmailRaw !== (worker.email || '').toLowerCase()) {
      const emailOwner = await Worker.findOne({ email: nextEmailRaw, _id: { $ne: worker._id } }).select('_id');
      if (emailOwner) {
        res.status(400).json({ message: 'Email is already in use by another worker account' });
        return;
      }
      worker.email = nextEmailRaw;
    }

    worker.fullName = nextFullName;

    const frontFile = files?.aadhaarFront?.[0];
    const backFile = files?.aadhaarBack?.[0];

    if (frontFile) {
      const frontUpload = await uploadBufferToCloudinary(frontFile.buffer, 'aadhaar');
      worker.aadhaarFront = frontUpload.url;
    }

    if (backFile) {
      const backUpload = await uploadBufferToCloudinary(backFile.buffer, 'aadhaar');
      worker.aadhaarBack = backUpload.url;
    }

    const previousReason = worker.ekycRejectionReason || '';

    // Move worker back into pending review queue.
    worker.accountStatus = 'test';
    worker.isActive = false;
    worker.videoKycIncompleteReason = '';
    worker.videoKycRetryAvailableAt = null;
    worker.ekycCaptures = [];

    await worker.save();

    const updatedWorker = await Worker.findById(worker._id).populate('categories');

    notifyUser(worker._id.toString(), 'kyc_status_updated', {
      workerId: worker._id,
      status: 're_requested',
      previousReason,
    });

    await sendAdminNotification({
      type: 'ekyc_rerequest',
      title: 'Worker Re-requested eKYC',
      message: `${worker.fullName} has re-requested eKYC after rejection.`,
      data: {
        workerId: worker._id.toString(),
        workerName: worker.fullName,
        previousReason,
      },
    });

    res.json({
      message: 'Details updated. Your eKYC re-request has been submitted.',
      worker: updatedWorker,
    });
  } catch (error) {
    console.error('Re-request eKYC error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Complete Profile ───
export const completeProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { bio, regularPhone, latitude, longitude, address } = req.body;

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

    // Skills (and therefore categories) are chosen at registration and approved
    // during KYC — they are not (re)submitted here.
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

    // Let customers' availability previews update live when a worker goes online/offline.
    const coords = worker.currentLocation?.coordinates || worker.location?.coordinates;
    notifyRole('customer', 'workers:availability-changed', {
      workerId: worker._id.toString(),
      isActive: worker.isActive,
      coordinates: Array.isArray(coords) ? coords : null,
    });

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

// ─── Update LIVE/current location (dynamic job-matching radius) ───
// Does NOT change the static signup `location`. Called periodically by the
// worker app/web so the 10km radius follows the worker as they move.
export const updateCurrentLocation = async (req: Request, res: Response): Promise<void> => {
  try {
    const lat = Number(req.body?.latitude);
    const lng = Number(req.body?.longitude);
    const address = typeof req.body?.address === 'string' ? req.body.address : '';
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      res.status(400).json({ message: 'Valid latitude and longitude are required' });
      return;
    }
    await Worker.findByIdAndUpdate(req.user!.id, {
      currentLocation: { type: 'Point', coordinates: [lng, lat], address, updatedAt: new Date() },
    });
    res.json({ message: 'Live location updated' });
  } catch (error) {
    console.error('Update current location error:', error);
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
        rating: worker.rating,
        balance: worker.balance,
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

// ─── Get Reviews / Ratings ───
export const getReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const worker = await Worker.findById(req.user!.id);
    if (!worker) {
      res.status(404).json({ message: 'Worker not found' });
      return;
    }

    const reviewedBookings = await Booking.find({
      assignedWorker: req.user!.id,
      status: 'completed',
      'review.rating': { $exists: true, $ne: null },
    })
      .populate('customer', 'fullName profileImage')
      .populate('category', 'name slug image')
      .sort({ updatedAt: -1 });

    const reviews = reviewedBookings
      .filter((b) => b.review && b.review.rating)
      .map((b) => {
        const customer = b.customer && typeof b.customer === 'object' && '_id' in (b.customer as any)
          ? { fullName: (b.customer as any).fullName || 'Customer', profileImage: (b.customer as any).profileImage || '' }
          : null;
        const category = b.category && typeof b.category === 'object' && '_id' in (b.category as any)
          ? { name: (b.category as any).name || 'Service', slug: (b.category as any).slug || '' }
          : null;

        return {
          _id: b._id,
          rating: b.review!.rating,
          feedback: b.review!.feedback || '',
          createdAt: b.review!.createdAt || b.updatedAt,
          customer,
          category,
          amount: b.amount || 0,
          workDescription: b.workDescription || '',
        };
      });

    res.json({
      rating: worker.rating,
      totalReviews: reviews.length,
      reviews,
    });
  } catch (error) {
    console.error('Get reviews error:', error);
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
    const workerCoordinates = toCoordinateTuple(worker.currentLocation?.coordinates) || toCoordinateTuple(worker.location?.coordinates);
    const hasCategories = Array.isArray(worker.categories) && worker.categories.length > 0;

    let availableBookings: any[] = [];
    if (!hasCategories || !workerCoordinates) {
      availableBookings = [];
    } else {
      // Force normalized tuple so geo query always receives numeric lng/lat.
      worker.location.coordinates = workerCoordinates;
      try {
        availableBookings = await resolveAvailableBookingsForWorker(worker, findingWorkersSince);
      } catch (availableError) {
        console.error('Available booking lookup failed. Returning active/completed requests only.', availableError);
        availableBookings = [];
      }
    }

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

    // Only allow access if: worker is assigned, or booking is available (in worker's categories + 10km radius)
    const isAssigned = booking.assignedWorker?.toString() === req.user!.id;
    const isOpenStatus = ['finding_workers', 'bids_received'].includes(booking.status);

    const workerCategorySet = new Set((worker.categories || []).map((id: any) => id.toString()));
    const bookingCategoryId =
      booking.category && typeof booking.category === 'object' && '_id' in booking.category
        ? String((booking.category as any)._id)
        : String(booking.category || '');
    const isCategoryMatch = bookingCategoryId ? workerCategorySet.has(bookingCategoryId) : false;

    const workerCoordinates = toCoordinateTuple(worker.currentLocation?.coordinates) || toCoordinateTuple(worker.location?.coordinates);
    const bookingCoordinates = toCoordinateTuple(booking.customerLocation?.coordinates);
    const isWithinRadius =
      Boolean(workerCoordinates && bookingCoordinates) &&
      distanceMetersBetween(workerCoordinates as [number, number], bookingCoordinates as [number, number]) <= WORKER_SEARCH_RADIUS_METERS;

    const isAvailable = isOpenStatus && isCategoryMatch && isWithinRadius;

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
        const bidPayload = { ...existingBid.toObject(), worker };
        notifyBookingRoom(bookingId, 'booking:new-bid', {
          bookingId,
          bid: bidPayload,
        });
        notifyUser(customerId, 'booking:new-bid', {
          bookingId,
          bid: bidPayload,
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
    const bidPayload = { ...bid.toObject(), worker };
    notifyBookingRoom(bookingId, 'booking:new-bid', {
      bookingId,
      bid: bidPayload,
    });
    notifyUser(customerId, 'booking:new-bid', {
      bookingId,
      bid: bidPayload,
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

// ─── Respond to Negotiation (Worker accepts / counters / declines) ───
export const respondToNegotiation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: bookingId, bidId } = req.params;
    const { action, amount, message } = req.body;

    if (!['accept', 'counter', 'decline'].includes(action)) {
      res.status(400).json({ message: 'action must be accept | counter | decline' });
      return;
    }

    const bid = await WorkBid.findOne({ _id: bidId, worker: req.user!.id });
    if (!bid) {
      res.status(404).json({ message: 'Bid not found' });
      return;
    }

    if (bid.negotiationStatus !== 'customer_offered') {
      res.status(400).json({ message: 'No pending customer offer to respond to' });
      return;
    }

    const booking = await Booking.findOne({
      _id: bookingId,
      status: { $in: ['finding_workers', 'bids_received'] },
    });
    if (!booking) {
      res.status(400).json({ message: 'Booking no longer available for negotiation' });
      return;
    }

    if (action === 'accept') {
      const lastOffer = bid.negotiations[bid.negotiations.length - 1];
      bid.negotiationStatus = 'agreed';
      bid.agreedAmount = lastOffer.amount;
    } else if (action === 'counter') {
      if (!amount || Number(amount) <= 0) {
        res.status(400).json({ message: 'A valid counter amount is required' });
        return;
      }
      if (bid.negotiations.length >= 10) {
        res.status(400).json({ message: 'Maximum negotiation rounds reached' });
        return;
      }
      bid.negotiations.push({ by: 'worker', amount: Number(amount), message: message || '', createdAt: new Date() });
      bid.negotiationStatus = 'worker_offered';
    } else {
      bid.negotiationStatus = 'declined';
    }

    await bid.save();

    notifyUser(booking.customer.toString(), 'booking:bid-negotiation', { bookingId, bid });

    res.json({ message: 'Response sent', bid });
  } catch (error) {
    console.error('Respond to negotiation error:', error);
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

    // Scheduled booking: the worker cannot start before the customer's chosen time.
    if (booking.scheduledAt && Date.now() < new Date(booking.scheduledAt).getTime()) {
      res.status(403).json({
        message: 'This job is scheduled for a later time. You can start once the scheduled time arrives.',
        scheduledAt: booking.scheduledAt,
      });
      return;
    }

    // Check if worker already has an active job (approved/paid/in-progress).
    // A worker can only work on one job at a time.
    const activeJob = await Booking.findOne({
      assignedWorker: req.user!.id,
      status: { $in: ['worker_approved', 'payment_done', 'in_progress'] },
      _id: { $ne: booking._id },
    });

    if (activeJob) {
      res.status(409).json({
        message: 'You already have an active job in progress. Complete it first before approving another.',
        activeBookingId: activeJob._id,
      });
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
    booking.completionRequestedByWorkerAt = undefined;
    booking.completionCodeRevealedAt = undefined;
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
    void removeBookingVoiceNote(booking);

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

// ─── Worker requests customer completion code ───
export const requestCompletionCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      assignedWorker: req.user!.id,
      status: { $in: ['payment_done', 'in_progress'] },
    });

    if (!booking) {
      res.status(404).json({ message: 'Booking not found' });
      return;
    }

    if (!booking.completionPin) {
      res.status(400).json({ message: 'Completion code is not generated yet' });
      return;
    }

    if (!booking.completionRequestedByWorkerAt) {
      booking.completionRequestedByWorkerAt = new Date();
    }

    // Move to in-progress once worker explicitly marks work as completed/requesting final customer confirmation.
    if (booking.status === 'payment_done') {
      booking.status = 'in_progress';
    }

    await booking.save();

    const payload = {
      bookingId: booking._id,
      status: booking.status,
      completionCodeRequested: true,
      message: 'Worker marked work as completed and requested your completion code.',
    };

    const customerId = booking.customer.toString();
    notifyUser(customerId, 'booking_status_updated', payload);
    notifyUser(req.user!.id, 'booking_status_updated', payload);

    await sendNotification({
      recipientId: customerId,
      recipientModel: 'User',
      type: 'completion_code_requested',
      title: 'Work Completion Confirmation Needed',
      message: 'Worker requested your completion code. Reveal and share the code only after work is fully done.',
      data: { bookingId: booking._id },
    });

    res.json({
      message: 'Completion code request sent to customer',
      booking,
    });
  } catch (error) {
    console.error('Request completion code error:', error);
    res.status(500).json({ message: 'Server error' });
  }
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

    if (!booking.completionRequestedByWorkerAt) {
      res.status(400).json({ message: 'Please request completion code from customer first' });
      return;
    }

    if (!booking.completionCodeRevealedAt) {
      res.status(400).json({ message: 'Customer has not revealed completion code yet' });
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
    void removeBookingVoiceNote(booking);

    const worker = await Worker.findById(req.user!.id);
    if (!worker) {
      res.status(404).json({ message: 'Worker not found' });
      return;
    }

    // FREE platform — no commission, no dues. Worker keeps 100%.
    const workerEarning = booking.amount;
    if (booking.paymentMethod === 'online') {
      worker.balance += workerEarning;
    }
    // Cash: worker already collected in hand, nothing to add to balance.

    worker.totalWorkDone += 1;
    worker.totalEarnings += workerEarning;
    await worker.save();

    if (isCashBooking) {
      const cashPaymentAmount = booking.amount;
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
      totalEarnings: worker.totalEarnings,
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
      type: 'worker_earning',
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
        select: 'workDescription category amount paymentMethod customer',
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
        },
      },
    ]);

    const earningsSummary = summary.find((s) => s._id === 'worker_earning');

    res.json({
      balance: worker.balance,
      totalEarnings: worker.totalEarnings,
      totalJobs: earningsSummary?.count || 0,
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

// ───────────────────────────────────────────────────────────────
// Worker skill management (post-approval)
// ───────────────────────────────────────────────────────────────

// GET /worker/skills — current skills + edit eligibility
export const getSkills = async (req: Request, res: Response): Promise<void> => {
  try {
    const worker = await Worker.findById(req.user!.id).populate('skills.category', 'name image');
    if (!worker) { res.status(404).json({ message: 'Worker not found' }); return; }
    res.json({
      skills: worker.skills || [],
      accountAgeMonths: accountAgeMonths(worker.createdAt),
      maxExperienceBumps: maxExperienceBumps(worker.createdAt),
      canEditExperience: accountAgeMonths(worker.createdAt) >= 6,
    });
  } catch (error) {
    console.error('Get skills error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /worker/skills/request — add a NEW skill (goes to admin review)
export const requestSkill = async (req: Request, res: Response): Promise<void> => {
  try {
    const categoryId = typeof req.body?.categoryId === 'string' ? req.body.categoryId : '';
    const experienceYears = Math.max(0, Math.min(60, Number(req.body?.experienceYears) || 0));
    const confirmed = req.body?.confirmed === true || req.body?.confirmed === 'true';
    if (!categoryId) { res.status(400).json({ message: 'Category is required' }); return; }
    if (!confirmed) { res.status(400).json({ message: 'Please confirm you can do this work' }); return; }

    const category = await Category.findById(categoryId).select('_id name');
    if (!category) { res.status(404).json({ message: 'Category not found' }); return; }

    const worker = await Worker.findById(req.user!.id);
    if (!worker) { res.status(404).json({ message: 'Worker not found' }); return; }

    const existing = (worker.skills || []).find((s) => String(s.category) === categoryId);
    if (existing && existing.status !== 'rejected') {
      res.status(400).json({ message: existing.status === 'pending_review' ? 'This skill is already under review' : 'You already have this skill' });
      return;
    }
    if (existing) {
      // Re-applying a previously removed/rejected skill → full process again.
      existing.experienceYears = experienceYears;
      existing.confirmed = confirmed;
      existing.status = 'pending_review';
      existing.experienceBumpsUsed = 0;
      existing.callAttempts = 0;
      existing.rejectionReason = '';
      existing.requestedAt = new Date();
      existing.decidedAt = null;
    } else {
      worker.skills = worker.skills || [];
      worker.skills.push({
        category: category._id, experienceYears, confirmed, status: 'pending_review',
        experienceBumpsUsed: 0, callAttempts: 0, requestedAt: new Date(), decidedAt: null,
      } as any);
    }
    await worker.save();

    await sendAdminNotification({
      type: 'skill_request',
      title: 'Worker Skill Request',
      message: `${worker.fullName} requested to add "${category.name}" (${experienceYears} yr exp). Verify on a call.`,
      data: { workerId: String(worker._id) },
    }).catch(() => {});

    res.status(201).json({ message: 'Skill request submitted for review. Our team will verify on a call.' });
  } catch (error) {
    console.error('Request skill error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /worker/skills/:skillId/bump-experience — +6 months (gated by account age)
export const bumpSkillExperience = async (req: Request, res: Response): Promise<void> => {
  try {
    const worker = await Worker.findById(req.user!.id);
    if (!worker) { res.status(404).json({ message: 'Worker not found' }); return; }
    const skill = (worker.skills || []).find((s) => String((s as any)._id) === req.params.skillId);
    if (!skill || skill.status !== 'approved') { res.status(400).json({ message: 'Skill not found or not approved' }); return; }

    const allowed = maxExperienceBumps(worker.createdAt);
    if (accountAgeMonths(worker.createdAt) < 6) {
      res.status(400).json({ message: 'Experience can be updated only after 6 months on Fixo.' });
      return;
    }
    if (skill.experienceBumpsUsed >= allowed) {
      res.status(400).json({ message: 'No experience update available yet. You can add +6 months for every 6 months on Fixo.' });
      return;
    }
    skill.experienceYears = Math.round((skill.experienceYears + 0.5) * 10) / 10;
    skill.experienceBumpsUsed += 1;
    await worker.save();
    res.json({ message: 'Experience updated (+6 months)', experienceYears: skill.experienceYears });
  } catch (error) {
    console.error('Bump experience error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /worker/skills/:skillId/unselect — remove a skill (re-adding restarts review)
export const unselectSkill = async (req: Request, res: Response): Promise<void> => {
  try {
    const worker = await Worker.findById(req.user!.id);
    if (!worker) { res.status(404).json({ message: 'Worker not found' }); return; }
    const before = (worker.skills || []).length;
    const filtered = (worker.skills || []).filter((s) => String((s as any)._id) !== req.params.skillId);
    if (filtered.length === before) { res.status(404).json({ message: 'Skill not found' }); return; }
    worker.skills = filtered as any;
    syncCategoriesFromSkills(worker);
    await worker.save();
    res.json({ message: 'Skill removed. To add it again you will go through verification.' });
  } catch (error) {
    console.error('Unselect skill error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Generate Video KYC Token (for mobile app to open browser) ───
export const generateVideoKycToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const worker = await Worker.findById(req.user!.id);
    if (!worker) { res.status(404).json({ message: 'Worker not found' }); return; }

    // Only allow if in ekyc_pending or test status
    if (!['test', 'ekyc_pending'].includes(worker.accountStatus)) {
      res.status(400).json({ message: 'Video KYC not available in current status' }); return;
    }

    // Check cooldown
    if (worker.videoKycRetryAvailableAt && worker.videoKycRetryAvailableAt > new Date()) {
      res.status(400).json({
        message: 'Please wait before retrying Video KYC',
        retryAvailableAt: worker.videoKycRetryAvailableAt,
      }); return;
    }

    // Generate a JWT token valid for 15 minutes (enough for the call)
    const token = jwt.sign(
      { id: worker._id.toString(), purpose: 'video-kyc' },
      env.JWT_SECRET,
      { expiresIn: '15m' } as SignOptions,
    );

    // The URL should point to the worker web app's video-kyc page
    const baseUrl = env.WORKER_CLIENT_URL || env.CLIENT_URLS.find((u) => u.includes('fixoworker')) || env.CLIENT_URLS.find((u) => u.includes(':4000')) || 'https://fixoworker.vercel.app';
    const url = `${baseUrl}/video-kyc/${token}`;

    res.json({ token, url });
  } catch (error) {
    console.error('Generate video KYC token error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
