import { Request, Response } from 'express';
import Worker from '../models/Worker';
import User from '../models/User';
import Booking from '../models/Booking';
import Transaction from '../models/Transaction';
import Withdrawal from '../models/Withdrawal';
import Category from '../models/Category';
import Banner from '../models/Banner';
import HelpTicket from '../models/HelpTicket';
import RewardClaim from '../models/RewardClaim';
import ChatbotQA from '../models/ChatbotQA';
import { notifyUser, notifyRole, sendNotification } from '../socket';
import { logAdminActivity } from '../utils/adminActivity';
import { blockPayload } from '../utils/userBlock';
import MobilePushToken from '../models/MobilePushToken';
import PushSubscription from '../models/PushSubscription';
import Waitlist from '../models/Waitlist';
import { sendMobilePushNotification } from '../services/mobilePush.service';
import { sendWebPushNotification } from '../services/webPush.service';
import Notification from '../models/Notification';
import { deleteFromCloudinary, uploadBufferToCloudinary } from '../services/cloudinary.service';
import { getSeedAdminBootstrapStatus } from '../services/adminBootstrap.service';

const VIDEO_KYC_RETRY_COOLDOWN_MS = 3 * 60 * 1000;

// ─── Dashboard Cache (2-minute TTL) ───
let _dashboardCache: { data: unknown; cachedAt: number } | null = null;
const DASHBOARD_CACHE_TTL_MS = 2 * 60 * 1000;
export const clearDashboardCache = () => { _dashboardCache = null; };

// ─── Dashboard Stats ───
export const getDashboard = async (_req: Request, res: Response): Promise<void> => {
  if (_dashboardCache && Date.now() - _dashboardCache.cachedAt < DASHBOARD_CACHE_TTL_MS) {
    res.json(_dashboardCache.data);
    return;
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalWorkers,
      activeWorkers,
      pendingEKYC,
      pendingWithdrawals,
      totalCustomers,
      pendingHelpTickets,
      todayWorkDone,
      totalBookings,
      totalCompleted,
      totalCancelled,
      totalInProgress,
    ] = await Promise.all([
      Worker.countDocuments(),
      Worker.countDocuments({ isActive: true, accountStatus: 'live' }),
      Worker.countDocuments({ accountStatus: { $in: ['test', 'ekyc_pending', 'ekyc_done'] } }),
      Withdrawal.countDocuments({ status: 'pending' }),
      User.countDocuments(),
      HelpTicket.countDocuments({ status: { $in: ['open', 'escalated'] } }),
      Booking.countDocuments({ status: 'completed', updatedAt: { $gte: today } }),
      Booking.countDocuments(),
      Booking.countDocuments({ status: 'completed' }),
      Booking.countDocuments({ status: 'cancelled' }),
      Booking.countDocuments({ status: 'in_progress' }),
    ]);

    // --- Chart Data: Last 7 days bookings (daily) ---
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const dailyBookings = await Booking.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            status: '$status',
          },
          count: { $sum: 1 },
        },
      },
    ]);

    // Build last 7 days bookings array
    const bookingsChart: { date: string; completed: number; cancelled: number; other: number; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayLabel = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });

      let completed = 0, cancelled = 0, other = 0;
      for (const b of dailyBookings) {
        if (b._id.date === dateStr) {
          if (b._id.status === 'completed') completed = b.count;
          else if (b._id.status === 'cancelled') cancelled = b.count;
          else other += b.count;
        }
      }
      bookingsChart.push({ date: dayLabel, completed, cancelled, other, total: completed + cancelled + other });
    }

    // --- Donut: Booking status distribution ---
    const bookingStatusAgg = await Booking.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const statusLabels: Record<string, string> = {
      finding_workers: 'Finding Workers', bids_received: 'Bids Received',
      worker_accepted: 'Worker Accepted', worker_approved: 'Approved',
      payment_done: 'Payment Done', in_progress: 'In Progress',
      completed: 'Completed', cancelled: 'Cancelled',
    };
    const bookingStatusDonut = bookingStatusAgg.map((s) => ({
      name: statusLabels[s._id] || s._id,
      value: s.count,
    }));

    // --- Donut: Payment method split ---
    const payMethodAgg = await Booking.aggregate([
      { $match: { status: 'completed', paymentMethod: { $in: ['online', 'cash'] } } },
      { $group: { _id: '$paymentMethod', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } },
    ]);
    const paymentMethodDonut = payMethodAgg.map((p) => ({
      name: p._id === 'online' ? 'Online' : 'Cash',
      count: p.count,
      value: p.totalAmount,
    }));

    // --- Donut: Worker status ---
    const workerStatusAgg = await Worker.aggregate([
      { $group: { _id: '$accountStatus', count: { $sum: 1 } } },
    ]);
    const workerStatusLabels: Record<string, string> = {
      test: 'Test', ekyc_pending: 'eKYC Pending', ekyc_done: 'eKYC Done',
      approved: 'Approved', live: 'Live', rejected: 'Rejected', suspended: 'Suspended',
    };
    const workerStatusDonut = workerStatusAgg.map((w) => ({
      name: workerStatusLabels[w._id] || w._id,
      value: w.count,
    }));

    // --- Top categories by completed bookings ---
    const topCategories = await Booking.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: '$category', count: { $sum: 1 }, revenue: { $sum: '$amount' } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
      { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'cat' } },
      { $unwind: { path: '$cat', preserveNullAndEmptyArrays: true } },
      { $project: { name: { $ifNull: ['$cat.name', 'Unknown'] }, count: 1, revenue: 1 } },
    ]);

    const responseData = {
      totalWorkers,
      activeWorkers,
      pendingEKYC,
      pendingWithdrawals,
      totalCustomers,
      pendingHelpTickets,
      todayWorkDone,
      totalBookings,
      totalCompleted,
      totalCancelled,
      totalInProgress,
      bookingsChart,
      bookingStatusDonut,
      paymentMethodDonut,
      workerStatusDonut,
      topCategories,
    };

    _dashboardCache = { data: responseData, cachedAt: Date.now() };
    res.json(responseData);
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Lightweight Pending Badge Counts ───
export const getPendingAdminBadges = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [pendingEKYC, pendingWithdrawals, pendingRefunds, pendingSupport, pendingRewardClaims] = await Promise.all([
      Worker.countDocuments({ accountStatus: { $in: ['test', 'ekyc_pending', 'ekyc_done'] } }),
      Withdrawal.countDocuments({ status: 'pending' }),
      Booking.countDocuments({ paymentStatus: 'refund_pending' }),
      HelpTicket.countDocuments({ status: { $in: ['open', 'escalated'] } }),
      RewardClaim.countDocuments({ status: 'pending_approval' }),
    ]);

    const pendingFinance = pendingWithdrawals + pendingRefunds;
    const totalActionRequired = pendingEKYC + pendingFinance + pendingSupport + pendingRewardClaims;

    res.json({
      pendingEKYC,
      pendingWithdrawals,
      pendingRefunds,
      pendingSupport,
      pendingRewardClaims,
      pendingFinance,
      totalActionRequired,
    });
  } catch (error) {
    console.error('Pending admin badges error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Admin Bootstrap Sync Status (Admin-only) ───
export const getAdminBootstrapStatus = async (_req: Request, res: Response): Promise<void> => {
  try {
    const status = await getSeedAdminBootstrapStatus();
    res.json(status);
  } catch (error) {
    console.error('Admin bootstrap status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── EKYC: Get Pending Workers ───
export const getPendingEKYC = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [workers, approvedCount, rejectedCount] = await Promise.all([
      Worker.find({ accountStatus: { $in: ['test', 'ekyc_pending', 'ekyc_done'] } }).sort({ createdAt: -1 }),
      Worker.countDocuments({ accountStatus: { $in: ['approved', 'live'] } }),
      Worker.countDocuments({ accountStatus: 'rejected' }),
    ]);

    res.json({ workers, approvedCount, rejectedCount });
  } catch (error) {
    console.error('Get pending EKYC error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── EKYC: Get Worker Details ───
export const getWorkerEKYCDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const worker = await Worker.findById(req.params.workerId);
    if (!worker) {
      res.status(404).json({ message: 'Worker not found' });
      return;
    }
    res.json({ worker });
  } catch (error) {
    console.error('Get worker EKYC details error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── EKYC: Save Post-Call Video KYC Result ───
export const updateVideoKycResult = async (req: Request, res: Response): Promise<void> => {
  try {
    const { result, reason } = req.body as { result?: 'completed' | 'incomplete'; reason?: string };

    if (result !== 'completed' && result !== 'incomplete') {
      res.status(400).json({ message: 'Result must be either completed or incomplete' });
      return;
    }

    const worker = await Worker.findById(req.params.workerId);
    if (!worker) {
      res.status(404).json({ message: 'Worker not found' });
      return;
    }

    if (result === 'completed') {
      worker.accountStatus = 'ekyc_done';
      worker.ekycRejectionReason = undefined;
      worker.videoKycIncompleteReason = '';
      worker.videoKycRetryAvailableAt = null;

      await worker.save();

      notifyUser(worker._id.toString(), 'kyc_status_updated', {
        workerId: worker._id,
        status: 'ekyc_completed',
        worker,
      });

      res.json({
        message: 'Video KYC marked as complete. Worker moved to verification queue.',
        worker,
      });
      return;
    }

    const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
    if (!trimmedReason) {
      res.status(400).json({ message: 'Reason is required when marking video KYC incomplete' });
      return;
    }

    const retryAvailableAt = new Date(Date.now() + VIDEO_KYC_RETRY_COOLDOWN_MS);

    worker.accountStatus = 'ekyc_pending';
    worker.ekycRejectionReason = undefined;
    worker.videoKycIncompleteReason = trimmedReason;
    worker.videoKycRetryAvailableAt = retryAvailableAt;

    await worker.save();

    notifyUser(worker._id.toString(), 'kyc_status_updated', {
      workerId: worker._id,
      status: 'ekyc_incomplete',
      reason: trimmedReason,
      retryAvailableAt: retryAvailableAt.toISOString(),
      worker,
    });

    res.json({
      message: 'Video KYC marked incomplete. Worker can retry after cooldown.',
      worker,
      retryAvailableAt: retryAvailableAt.toISOString(),
    });
  } catch (error) {
    console.error('Update video KYC result error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── EKYC: Approve Worker ───
export const approveWorker = async (req: Request, res: Response): Promise<void> => {
  try {
    const worker = await Worker.findByIdAndUpdate(
      req.params.workerId,
      {
        accountStatus: 'approved',
        isActive: true,
        ekycRejectionReason: undefined,
        videoKycIncompleteReason: '',
        videoKycRetryAvailableAt: null,
      },
      { new: true }
    );

    if (!worker) {
      res.status(404).json({ message: 'Worker not found' });
      return;
    }

    // Notify worker in real-time so their page updates instantly
    notifyUser(worker._id.toString(), 'kyc_status_updated', {
      workerId: worker._id,
      status: 'approved',
      worker,
    });

    clearDashboardCache();
    await logAdminActivity(req, { action: 'kyc.approve', category: 'kyc', targetType: 'worker', targetId: String(worker._id) });
    res.json({ message: 'Worker approved', worker });
  } catch (error) {
    console.error('Approve worker error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── EKYC: Reject Worker ───
export const rejectWorker = async (req: Request, res: Response): Promise<void> => {
  try {
    const { reason } = req.body;
    const worker = await Worker.findByIdAndUpdate(
      req.params.workerId,
      {
        accountStatus: 'rejected',
        ekycRejectionReason: reason,
        videoKycIncompleteReason: '',
        videoKycRetryAvailableAt: null,
      },
      { new: true }
    );

    if (!worker) {
      res.status(404).json({ message: 'Worker not found' });
      return;
    }

    // Notify worker in real-time so their page updates instantly
    notifyUser(worker._id.toString(), 'kyc_status_updated', {
      workerId: worker._id,
      status: 'rejected',
      reason,
    });

    clearDashboardCache();
    await logAdminActivity(req, { action: 'kyc.reject', category: 'kyc', targetType: 'worker', targetId: String(worker._id) });
    res.json({ message: 'Worker rejected', worker });
  } catch (error) {
    console.error('Reject worker error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── EKYC: Save Capture from Video KYC ───
export const saveEkycCapture = async (req: Request, res: Response): Promise<void> => {
  try {
    const { workerId } = req.params;
    const { imageData } = req.body; // base64 data URL

    if (!imageData || typeof imageData !== 'string') {
      res.status(400).json({ message: 'Image data is required' });
      return;
    }

    const worker = await Worker.findById(workerId);
    if (!worker) {
      res.status(404).json({ message: 'Worker not found' });
      return;
    }

    // Convert base64 to buffer and upload to Cloudinary
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const { url } = await uploadBufferToCloudinary(buffer, 'ekyc-captures');

    worker.ekycCaptures.push({ url, capturedAt: new Date() });
    await worker.save();

    res.json({ message: 'Capture saved', url });
  } catch (error) {
    console.error('Save eKYC capture error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Withdrawals Management ───
export const getWithdrawals = async (_req: Request, res: Response): Promise<void> => {
  try {
    const withdrawals = await Withdrawal.find()
      .populate('worker', 'fullName phone profileImage')
      .sort({ requestedAt: -1 });

    res.json({ withdrawals });
  } catch (error) {
    console.error('Get withdrawals error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const completeWithdrawal = async (req: Request, res: Response): Promise<void> => {
  try {
    const withdrawal = await Withdrawal.findByIdAndUpdate(
      req.params.id,
      { status: 'completed', processedAt: new Date() },
      { new: true }
    );

    if (!withdrawal) {
      res.status(404).json({ message: 'Withdrawal not found' });
      return;
    }

    // Create transaction
    await Transaction.create({
      tid: (await import('../utils/generateTID')).generateTID(),
      worker: withdrawal.worker,
      type: 'withdrawal',
      amount: withdrawal.amount,
      method: 'online',
      status: 'completed',
    });

    notifyUser(withdrawal.worker.toString(), 'withdrawal_update', {
      withdrawalId: withdrawal._id,
      status: 'completed',
      withdrawal,
    });
    notifyRole('admin', 'withdrawal_update', {
      withdrawalId: withdrawal._id,
      status: 'completed',
      withdrawal,
    });

    clearDashboardCache();
    await logAdminActivity(req, { action: 'withdrawal.complete', category: 'withdrawals', targetType: 'withdrawal', targetId: String(withdrawal._id), amount: withdrawal.amount });
    res.json({ message: 'Withdrawal completed', withdrawal });
  } catch (error) {
    console.error('Complete withdrawal error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const declineWithdrawal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { reason } = req.body;
    const withdrawal = await Withdrawal.findById(req.params.id);

    if (!withdrawal || withdrawal.status !== 'pending') {
      res.status(404).json({ message: 'Pending withdrawal not found' });
      return;
    }

    withdrawal.status = 'declined';
    withdrawal.declineReason = reason;
    withdrawal.processedAt = new Date();
    await withdrawal.save();

    // Refund amount back to worker
    await Worker.findByIdAndUpdate(withdrawal.worker, {
      $inc: { balance: withdrawal.amount },
    });

    notifyUser(withdrawal.worker.toString(), 'withdrawal_update', {
      withdrawalId: withdrawal._id,
      status: 'declined',
      reason,
      withdrawal,
    });
    notifyRole('admin', 'withdrawal_update', {
      withdrawalId: withdrawal._id,
      status: 'declined',
      reason,
      withdrawal,
    });

    await logAdminActivity(req, { action: 'withdrawal.decline', category: 'withdrawals', targetType: 'withdrawal', targetId: String(withdrawal._id), amount: withdrawal.amount });
    res.json({ message: 'Withdrawal declined, amount refunded to worker', withdrawal });
  } catch (error) {
    console.error('Decline withdrawal error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Category Management ───
export const getCategories = async (_req: Request, res: Response): Promise<void> => {
  try {
    const categories = await Category.find().sort({ order: 1 });
    res.json({ categories });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const createCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, order } = req.body;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    let image = '';
    if (req.file) {
      const uploaded = await uploadBufferToCloudinary(req.file.buffer, 'categories');
      image = uploaded.url;
    }

    const category = await Category.create({ name, slug, image, description, order: order || 0 });

    notifyRole('customer', 'service_updated', { action: 'created', category });
    notifyRole('worker', 'service_updated', { action: 'created', category });
    notifyRole('admin', 'service_updated', { action: 'created', category });

    // Auto-announce the new service to every customer and worker
    // (in-app notification + live banner + push).
    const data = { categoryId: String(category._id) };
    void broadcastToAudience(
      'customer',
      'New Service Available! 🎉',
      `You can now get "${category.name}" done on Fixo. Book this service now!`,
      data,
      'service_added',
    ).catch(() => {});
    void broadcastToAudience(
      'worker',
      'New Service Added! 🛠️',
      `You can now take "${category.name}" jobs. Update your skills in Settings if you offer this service.`,
      data,
      'service_added',
    ).catch(() => {});

    res.status(201).json({ message: 'Category created', category });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, isActive, order } = req.body;
    const updateData: Record<string, unknown> = {};

    if (name) {
      updateData.name = name;
      updateData.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (order !== undefined) updateData.order = order;

    if (req.file) {
      const uploaded = await uploadBufferToCloudinary(req.file.buffer, 'categories');
      updateData.image = uploaded.url;
    }

    const category = await Category.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (category) {
      notifyRole('customer', 'service_updated', { action: 'updated', category });
      notifyRole('worker', 'service_updated', { action: 'updated', category });
      notifyRole('admin', 'service_updated', { action: 'updated', category });
    }
    res.json({ message: 'Category updated', category });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateCategoryDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tagline, services, highlights, faqs, priceStartsFrom } = req.body;
    const updateData: Record<string, unknown> = {};

    if (tagline !== undefined) updateData.tagline = tagline;
    if (services !== undefined) updateData.services = services;
    if (highlights !== undefined) updateData.highlights = highlights;
    if (faqs !== undefined) updateData.faqs = faqs;
    if (priceStartsFrom !== undefined) updateData.priceStartsFrom = priceStartsFrom;

    const category = await Category.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!category) {
      res.status(404).json({ message: 'Category not found' });
      return;
    }

    notifyRole('customer', 'service_updated', { action: 'updated', category });
    notifyRole('worker', 'service_updated', { action: 'updated', category });
    notifyRole('admin', 'service_updated', { action: 'updated', category });

    res.json({ message: 'Category details updated', category });
  } catch (error) {
    console.error('Update category details error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    notifyRole('customer', 'service_updated', { action: 'deleted', categoryId: req.params.id, category });
    notifyRole('worker', 'service_updated', { action: 'deleted', categoryId: req.params.id, category });
    notifyRole('admin', 'service_updated', { action: 'deleted', categoryId: req.params.id, category });
    res.json({ message: 'Category deleted' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Banner Management ───
const DEFAULT_BANNER_EDITOR = {
  crop: { x: 0, y: 0 },
  zoom: 1,
  fitMode: 'cover' as const,
  safeArea: true,
  focusX: 50,
  focusY: 50,
  brightness: 100,
  contrast: 100,
  blur: 0,
};

const parseJSONField = <T>(value: unknown, fallback: T): T => {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(value) as object) } as T;
  } catch {
    return fallback;
  }
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const toNumber = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const parseBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
};

const isValidHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const parseEditorConfig = (input: unknown) => {
  const editorInput = parseJSONField(input, DEFAULT_BANNER_EDITOR);
  const editorLike = editorInput as {
    crop?: { x?: unknown; y?: unknown };
    zoom?: unknown;
    fitMode?: unknown;
    safeArea?: unknown;
    focusX?: unknown;
    focusY?: unknown;
    brightness?: unknown;
    contrast?: unknown;
    blur?: unknown;
  };
  const fitMode = editorLike.fitMode === 'contain' ? 'contain' : 'cover';

  return {
    crop: {
      x: clamp(toNumber(editorLike.crop?.x, DEFAULT_BANNER_EDITOR.crop.x), -100, 100),
      y: clamp(toNumber(editorLike.crop?.y, DEFAULT_BANNER_EDITOR.crop.y), -100, 100),
    },
    zoom: clamp(toNumber(editorLike.zoom, DEFAULT_BANNER_EDITOR.zoom), 1, 3),
    fitMode,
    safeArea: parseBoolean(editorLike.safeArea, true),
    focusX: clamp(toNumber(editorLike.focusX, DEFAULT_BANNER_EDITOR.focusX), 0, 100),
    focusY: clamp(toNumber(editorLike.focusY, DEFAULT_BANNER_EDITOR.focusY), 0, 100),
    brightness: clamp(toNumber(editorLike.brightness, DEFAULT_BANNER_EDITOR.brightness), 50, 150),
    contrast: clamp(toNumber(editorLike.contrast, DEFAULT_BANNER_EDITOR.contrast), 50, 150),
    blur: clamp(toNumber(editorLike.blur, DEFAULT_BANNER_EDITOR.blur), 0, 20),
  };
};

const parseCTAConfig = (input: unknown) => {
  const raw = parseJSONField(input, { enabled: false, text: '', url: '' });
  return {
    enabled: parseBoolean(raw.enabled, false),
    text: typeof raw.text === 'string' ? raw.text.trim() : '',
    url: typeof raw.url === 'string' ? raw.url.trim() : '',
  };
};

const parseScheduleConfig = (input: unknown) => {
  const raw = parseJSONField(input, { startAt: null as string | null, endAt: null as string | null });
  const startAt = raw.startAt ? new Date(raw.startAt) : null;
  const endAt = raw.endAt ? new Date(raw.endAt) : null;
  return {
    startAt: startAt && !Number.isNaN(startAt.getTime()) ? startAt : null,
    endAt: endAt && !Number.isNaN(endAt.getTime()) ? endAt : null,
  };
};

const isScheduleValid = (startAt: Date | null, endAt: Date | null): boolean => {
  if (!startAt || !endAt) return true;
  return startAt.getTime() <= endAt.getTime();
};

export const getBanners = async (_req: Request, res: Response): Promise<void> => {
  try {
    const banners = await Banner.find().sort({ order: 1 });
    res.json({ banners });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const createBanner = async (req: Request, res: Response): Promise<void> => {
  try {
    const { linkUrl = '', targetPage = '', order, editorConfig, ctaConfig, scheduleConfig } = req.body;

    if (!req.file) {
      res.status(400).json({ message: 'Banner image is required' });
      return;
    }

    const editor = parseEditorConfig(editorConfig);
    const cta = parseCTAConfig(ctaConfig);
    const schedule = parseScheduleConfig(scheduleConfig);

    if (cta.enabled) {
      if (!cta.text) {
        res.status(400).json({ message: 'CTA text is required when CTA is enabled' });
        return;
      }
      if (!cta.url || !isValidHttpUrl(cta.url)) {
        res.status(400).json({ message: 'CTA URL must be a valid http/https URL' });
        return;
      }
    }

    const safeLink = typeof linkUrl === 'string' ? linkUrl.trim() : '';
    if (safeLink && !isValidHttpUrl(safeLink)) {
      res.status(400).json({ message: 'Link URL must be a valid http/https URL' });
      return;
    }

    if (!isScheduleValid(schedule.startAt, schedule.endAt)) {
      res.status(400).json({ message: 'Schedule start date must be before end date' });
      return;
    }

    const uploaded = await uploadBufferToCloudinary(req.file.buffer, 'banners');

    const numericOrder = Number.isFinite(Number(order)) ? Number(order) : 0;

    const banner = await Banner.create({
      image: uploaded.url,
      imagePublicId: uploaded.publicId,
      linkUrl: safeLink,
      targetPage,
      order: numericOrder,
      editor,
      cta,
      schedule,
    });

    notifyRole('customer', 'banner_updated', { action: 'created', banner });
    notifyRole('worker', 'banner_updated', { action: 'created', banner });
    notifyRole('admin', 'banner_updated', { action: 'created', banner });

    res.status(201).json({ message: 'Banner created', banner });
  } catch (error) {
    console.error('Create banner error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteBanner = async (req: Request, res: Response): Promise<void> => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id);
    if (banner?.imagePublicId) {
      try {
        await deleteFromCloudinary(banner.imagePublicId);
      } catch {
        // do not block deletion response on cloudinary cleanup failure
      }
    }
    notifyRole('customer', 'banner_updated', { action: 'deleted', bannerId: req.params.id, banner });
    notifyRole('worker', 'banner_updated', { action: 'deleted', bannerId: req.params.id, banner });
    notifyRole('admin', 'banner_updated', { action: 'deleted', bannerId: req.params.id, banner });
    res.json({ message: 'Banner deleted' });
  } catch (error) {
    console.error('Delete banner error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateBanner = async (req: Request, res: Response): Promise<void> => {
  try {
    const { linkUrl, targetPage, isActive, order, editorConfig, ctaConfig, scheduleConfig } = req.body;
    const updateData: Record<string, unknown> = {};
    const existing = await Banner.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ message: 'Banner not found' });
      return;
    }

    if (linkUrl !== undefined) {
      const safeLink = typeof linkUrl === 'string' ? linkUrl.trim() : '';
      if (safeLink && !isValidHttpUrl(safeLink)) {
        res.status(400).json({ message: 'Link URL must be a valid http/https URL' });
        return;
      }
      updateData.linkUrl = safeLink;
    }
    if (targetPage !== undefined) updateData.targetPage = targetPage;
    if (isActive !== undefined) updateData.isActive = isActive === 'true' || isActive === true;
    if (order !== undefined) updateData.order = toNumber(order, existing.order);

    if (editorConfig !== undefined) {
      updateData.editor = parseEditorConfig(editorConfig);
    }

    if (ctaConfig !== undefined) {
      const cta = parseCTAConfig(ctaConfig);
      if (cta.enabled) {
        if (!cta.text) {
          res.status(400).json({ message: 'CTA text is required when CTA is enabled' });
          return;
        }
        if (!cta.url || !isValidHttpUrl(cta.url)) {
          res.status(400).json({ message: 'CTA URL must be a valid http/https URL' });
          return;
        }
      }
      updateData.cta = cta;
    }

    if (scheduleConfig !== undefined) {
      const schedule = parseScheduleConfig(scheduleConfig);
      if (!isScheduleValid(schedule.startAt, schedule.endAt)) {
        res.status(400).json({ message: 'Schedule start date must be before end date' });
        return;
      }
      updateData.schedule = schedule;
    }

    if (req.file) {
      const uploaded = await uploadBufferToCloudinary(req.file.buffer, 'banners');
      updateData.image = uploaded.url;
      updateData.imagePublicId = uploaded.publicId;

      if (existing.imagePublicId) {
        try {
          await deleteFromCloudinary(existing.imagePublicId);
        } catch {
          // non-blocking cleanup
        }
      }
    }

    const banner = await Banner.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (banner) {
      notifyRole('customer', 'banner_updated', { action: 'updated', banner });
      notifyRole('worker', 'banner_updated', { action: 'updated', banner });
      notifyRole('admin', 'banner_updated', { action: 'updated', banner });
    }
    res.json({ message: 'Banner updated', banner });
  } catch (error) {
    console.error('Update banner error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const reorderBanners = async (req: Request, res: Response): Promise<void> => {
  try {
    const { bannerIds } = req.body as { bannerIds?: string[] };
    if (!Array.isArray(bannerIds) || bannerIds.length === 0) {
      res.status(400).json({ message: 'bannerIds array is required' });
      return;
    }

    const updates = bannerIds.map((id, index) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { order: index } },
      },
    }));

    if (updates.length > 0) {
      await Banner.bulkWrite(updates);
    }

    const banners = await Banner.find().sort({ order: 1 });

    notifyRole('customer', 'banner_updated', { action: 'reordered' });
    notifyRole('worker', 'banner_updated', { action: 'reordered' });
    notifyRole('admin', 'banner_updated', { action: 'reordered' });

    res.json({ message: 'Banners reordered', banners });
  } catch (error) {
    console.error('Reorder banners error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Customers List ───
export const getCustomers = async (req: Request, res: Response): Promise<void> => {
  try {
    const q = (req.query.q as string || '').trim();
    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string || '50', 10)));
    const skip = (page - 1) * limit;

    const searchFilter = q
      ? { $or: [
          { fullName: { $regex: q, $options: 'i' } },
          { email:    { $regex: q, $options: 'i' } },
          { phone:    { $regex: q, $options: 'i' } },
        ]}
      : {};

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [total, newToday, activeCountResult, filteredTotal, customers] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: todayStart } }),
      Booking.aggregate([{ $group: { _id: '$customer' } }, { $count: 'n' }]),
      q ? User.countDocuments(searchFilter) : Promise.resolve(null as number | null),
      User.aggregate([
        { $match: searchFilter },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: 'bookings',
            localField: '_id',
            foreignField: 'customer',
            as: '_bookings',
            pipeline: [{ $project: { status: 1 } }],
          },
        },
        {
          $addFields: {
            totalBookings: { $size: '$_bookings' },
            completedBookings: {
              $size: { $filter: { input: '$_bookings', as: 'b', cond: { $eq: ['$$b.status', 'completed'] } } },
            },
          },
        },
        { $project: { _bookings: 0, password: 0 } },
      ]),
    ]);

    const resolvedTotal = filteredTotal ?? total;
    res.json({
      customers,
      total,
      newToday,
      activeCount: activeCountResult[0]?.n ?? 0,
      page,
      limit,
      totalFiltered: resolvedTotal,
      totalPages: Math.ceil(resolvedTotal / limit),
    });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Help Tickets ───
export const getHelpTickets = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, status, q } = req.query;
    const baseQuery: Record<string, unknown> = {};
    const query: Record<string, unknown> = {};

    if (type === 'customer') {
      baseQuery.userModel = 'User';
      query.userModel = 'User';
    }
    if (type === 'worker') {
      baseQuery.userModel = 'Worker';
      query.userModel = 'Worker';
    }

    if (typeof status === 'string' && ['open', 'escalated', 'resolved'].includes(status)) {
      baseQuery.status = status;
      query.status = status;
    }

    if (typeof q === 'string' && q.trim()) {
      const pattern = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

      const userModelForLookup =
        type === 'customer' ? 'User' : type === 'worker' ? 'Worker' : null;

      const [matchedCustomers, matchedWorkers] = await Promise.all([
        userModelForLookup && userModelForLookup !== 'User'
          ? Promise.resolve([])
          : User.find({
              $or: [
                { fullName: pattern },
                { phone: pattern },
                { email: pattern },
              ],
            }).select('_id'),
        userModelForLookup && userModelForLookup !== 'Worker'
          ? Promise.resolve([])
          : Worker.find({
              $or: [
                { fullName: pattern },
                { phone: pattern },
                { email: pattern },
              ],
            }).select('_id'),
      ]);

      const matchedUserIds = [
        ...matchedCustomers.map((u) => u._id),
        ...matchedWorkers.map((u) => u._id),
      ];

      query.$or = [
        { ticketNumber: pattern },
        { category: pattern },
        ...(matchedUserIds.length > 0 ? [{ user: { $in: matchedUserIds } }] : []),
      ];
    }

    const tickets = await HelpTicket.find(query)
      .populate('user', 'fullName phone email')
      .sort({ updatedAt: -1 });

    const [
      totalTickets,
      openTickets,
      escalatedTickets,
      resolvedTickets,
      customerTickets,
      workerTickets,
      customerCreators,
      workerCreators,
      ticketsByCategory,
      createdByUser,
    ] = await Promise.all([
      HelpTicket.countDocuments(baseQuery),
      HelpTicket.countDocuments({ ...baseQuery, status: 'open' }),
      HelpTicket.countDocuments({ ...baseQuery, status: 'escalated' }),
      HelpTicket.countDocuments({ ...baseQuery, status: 'resolved' }),
      HelpTicket.countDocuments({ ...baseQuery, userModel: 'User' }),
      HelpTicket.countDocuments({ ...baseQuery, userModel: 'Worker' }),
      HelpTicket.distinct('user', { ...baseQuery, userModel: 'User' }),
      HelpTicket.distinct('user', { ...baseQuery, userModel: 'Worker' }),
      HelpTicket.aggregate([
        { $match: baseQuery },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      HelpTicket.aggregate([
        { $match: baseQuery },
        {
          $group: {
            _id: { user: '$user', userModel: '$userModel' },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const ticketCountByUser = new Map<string, number>();
    createdByUser.forEach((entry) => {
      const key = `${entry._id.userModel}:${entry._id.user.toString()}`;
      ticketCountByUser.set(key, entry.count);
    });

    const ticketsWithMeta = tickets.map((ticket) => {
      const ticketObj = ticket.toObject() as any;
      const key = `${ticketObj.userModel}:${ticketObj.user?._id?.toString?.() || ticketObj.user?.toString?.() || ''}`;
      return {
        ...ticketObj,
        createdByUserCount: ticketCountByUser.get(key) || 1,
      };
    });

    res.json({
      tickets: ticketsWithMeta,
      summary: {
        totalTickets,
        openTickets,
        escalatedTickets,
        resolvedTickets,
        customerTickets,
        workerTickets,
        totalCreators: new Set([...customerCreators.map(String), ...workerCreators.map(String)]).size,
        customerCreators: customerCreators.length,
        workerCreators: workerCreators.length,
        ticketsByCategory,
      },
    });
  } catch (error) {
    console.error('Get help tickets error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const resolveHelpTicket = async (req: Request, res: Response): Promise<void> => {
  try {
    const ticket = await HelpTicket.findByIdAndUpdate(
      req.params.id,
      { status: 'resolved' },
      { new: true }
    );

    if (ticket) {
      const ticketForAdmin = await HelpTicket.findById(ticket._id)
        .populate('user', 'fullName phone email');

      notifyUser(ticket.user.toString(), 'help_ticket_updated', {
        action: 'resolved',
        ticket,
      });

      if (ticketForAdmin) {
        notifyRole('admin', 'help_ticket_updated', {
          action: 'resolved',
          ticket: ticketForAdmin,
        });
      }
    }

    await logAdminActivity(req, { action: 'ticket.resolve', category: 'support', targetType: 'ticket', targetId: String(ticket?._id || ''), meta: { userModel: ticket?.userModel } });
    res.json({ message: 'Ticket resolved', ticket });
  } catch (error) {
    console.error('Resolve help ticket error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Admin Reply to Help Ticket ───
export const replyHelpTicket = async (req: Request, res: Response): Promise<void> => {
  try {
    const { message } = req.body;
    const ticket = await HelpTicket.findById(req.params.id);

    if (!ticket) {
      res.status(404).json({ message: 'Ticket not found' });
      return;
    }

    ticket.chatHistory.push({ sender: 'admin', message, timestamp: new Date() });
    await ticket.save();

    const ticketForAdmin = await HelpTicket.findById(ticket._id)
      .populate('user', 'fullName phone email');

    notifyUser(ticket.user.toString(), 'help_ticket_updated', {
      action: 'reply',
      ticket,
    });

    if (ticketForAdmin) {
      notifyRole('admin', 'help_ticket_updated', {
        action: 'reply',
        ticket: ticketForAdmin,
      });
    }

    // Create notification for the user
    await sendNotification({
      recipientId: ticket.user.toString(),
      recipientModel: ticket.userModel,
      type: 'help_reply',
      title: 'Support Reply',
      message: 'You have a new reply on your support ticket.',
      data: { ticketId: ticket._id },
    });

    res.json({ message: 'Reply sent', ticket: ticketForAdmin || ticket });
  } catch (error) {
    console.error('Reply help ticket error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Get Pending Refunds ───
export const getRefunds = async (_req: Request, res: Response): Promise<void> => {
  try {
    const refunds = await Booking.find({
      status: 'cancelled',
      paymentMethod: 'online',
      paymentStatus: { $in: ['refund_pending', 'refunded'] },
    })
      .populate('customer', 'fullName phone email')
      .populate('category', 'name')
      .populate('assignedWorker', 'fullName phone email profileImage')
      .sort({ updatedAt: -1 });

    // Fetch original payment transactions to check Razorpay payment status
    const bookingIds = refunds.map((r) => r._id);
    const paymentTxns = await Transaction.find({
      booking: { $in: bookingIds },
      type: 'booking_payment',
    }).select('booking status razorpayPaymentId amount');

    const txnMap = new Map<string, typeof paymentTxns[0]>();
    paymentTxns.forEach((t) => {
      if (t.booking) txnMap.set(t.booking.toString(), t);
    });

    const enrichedRefunds = refunds.map((r) => {
      const obj = r.toObject() as any;
      const txn = txnMap.get(r._id.toString());
      obj.paymentTransaction = txn
        ? { status: txn.status, razorpayPaymentId: txn.razorpayPaymentId, amount: txn.amount }
        : null;
      return obj;
    });

    res.json({ refunds: enrichedRefunds });
  } catch (error) {
    console.error('Get refunds error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Process Refund ───
export const processRefund = async (req: Request, res: Response): Promise<void> => {
  try {
    const booking = await Booking.findById(req.params.bookingId);

    if (!booking || booking.paymentStatus !== 'refund_pending') {
      res.status(404).json({ message: 'No pending refund found for this booking' });
      return;
    }

    if (booking.paymentMethod !== 'online') {
      res.status(400).json({ message: 'Refunds are supported only for online payments' });
      return;
    }

    booking.paymentStatus = 'refunded';
    if (booking.refundDetails) {
      booking.refundDetails.status = 'completed';
      booking.refundDetails.processedAt = new Date();
    }
    await booking.save();

    // Create refund transaction
    await Transaction.create({
      tid: (await import('../utils/generateTID')).generateTID(),
      booking: booking._id,
      user: booking.customer,
      type: 'refund',
      amount: booking.amount,
      method: 'online',
      status: 'completed',
    });

    // Notify customer
    await sendNotification({
      recipientId: booking.customer.toString(),
      recipientModel: 'User',
      type: 'refund_completed',
      title: 'Refund Processed',
      message: `Your refund of ₹${booking.amount} has been processed successfully.`,
      data: { bookingId: booking._id },
    });

    clearDashboardCache();
    await logAdminActivity(req, { action: 'refund.process', category: 'refunds', targetType: 'booking', targetId: String(booking._id), amount: booking.amount });
    res.json({ message: 'Refund processed', booking });
  } catch (error) {
    console.error('Process refund error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Reject Refund ───
export const rejectRefund = async (req: Request, res: Response): Promise<void> => {
  try {
    const { reason } = req.body;
    if (!reason) {
      res.status(400).json({ message: 'Rejection reason is required' });
      return;
    }

    const booking = await Booking.findById(req.params.bookingId);

    if (!booking || booking.paymentStatus !== 'refund_pending') {
      res.status(404).json({ message: 'No pending refund found for this booking' });
      return;
    }

    if (booking.paymentMethod !== 'online') {
      res.status(400).json({ message: 'Refunds are supported only for online payments' });
      return;
    }

    // Mark as refund rejected — payment stays as 'paid' (no refund given)
    booking.paymentStatus = 'paid';
    if (booking.refundDetails) {
      booking.refundDetails.status = 'completed';
      booking.refundDetails.processedAt = new Date();
    }
    await booking.save();

    // Notify customer
    await sendNotification({
      recipientId: booking.customer.toString(),
      recipientModel: 'User',
      type: 'refund_rejected',
      title: 'Refund Request Rejected',
      message: `Your refund request has been rejected. Reason: ${reason}`,
      data: { bookingId: booking._id },
    });

    await logAdminActivity(req, { action: 'refund.reject', category: 'refunds', targetType: 'booking', targetId: String(booking._id) });
    res.json({ message: 'Refund rejected', booking });
  } catch (error) {
    console.error('Reject refund error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Admin Notifications ───
export const getAdminNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const notifications = await Notification.find({ recipient: req.user!.id, recipientModel: 'Admin' })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ notifications });
  } catch (error) {
    console.error('Get admin notifications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const markAdminNotificationRead = async (req: Request, res: Response): Promise<void> => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user!.id },
      { isRead: true }
    );
    res.json({ message: 'Marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const markAllAdminNotificationsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    await Notification.updateMany(
      { recipient: req.user!.id, recipientModel: 'Admin', isRead: false },
      { isRead: true }
    );
    res.json({ message: 'All marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteAdminNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user!.id });
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Chatbot QA Management ───
export const getChatbotQA = async (_req: Request, res: Response): Promise<void> => {
  try {
    const qas = await ChatbotQA.find().sort({ category: 1, order: 1 });
    res.json({ qas });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const createChatbotQA = async (req: Request, res: Response): Promise<void> => {
  try {
    const qa = await ChatbotQA.create(req.body);
    res.status(201).json({ message: 'QA created', qa });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateChatbotQA = async (req: Request, res: Response): Promise<void> => {
  try {
    const qa = await ChatbotQA.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ message: 'QA updated', qa });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteChatbotQA = async (req: Request, res: Response): Promise<void> => {
  try {
    await ChatbotQA.findByIdAndDelete(req.params.id);
    res.json({ message: 'QA deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Workers List ───
export const getAllWorkers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, search } = req.query;
    const filter: Record<string, unknown> = {};
    if (status && status !== 'all') filter.accountStatus = status;
    if (search) {
      const s = String(search);
      filter.$or = [
        { fullName: { $regex: s, $options: 'i' } },
        { phone: { $regex: s, $options: 'i' } },
      ];
    }

    const workers = await Worker.find(filter)
      .select('fullName phone profileImage accountStatus isActive categories rating totalWorkDone totalEarnings balance block createdAt')
      .populate('categories', 'name')
      .sort({ createdAt: -1 });

    const [statTotal, statLive, statPending, statRejected] = await Promise.all([
      Worker.countDocuments(),
      Worker.countDocuments({ accountStatus: 'live' }),
      Worker.countDocuments({ accountStatus: { $in: ['test', 'ekyc_pending', 'ekyc_done'] } }),
      Worker.countDocuments({ accountStatus: 'rejected' }),
    ]);
    const stats = { total: statTotal, live: statLive, pending: statPending, rejected: statRejected };

    res.json({ workers, stats });
  } catch (error) {
    console.error('Get all workers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Worker Detail ───
export const getWorkerDetail = async (req: Request, res: Response): Promise<void> => {
  try {
    const worker = await Worker.findById(req.params.id)
      .select('-password')
      .populate('categories', 'name slug image');

    if (!worker) {
      res.status(404).json({ message: 'Worker not found' });
      return;
    }

    // Get bookings for this worker
    const bookings = await Booking.find({ assignedWorker: worker._id })
      .populate('customer', 'fullName phone')
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .limit(50);

    const bookingStatsFacet = await Booking.aggregate([
      { $match: { assignedWorker: worker._id } },
      { $facet: {
        total:      [{ $count: 'n' }],
        completed:  [{ $match: { status: 'completed' } },  { $count: 'n' }],
        cancelled:  [{ $match: { status: 'cancelled' } },  { $count: 'n' }],
        inProgress: [{ $match: { status: 'in_progress' } }, { $count: 'n' }],
      }},
    ]);
    const bookingStats = {
      total:      bookingStatsFacet[0]?.total[0]?.n      ?? 0,
      completed:  bookingStatsFacet[0]?.completed[0]?.n  ?? 0,
      cancelled:  bookingStatsFacet[0]?.cancelled[0]?.n  ?? 0,
      inProgress: bookingStatsFacet[0]?.inProgress[0]?.n ?? 0,
    };

    // Get reviews from completed bookings
    const reviewBookings = await Booking.find({
      assignedWorker: worker._id,
      'review.rating': { $exists: true },
    })
      .select('review customer category amount createdAt')
      .populate('customer', 'fullName phone')
      .populate('category', 'name')
      .sort({ 'review.createdAt': -1 })
      .limit(20);

    // Transaction history
    const transactions = await Transaction.find({ worker: worker._id })
      .sort({ createdAt: -1 })
      .limit(30);

    // Withdrawal history
    const withdrawals = await Withdrawal.find({ worker: worker._id })
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({ worker, bookings, bookingStats, reviewBookings, transactions, withdrawals });
  } catch (error) {
    console.error('Get worker detail error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ───────────────────────────────────────────────────────────────
// Cancellation moderation: temporary block / unblock + flag watch
// ───────────────────────────────────────────────────────────────

const applyBlock = (doc: { block?: any }, hours: number, reason: string, adminId: string) => {
  if (!doc.block) doc.block = {};
  doc.block.isBlocked = true;
  doc.block.reason = reason || 'Temporarily restricted for excessive cancellations.';
  doc.block.blockedAt = new Date();
  doc.block.blockedUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
  doc.block.blockedBy = adminId;
  doc.block.blockCount = (doc.block.blockCount || 0) + 1;
};

const clearBlock = (doc: { block?: any }) => {
  if (!doc.block) doc.block = {};
  doc.block.isBlocked = false;
  doc.block.reason = '';
  doc.block.blockedAt = null;
  doc.block.blockedUntil = null;
  doc.block.blockedBy = null;
};

export const blockCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const hours = Number(req.body?.hours);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (!hours || hours <= 0 || hours > 720) { res.status(400).json({ message: 'Provide valid block hours (1-720)' }); return; }
    const user = await User.findById(req.params.id);
    if (!user) { res.status(404).json({ message: 'Customer not found' }); return; }
    applyBlock(user, hours, reason, req.user!.id);
    await user.save();
    notifyUser(user._id.toString(), 'account_blocked', { block: blockPayload(user.block) });
    await logAdminActivity(req, { action: 'customer.block', category: 'moderation', targetType: 'customer', targetId: String(user._id), meta: { hours, reason } });
    res.json({ message: `Customer blocked for ${hours} hours`, block: blockPayload(user.block) });
  } catch (error) {
    console.error('Block customer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const unblockCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) { res.status(404).json({ message: 'Customer not found' }); return; }
    clearBlock(user);
    await user.save();
    notifyUser(user._id.toString(), 'account_unblocked', {});
    await logAdminActivity(req, { action: 'customer.unblock', category: 'moderation', targetType: 'customer', targetId: String(user._id) });
    res.json({ message: 'Customer unblocked' });
  } catch (error) {
    console.error('Unblock customer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const blockWorkerAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const hours = Number(req.body?.hours);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (!hours || hours <= 0 || hours > 720) { res.status(400).json({ message: 'Provide valid block hours (1-720)' }); return; }
    const worker = await Worker.findById(req.params.id);
    if (!worker) { res.status(404).json({ message: 'Worker not found' }); return; }
    applyBlock(worker, hours, reason, req.user!.id);
    await worker.save();
    notifyUser(worker._id.toString(), 'account_blocked', { block: blockPayload(worker.block) });
    await logAdminActivity(req, { action: 'worker.block', category: 'moderation', targetType: 'worker', targetId: String(worker._id), meta: { hours, reason } });
    res.json({ message: `Worker blocked for ${hours} hours`, block: blockPayload(worker.block) });
  } catch (error) {
    console.error('Block worker error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const unblockWorkerAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const worker = await Worker.findById(req.params.id);
    if (!worker) { res.status(404).json({ message: 'Worker not found' }); return; }
    clearBlock(worker);
    await worker.save();
    notifyUser(worker._id.toString(), 'account_unblocked', {});
    await logAdminActivity(req, { action: 'worker.unblock', category: 'moderation', targetType: 'worker', targetId: String(worker._id) });
    res.json({ message: 'Worker unblocked' });
  } catch (error) {
    console.error('Unblock worker error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Customers / workers with many recent cancellations (default: >= 3 in 24h).
export const getCancellationFlags = async (req: Request, res: Response): Promise<void> => {
  try {
    const hours = Math.min(168, Math.max(1, Number(req.query.hours) || 24));
    const min = Math.max(2, Number(req.query.min) || 3);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const [custAgg, workAgg] = await Promise.all([
      Booking.aggregate([
        { $match: { 'cancellation.cancelledBy': 'customer', 'cancellation.cancelledAt': { $gte: since } } },
        { $group: { _id: '$customer', count: { $sum: 1 }, lastAt: { $max: '$cancellation.cancelledAt' } } },
        { $match: { count: { $gte: min } } },
        { $sort: { count: -1 } },
      ]),
      Booking.aggregate([
        { $match: { 'cancellation.cancelledBy': 'worker', 'cancellation.cancelledAt': { $gte: since } } },
        { $group: { _id: '$assignedWorker', count: { $sum: 1 }, lastAt: { $max: '$cancellation.cancelledAt' } } },
        { $match: { count: { $gte: min } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    const custIds = custAgg.map((c) => c._id).filter(Boolean);
    const workIds = workAgg.map((w) => w._id).filter(Boolean);
    const [users, workers] = await Promise.all([
      User.find({ _id: { $in: custIds } }).select('fullName phone email profileImage block'),
      Worker.find({ _id: { $in: workIds } }).select('fullName phone email profileImage block'),
    ]);
    const uMap = new Map(users.map((u) => [String(u._id), u]));
    const wMap = new Map(workers.map((w) => [String(w._id), w]));

    const customers = custAgg
      .map((c) => {
        const u = uMap.get(String(c._id));
        return u ? { _id: u._id, fullName: u.fullName, phone: u.phone, email: u.email, profileImage: u.profileImage, cancelCount: c.count, lastAt: c.lastAt, block: blockPayload(u.block) } : null;
      })
      .filter(Boolean);
    const flaggedWorkers = workAgg
      .map((w) => {
        const d = wMap.get(String(w._id));
        return d ? { _id: d._id, fullName: d.fullName, phone: d.phone, email: d.email, profileImage: d.profileImage, cancelCount: w.count, lastAt: w.lastAt, block: blockPayload(d.block) } : null;
      })
      .filter(Boolean);

    res.json({ window: { hours, min }, customers, workers: flaggedWorkers });
  } catch (error) {
    console.error('Get cancellation flags error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ───────────────────────────────────────────────────────────────
// Admin push / broadcast notifications (Swiggy/Zomato style)
// ───────────────────────────────────────────────────────────────

const resolveAudience = (raw: string) =>
  raw === 'worker'
    ? { Model: Worker, recipientModel: 'Worker' as const, role: 'worker' as const }
    : { Model: User, recipientModel: 'User' as const, role: 'customer' as const };

// Best-effort push fan-out to everyone who has a registered device/browser.
const broadcastPushToTokenHolders = async (
  recipientModel: 'User' | 'Worker',
  title: string,
  message: string,
  data: Record<string, unknown>,
) => {
  try {
    const [mobileIds, webIds] = await Promise.all([
      MobilePushToken.find({ recipientModel, isActive: true }).distinct('recipient'),
      PushSubscription.find({ recipientModel }).distinct('recipient'),
    ]);
    const unique = new Set<string>([...mobileIds.map(String), ...webIds.map(String)]);
    const now = new Date();
    for (const recipientId of unique) {
      const payload = { recipientId, recipientModel, notificationId: 'broadcast', type: 'admin_broadcast', title, message, data, createdAt: now };
      await Promise.allSettled([sendMobilePushNotification(payload), sendWebPushNotification(payload)]);
    }
  } catch (error) {
    console.error('Broadcast push fan-out error:', error);
  }
};

// Core broadcast: in-app (bulk) + live socket + background push fan-out.
// Returns how many recipients received the in-app notification.
export const broadcastToAudience = async (
  audience: 'customer' | 'worker',
  title: string,
  message: string,
  data: Record<string, unknown> = {},
  type = 'admin_broadcast',
): Promise<number> => {
  const { Model, recipientModel, role } = resolveAudience(audience);
  const filter = recipientModel === 'User' ? { isActive: { $ne: false } } : {};
  const recipients = await (Model as typeof User).find(filter).select('_id').lean();

  if (recipients.length) {
    const docs = recipients.map((r) => ({ recipient: r._id, recipientModel, type, title, message, data }));
    await Notification.insertMany(docs, { ordered: false }).catch(() => {});
  }
  notifyRole(role, 'notification_event', { type, title, message, isRead: false, createdAt: new Date(), data });
  void broadcastPushToTokenHolders(recipientModel, title, message, data);
  return recipients.length;
};

// POST /admin/push/:audience/broadcast  — send to ALL customers or ALL workers
export const broadcastNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const audience = String(req.params.audience) === 'worker' ? 'worker' : 'customer';
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!title || !message) { res.status(400).json({ message: 'Title and message are required' }); return; }
    if (title.length > 120 || message.length > 500) { res.status(400).json({ message: 'Title/message too long' }); return; }

    const count = await broadcastToAudience(audience, title, message, { broadcast: true });
    await logAdminActivity(req, { action: `notify.broadcast.${audience}`, category: 'notifications', meta: { count, title } });
    res.json({ message: `Notification sent to ${count} ${audience}s`, count });
  } catch (error) {
    console.error('Broadcast notification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /admin/push/:audience/personal  — send to one selected user
export const personalNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { Model, recipientModel, role } = resolveAudience(String(req.params.audience));
    const recipientId = typeof req.body?.recipientId === 'string' ? req.body.recipientId : '';
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!recipientId || !title || !message) { res.status(400).json({ message: 'Recipient, title and message are required' }); return; }

    const exists = await (Model as typeof User).exists({ _id: recipientId });
    if (!exists) { res.status(404).json({ message: `${role} not found` }); return; }

    // sendNotification already does in-app + socket + web/mobile push.
    await sendNotification({ recipientId, recipientModel, type: 'admin_personal', title, message, data: { personal: true } });

    await logAdminActivity(req, { action: `notify.personal.${role}`, category: 'notifications', targetType: role, targetId: recipientId, meta: { title } });
    res.json({ message: 'Notification sent' });
  } catch (error) {
    console.error('Personal notification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /admin/waitlist — locations customers requested where Fixo isn't available yet
export const getWaitlist = async (req: Request, res: Response): Promise<void> => {
  try {
    const status = req.query.status === 'reached' ? 'reached' : 'pending';
    const [waitlist, pendingCount, reachedCount] = await Promise.all([
      Waitlist.find({ status }).populate('user', 'fullName phone email').sort({ createdAt: -1 }).limit(300).lean(),
      Waitlist.countDocuments({ status: 'pending' }),
      Waitlist.countDocuments({ status: 'reached' }),
    ]);
    res.json({ waitlist, stats: { pending: pendingCount, reached: reachedCount } });
  } catch (error) {
    console.error('Get waitlist error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const markWaitlistReached = async (req: Request, res: Response): Promise<void> => {
  try {
    const entry = await Waitlist.findByIdAndUpdate(req.params.id, { status: 'reached' }, { new: true });
    if (!entry) { res.status(404).json({ message: 'Entry not found' }); return; }
    notifyUser(entry.user.toString(), 'notification_event', {
      type: 'service_added',
      title: 'Great news! 🎉',
      message: 'Fixo is now available in your requested area. You can book a service now!',
      isRead: false, createdAt: new Date(), data: {},
    });
    await sendNotification({
      recipientId: entry.user.toString(), recipientModel: 'User', type: 'service_added',
      title: 'Great news! 🎉', message: 'Fixo is now available in your requested area. You can book a service now!',
    });
    await logAdminActivity(req, { action: 'waitlist.reached', category: 'general', targetType: 'waitlist', targetId: String(entry._id) });
    res.json({ message: 'Marked as reached & customer notified' });
  } catch (error) {
    console.error('Mark waitlist reached error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /admin/push/:audience/recipients?q=  — search users for the personal picker
export const searchNotificationRecipients = async (req: Request, res: Response): Promise<void> => {
  try {
    const { Model } = resolveAudience(String(req.params.audience));
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const filter = q
      ? { $or: [
          { fullName: { $regex: q, $options: 'i' } },
          { phone: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } },
        ] }
      : {};
    const recipients = await (Model as typeof User).find(filter)
      .select('fullName phone email profileImage')
      .sort({ createdAt: -1 })
      .limit(20);
    res.json({ recipients });
  } catch (error) {
    console.error('Search recipients error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
