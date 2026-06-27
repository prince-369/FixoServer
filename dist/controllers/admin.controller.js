"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.markWaitlistReached = exports.getWaitlist = exports.personalNotification = exports.broadcastNotification = exports.broadcastToAudience = exports.getCancellationFlags = exports.unblockWorkerAccount = exports.blockWorkerAccount = exports.unblockCustomer = exports.blockCustomer = exports.getWorkerDetail = exports.getAllWorkers = exports.deleteChatbotQA = exports.updateChatbotQA = exports.createChatbotQA = exports.getChatbotQA = exports.deleteAdminNotification = exports.markAllAdminNotificationsRead = exports.markAdminNotificationRead = exports.getAdminNotifications = exports.rejectRefund = exports.processRefund = exports.getRefunds = exports.replyHelpTicket = exports.resolveHelpTicket = exports.getHelpTickets = exports.getCustomers = exports.reorderBanners = exports.updateBanner = exports.deleteBanner = exports.createBanner = exports.getBanners = exports.deleteCategory = exports.updateCategoryDetails = exports.updateCategory = exports.createCategory = exports.getCategories = exports.declineWithdrawal = exports.completeWithdrawal = exports.getWithdrawals = exports.saveEkycCapture = exports.rejectWorker = exports.approveWorker = exports.updateVideoKycResult = exports.getWorkerEKYCDetails = exports.getPendingEKYC = exports.getAdminBootstrapStatus = exports.getPendingAdminBadges = exports.getDashboard = exports.clearDashboardCache = void 0;
exports.logSkillCallAttempt = exports.reviewSkill = exports.getSkillRequests = exports.searchNotificationRecipients = void 0;
const Worker_1 = __importDefault(require("../models/Worker"));
const User_1 = __importDefault(require("../models/User"));
const Booking_1 = __importDefault(require("../models/Booking"));
const Transaction_1 = __importDefault(require("../models/Transaction"));
const Withdrawal_1 = __importDefault(require("../models/Withdrawal"));
const Category_1 = __importDefault(require("../models/Category"));
const Banner_1 = __importDefault(require("../models/Banner"));
const HelpTicket_1 = __importDefault(require("../models/HelpTicket"));
const RewardClaim_1 = __importDefault(require("../models/RewardClaim"));
const ChatbotQA_1 = __importDefault(require("../models/ChatbotQA"));
const socket_1 = require("../socket");
const adminActivity_1 = require("../utils/adminActivity");
const userBlock_1 = require("../utils/userBlock");
const MobilePushToken_1 = __importDefault(require("../models/MobilePushToken"));
const PushSubscription_1 = __importDefault(require("../models/PushSubscription"));
const Waitlist_1 = __importDefault(require("../models/Waitlist"));
const workerSkills_1 = require("../utils/workerSkills");
const mobilePush_service_1 = require("../services/mobilePush.service");
const webPush_service_1 = require("../services/webPush.service");
const Notification_1 = __importDefault(require("../models/Notification"));
const cloudinary_service_1 = require("../services/cloudinary.service");
const adminBootstrap_service_1 = require("../services/adminBootstrap.service");
const VIDEO_KYC_RETRY_COOLDOWN_MS = 3 * 60 * 1000;
// ─── Dashboard Cache (2-minute TTL) ───
let _dashboardCache = null;
const DASHBOARD_CACHE_TTL_MS = 2 * 60 * 1000;
const clearDashboardCache = () => { _dashboardCache = null; };
exports.clearDashboardCache = clearDashboardCache;
// ─── Dashboard Stats ───
const getDashboard = async (_req, res) => {
    if (_dashboardCache && Date.now() - _dashboardCache.cachedAt < DASHBOARD_CACHE_TTL_MS) {
        res.json(_dashboardCache.data);
        return;
    }
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [totalWorkers, activeWorkers, pendingEKYC, pendingWithdrawals, totalCustomers, pendingHelpTickets, todayWorkDone, totalBookings, totalCompleted, totalCancelled, totalInProgress,] = await Promise.all([
            Worker_1.default.countDocuments(),
            Worker_1.default.countDocuments({ isActive: true, accountStatus: 'live' }),
            Worker_1.default.countDocuments({ accountStatus: { $in: ['test', 'ekyc_pending', 'ekyc_done'] } }),
            Withdrawal_1.default.countDocuments({ status: 'pending' }),
            User_1.default.countDocuments(),
            HelpTicket_1.default.countDocuments({ status: { $in: ['open', 'escalated'] } }),
            Booking_1.default.countDocuments({ status: 'completed', updatedAt: { $gte: today } }),
            Booking_1.default.countDocuments(),
            Booking_1.default.countDocuments({ status: 'completed' }),
            Booking_1.default.countDocuments({ status: 'cancelled' }),
            Booking_1.default.countDocuments({ status: 'in_progress' }),
        ]);
        // --- Chart Data: Last 7 days bookings (daily) ---
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);
        const dailyBookings = await Booking_1.default.aggregate([
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
        const bookingsChart = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const dayLabel = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
            let completed = 0, cancelled = 0, other = 0;
            for (const b of dailyBookings) {
                if (b._id.date === dateStr) {
                    if (b._id.status === 'completed')
                        completed = b.count;
                    else if (b._id.status === 'cancelled')
                        cancelled = b.count;
                    else
                        other += b.count;
                }
            }
            bookingsChart.push({ date: dayLabel, completed, cancelled, other, total: completed + cancelled + other });
        }
        // --- Donut: Booking status distribution ---
        const bookingStatusAgg = await Booking_1.default.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } },
        ]);
        const statusLabels = {
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
        const payMethodAgg = await Booking_1.default.aggregate([
            { $match: { status: 'completed', paymentMethod: { $in: ['online', 'cash'] } } },
            { $group: { _id: '$paymentMethod', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } },
        ]);
        const paymentMethodDonut = payMethodAgg.map((p) => ({
            name: p._id === 'online' ? 'Online' : 'Cash',
            count: p.count,
            value: p.totalAmount,
        }));
        // --- Donut: Worker status ---
        const workerStatusAgg = await Worker_1.default.aggregate([
            { $group: { _id: '$accountStatus', count: { $sum: 1 } } },
        ]);
        const workerStatusLabels = {
            test: 'Test', ekyc_pending: 'eKYC Pending', ekyc_done: 'eKYC Done',
            approved: 'Approved', live: 'Live', rejected: 'Rejected', suspended: 'Suspended',
        };
        const workerStatusDonut = workerStatusAgg.map((w) => ({
            name: workerStatusLabels[w._id] || w._id,
            value: w.count,
        }));
        // --- Top categories by completed bookings ---
        const topCategories = await Booking_1.default.aggregate([
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
    }
    catch (error) {
        console.error('Admin dashboard error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getDashboard = getDashboard;
// ─── Lightweight Pending Badge Counts ───
const getPendingAdminBadges = async (_req, res) => {
    try {
        const [pendingEKYC, pendingWithdrawals, pendingRefunds, pendingSupport, pendingRewardClaims] = await Promise.all([
            Worker_1.default.countDocuments({ accountStatus: { $in: ['test', 'ekyc_pending', 'ekyc_done'] } }),
            Withdrawal_1.default.countDocuments({ status: 'pending' }),
            Booking_1.default.countDocuments({ paymentStatus: 'refund_pending' }),
            HelpTicket_1.default.countDocuments({ status: { $in: ['open', 'escalated'] } }),
            RewardClaim_1.default.countDocuments({ status: 'pending_approval' }),
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
    }
    catch (error) {
        console.error('Pending admin badges error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getPendingAdminBadges = getPendingAdminBadges;
// ─── Admin Bootstrap Sync Status (Admin-only) ───
const getAdminBootstrapStatus = async (_req, res) => {
    try {
        const status = await (0, adminBootstrap_service_1.getSeedAdminBootstrapStatus)();
        res.json(status);
    }
    catch (error) {
        console.error('Admin bootstrap status error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getAdminBootstrapStatus = getAdminBootstrapStatus;
// ─── EKYC: Get Pending Workers ───
const getPendingEKYC = async (_req, res) => {
    try {
        const [workers, approvedCount, rejectedCount] = await Promise.all([
            Worker_1.default.find({ accountStatus: { $in: ['test', 'ekyc_pending', 'ekyc_done'] } }).sort({ createdAt: -1 }).populate('skills.category', 'name image'),
            Worker_1.default.countDocuments({ accountStatus: { $in: ['approved', 'live'] } }),
            Worker_1.default.countDocuments({ accountStatus: 'rejected' }),
        ]);
        res.json({ workers, approvedCount, rejectedCount });
    }
    catch (error) {
        console.error('Get pending EKYC error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getPendingEKYC = getPendingEKYC;
// ─── EKYC: Get Worker Details ───
const getWorkerEKYCDetails = async (req, res) => {
    try {
        const worker = await Worker_1.default.findById(req.params.workerId).populate('skills.category', 'name image');
        if (!worker) {
            res.status(404).json({ message: 'Worker not found' });
            return;
        }
        res.json({ worker });
    }
    catch (error) {
        console.error('Get worker EKYC details error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getWorkerEKYCDetails = getWorkerEKYCDetails;
// ─── EKYC: Save Post-Call Video KYC Result ───
const updateVideoKycResult = async (req, res) => {
    try {
        const { result, reason } = req.body;
        if (result !== 'completed' && result !== 'incomplete') {
            res.status(400).json({ message: 'Result must be either completed or incomplete' });
            return;
        }
        const worker = await Worker_1.default.findById(req.params.workerId);
        if (!worker) {
            res.status(404).json({ message: 'Worker not found' });
            return;
        }
        if (result === 'completed') {
            worker.accountStatus = 'ekyc_done';
            worker.ekycRejectionReason = undefined;
            worker.videoKycIncompleteReason = '';
            worker.videoKycRetryAvailableAt = null;
            worker.videoKycAwaitingResult = false;
            worker.videoKycCallEndedAt = null;
            await worker.save();
            (0, socket_1.notifyUser)(worker._id.toString(), 'kyc_status_updated', {
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
        worker.videoKycAwaitingResult = false;
        worker.videoKycCallEndedAt = null;
        await worker.save();
        (0, socket_1.notifyUser)(worker._id.toString(), 'kyc_status_updated', {
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
    }
    catch (error) {
        console.error('Update video KYC result error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.updateVideoKycResult = updateVideoKycResult;
// ─── EKYC: Approve Worker ───
const approveWorker = async (req, res) => {
    try {
        const worker = await Worker_1.default.findById(req.params.workerId);
        if (!worker) {
            res.status(404).json({ message: 'Worker not found' });
            return;
        }
        worker.accountStatus = 'approved';
        worker.isActive = true;
        worker.ekycRejectionReason = undefined;
        worker.videoKycIncompleteReason = '';
        worker.videoKycRetryAvailableAt = null;
        worker.videoKycAwaitingResult = false;
        worker.videoKycCallEndedAt = null;
        // Approve the skills the worker confirmed at signup; auto-reject the rest.
        (worker.skills || []).forEach((s) => {
            if (s.status === 'pending_kyc') {
                s.status = s.confirmed ? 'approved' : 'rejected';
                s.decidedAt = new Date();
                if (!s.confirmed)
                    s.rejectionReason = 'Worker did not confirm this skill at signup';
            }
        });
        (0, workerSkills_1.syncCategoriesFromSkills)(worker);
        await worker.save();
        // Notify worker in real-time so their page updates instantly
        (0, socket_1.notifyUser)(worker._id.toString(), 'kyc_status_updated', {
            workerId: worker._id,
            status: 'approved',
            worker,
        });
        (0, exports.clearDashboardCache)();
        await (0, adminActivity_1.logAdminActivity)(req, { action: 'kyc.approve', category: 'kyc', targetType: 'worker', targetId: String(worker._id) });
        res.json({ message: 'Worker approved', worker });
    }
    catch (error) {
        console.error('Approve worker error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.approveWorker = approveWorker;
// ─── EKYC: Reject Worker ───
const rejectWorker = async (req, res) => {
    try {
        const { reason } = req.body;
        const worker = await Worker_1.default.findByIdAndUpdate(req.params.workerId, {
            accountStatus: 'rejected',
            ekycRejectionReason: reason,
            videoKycIncompleteReason: '',
            videoKycRetryAvailableAt: null,
            videoKycAwaitingResult: false,
            videoKycCallEndedAt: null,
        }, { new: true });
        if (!worker) {
            res.status(404).json({ message: 'Worker not found' });
            return;
        }
        // Notify worker in real-time so their page updates instantly
        (0, socket_1.notifyUser)(worker._id.toString(), 'kyc_status_updated', {
            workerId: worker._id,
            status: 'rejected',
            reason,
        });
        (0, exports.clearDashboardCache)();
        await (0, adminActivity_1.logAdminActivity)(req, { action: 'kyc.reject', category: 'kyc', targetType: 'worker', targetId: String(worker._id) });
        res.json({ message: 'Worker rejected', worker });
    }
    catch (error) {
        console.error('Reject worker error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.rejectWorker = rejectWorker;
// ─── EKYC: Save Capture from Video KYC ───
const saveEkycCapture = async (req, res) => {
    try {
        const { workerId } = req.params;
        const { imageData } = req.body; // base64 data URL
        if (!imageData || typeof imageData !== 'string') {
            res.status(400).json({ message: 'Image data is required' });
            return;
        }
        const worker = await Worker_1.default.findById(workerId);
        if (!worker) {
            res.status(404).json({ message: 'Worker not found' });
            return;
        }
        // Convert base64 to buffer and upload to Cloudinary
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const { url } = await (0, cloudinary_service_1.uploadBufferToCloudinary)(buffer, 'ekyc-captures');
        worker.ekycCaptures.push({ url, capturedAt: new Date() });
        await worker.save();
        res.json({ message: 'Capture saved', url });
    }
    catch (error) {
        console.error('Save eKYC capture error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.saveEkycCapture = saveEkycCapture;
// ─── Withdrawals Management ───
const getWithdrawals = async (_req, res) => {
    try {
        const withdrawals = await Withdrawal_1.default.find()
            .populate('worker', 'fullName phone profileImage')
            .sort({ requestedAt: -1 });
        res.json({ withdrawals });
    }
    catch (error) {
        console.error('Get withdrawals error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getWithdrawals = getWithdrawals;
const completeWithdrawal = async (req, res) => {
    try {
        const withdrawal = await Withdrawal_1.default.findByIdAndUpdate(req.params.id, { status: 'completed', processedAt: new Date() }, { new: true });
        if (!withdrawal) {
            res.status(404).json({ message: 'Withdrawal not found' });
            return;
        }
        // Create transaction
        await Transaction_1.default.create({
            tid: (await Promise.resolve().then(() => __importStar(require('../utils/generateTID')))).generateTID(),
            worker: withdrawal.worker,
            type: 'withdrawal',
            amount: withdrawal.amount,
            method: 'online',
            status: 'completed',
        });
        (0, socket_1.notifyUser)(withdrawal.worker.toString(), 'withdrawal_update', {
            withdrawalId: withdrawal._id,
            status: 'completed',
            withdrawal,
        });
        (0, socket_1.notifyRole)('admin', 'withdrawal_update', {
            withdrawalId: withdrawal._id,
            status: 'completed',
            withdrawal,
        });
        (0, exports.clearDashboardCache)();
        await (0, adminActivity_1.logAdminActivity)(req, { action: 'withdrawal.complete', category: 'withdrawals', targetType: 'withdrawal', targetId: String(withdrawal._id), amount: withdrawal.amount });
        res.json({ message: 'Withdrawal completed', withdrawal });
    }
    catch (error) {
        console.error('Complete withdrawal error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.completeWithdrawal = completeWithdrawal;
const declineWithdrawal = async (req, res) => {
    try {
        const { reason } = req.body;
        const withdrawal = await Withdrawal_1.default.findById(req.params.id);
        if (!withdrawal || withdrawal.status !== 'pending') {
            res.status(404).json({ message: 'Pending withdrawal not found' });
            return;
        }
        withdrawal.status = 'declined';
        withdrawal.declineReason = reason;
        withdrawal.processedAt = new Date();
        await withdrawal.save();
        // Refund amount back to worker
        await Worker_1.default.findByIdAndUpdate(withdrawal.worker, {
            $inc: { balance: withdrawal.amount },
        });
        (0, socket_1.notifyUser)(withdrawal.worker.toString(), 'withdrawal_update', {
            withdrawalId: withdrawal._id,
            status: 'declined',
            reason,
            withdrawal,
        });
        (0, socket_1.notifyRole)('admin', 'withdrawal_update', {
            withdrawalId: withdrawal._id,
            status: 'declined',
            reason,
            withdrawal,
        });
        await (0, adminActivity_1.logAdminActivity)(req, { action: 'withdrawal.decline', category: 'withdrawals', targetType: 'withdrawal', targetId: String(withdrawal._id), amount: withdrawal.amount });
        res.json({ message: 'Withdrawal declined, amount refunded to worker', withdrawal });
    }
    catch (error) {
        console.error('Decline withdrawal error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.declineWithdrawal = declineWithdrawal;
// ─── Category Management ───
const getCategories = async (_req, res) => {
    try {
        const categories = await Category_1.default.find().sort({ order: 1 });
        res.json({ categories });
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getCategories = getCategories;
const createCategory = async (req, res) => {
    try {
        const { name, description, order } = req.body;
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        let image = '';
        if (req.file) {
            const uploaded = await (0, cloudinary_service_1.uploadBufferToCloudinary)(req.file.buffer, 'categories');
            image = uploaded.url;
        }
        const category = await Category_1.default.create({ name, slug, image, description, order: order || 0 });
        (0, socket_1.notifyRole)('customer', 'service_updated', { action: 'created', category });
        (0, socket_1.notifyRole)('worker', 'service_updated', { action: 'created', category });
        (0, socket_1.notifyRole)('admin', 'service_updated', { action: 'created', category });
        // Auto-announce the new service to every customer and worker
        // (in-app notification + live banner + push).
        const data = { categoryId: String(category._id) };
        void (0, exports.broadcastToAudience)('customer', 'New Service Available! 🎉', `You can now get "${category.name}" done on Fixo. Book this service now!`, data, 'service_added').catch(() => { });
        void (0, exports.broadcastToAudience)('worker', 'New Service Added! 🛠️', `You can now take "${category.name}" jobs. Update your skills in Settings if you offer this service.`, data, 'service_added').catch(() => { });
        res.status(201).json({ message: 'Category created', category });
    }
    catch (error) {
        console.error('Create category error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.createCategory = createCategory;
const updateCategory = async (req, res) => {
    try {
        const { name, description, isActive, order } = req.body;
        const updateData = {};
        if (name) {
            updateData.name = name;
            updateData.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        }
        if (description !== undefined)
            updateData.description = description;
        if (isActive !== undefined)
            updateData.isActive = isActive;
        if (order !== undefined)
            updateData.order = order;
        if (req.file) {
            const uploaded = await (0, cloudinary_service_1.uploadBufferToCloudinary)(req.file.buffer, 'categories');
            updateData.image = uploaded.url;
        }
        const category = await Category_1.default.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (category) {
            (0, socket_1.notifyRole)('customer', 'service_updated', { action: 'updated', category });
            (0, socket_1.notifyRole)('worker', 'service_updated', { action: 'updated', category });
            (0, socket_1.notifyRole)('admin', 'service_updated', { action: 'updated', category });
        }
        res.json({ message: 'Category updated', category });
    }
    catch (error) {
        console.error('Update category error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.updateCategory = updateCategory;
const updateCategoryDetails = async (req, res) => {
    try {
        const { tagline, services, highlights, faqs, priceStartsFrom } = req.body;
        const updateData = {};
        if (tagline !== undefined)
            updateData.tagline = tagline;
        if (services !== undefined)
            updateData.services = services;
        if (highlights !== undefined)
            updateData.highlights = highlights;
        if (faqs !== undefined)
            updateData.faqs = faqs;
        if (priceStartsFrom !== undefined)
            updateData.priceStartsFrom = priceStartsFrom;
        const category = await Category_1.default.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!category) {
            res.status(404).json({ message: 'Category not found' });
            return;
        }
        (0, socket_1.notifyRole)('customer', 'service_updated', { action: 'updated', category });
        (0, socket_1.notifyRole)('worker', 'service_updated', { action: 'updated', category });
        (0, socket_1.notifyRole)('admin', 'service_updated', { action: 'updated', category });
        res.json({ message: 'Category details updated', category });
    }
    catch (error) {
        console.error('Update category details error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.updateCategoryDetails = updateCategoryDetails;
const deleteCategory = async (req, res) => {
    try {
        const category = await Category_1.default.findByIdAndDelete(req.params.id);
        (0, socket_1.notifyRole)('customer', 'service_updated', { action: 'deleted', categoryId: req.params.id, category });
        (0, socket_1.notifyRole)('worker', 'service_updated', { action: 'deleted', categoryId: req.params.id, category });
        (0, socket_1.notifyRole)('admin', 'service_updated', { action: 'deleted', categoryId: req.params.id, category });
        res.json({ message: 'Category deleted' });
    }
    catch (error) {
        console.error('Delete category error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.deleteCategory = deleteCategory;
// ─── Banner Management ───
const DEFAULT_BANNER_EDITOR = {
    crop: { x: 0, y: 0 },
    zoom: 1,
    fitMode: 'cover',
    safeArea: true,
    focusX: 50,
    focusY: 50,
    brightness: 100,
    contrast: 100,
    blur: 0,
};
const parseJSONField = (value, fallback) => {
    if (typeof value !== 'string' || !value.trim())
        return fallback;
    try {
        return { ...fallback, ...JSON.parse(value) };
    }
    catch {
        return fallback;
    }
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const toNumber = (value, fallback) => {
    if (typeof value === 'number' && Number.isFinite(value))
        return value;
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }
    return fallback;
};
const parseBoolean = (value, fallback = false) => {
    if (typeof value === 'boolean')
        return value;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true')
            return true;
        if (normalized === 'false')
            return false;
    }
    return fallback;
};
const isValidHttpUrl = (value) => {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    }
    catch {
        return false;
    }
};
const parseEditorConfig = (input) => {
    const editorInput = parseJSONField(input, DEFAULT_BANNER_EDITOR);
    const editorLike = editorInput;
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
const parseCTAConfig = (input) => {
    const raw = parseJSONField(input, { enabled: false, text: '', url: '' });
    return {
        enabled: parseBoolean(raw.enabled, false),
        text: typeof raw.text === 'string' ? raw.text.trim() : '',
        url: typeof raw.url === 'string' ? raw.url.trim() : '',
    };
};
const parseScheduleConfig = (input) => {
    const raw = parseJSONField(input, { startAt: null, endAt: null });
    const startAt = raw.startAt ? new Date(raw.startAt) : null;
    const endAt = raw.endAt ? new Date(raw.endAt) : null;
    return {
        startAt: startAt && !Number.isNaN(startAt.getTime()) ? startAt : null,
        endAt: endAt && !Number.isNaN(endAt.getTime()) ? endAt : null,
    };
};
const isScheduleValid = (startAt, endAt) => {
    if (!startAt || !endAt)
        return true;
    return startAt.getTime() <= endAt.getTime();
};
const getBanners = async (_req, res) => {
    try {
        const banners = await Banner_1.default.find().sort({ order: 1 });
        res.json({ banners });
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getBanners = getBanners;
const createBanner = async (req, res) => {
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
        const uploaded = await (0, cloudinary_service_1.uploadBufferToCloudinary)(req.file.buffer, 'banners');
        const numericOrder = Number.isFinite(Number(order)) ? Number(order) : 0;
        const banner = await Banner_1.default.create({
            image: uploaded.url,
            imagePublicId: uploaded.publicId,
            linkUrl: safeLink,
            targetPage,
            order: numericOrder,
            editor,
            cta,
            schedule,
        });
        (0, socket_1.notifyRole)('customer', 'banner_updated', { action: 'created', banner });
        (0, socket_1.notifyRole)('worker', 'banner_updated', { action: 'created', banner });
        (0, socket_1.notifyRole)('admin', 'banner_updated', { action: 'created', banner });
        res.status(201).json({ message: 'Banner created', banner });
    }
    catch (error) {
        console.error('Create banner error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.createBanner = createBanner;
const deleteBanner = async (req, res) => {
    try {
        const banner = await Banner_1.default.findByIdAndDelete(req.params.id);
        if (banner?.imagePublicId) {
            try {
                await (0, cloudinary_service_1.deleteFromCloudinary)(banner.imagePublicId);
            }
            catch {
                // do not block deletion response on cloudinary cleanup failure
            }
        }
        (0, socket_1.notifyRole)('customer', 'banner_updated', { action: 'deleted', bannerId: req.params.id, banner });
        (0, socket_1.notifyRole)('worker', 'banner_updated', { action: 'deleted', bannerId: req.params.id, banner });
        (0, socket_1.notifyRole)('admin', 'banner_updated', { action: 'deleted', bannerId: req.params.id, banner });
        res.json({ message: 'Banner deleted' });
    }
    catch (error) {
        console.error('Delete banner error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.deleteBanner = deleteBanner;
const updateBanner = async (req, res) => {
    try {
        const { linkUrl, targetPage, isActive, order, editorConfig, ctaConfig, scheduleConfig } = req.body;
        const updateData = {};
        const existing = await Banner_1.default.findById(req.params.id);
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
        if (targetPage !== undefined)
            updateData.targetPage = targetPage;
        if (isActive !== undefined)
            updateData.isActive = isActive === 'true' || isActive === true;
        if (order !== undefined)
            updateData.order = toNumber(order, existing.order);
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
            const uploaded = await (0, cloudinary_service_1.uploadBufferToCloudinary)(req.file.buffer, 'banners');
            updateData.image = uploaded.url;
            updateData.imagePublicId = uploaded.publicId;
            if (existing.imagePublicId) {
                try {
                    await (0, cloudinary_service_1.deleteFromCloudinary)(existing.imagePublicId);
                }
                catch {
                    // non-blocking cleanup
                }
            }
        }
        const banner = await Banner_1.default.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (banner) {
            (0, socket_1.notifyRole)('customer', 'banner_updated', { action: 'updated', banner });
            (0, socket_1.notifyRole)('worker', 'banner_updated', { action: 'updated', banner });
            (0, socket_1.notifyRole)('admin', 'banner_updated', { action: 'updated', banner });
        }
        res.json({ message: 'Banner updated', banner });
    }
    catch (error) {
        console.error('Update banner error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.updateBanner = updateBanner;
const reorderBanners = async (req, res) => {
    try {
        const { bannerIds } = req.body;
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
            await Banner_1.default.bulkWrite(updates);
        }
        const banners = await Banner_1.default.find().sort({ order: 1 });
        (0, socket_1.notifyRole)('customer', 'banner_updated', { action: 'reordered' });
        (0, socket_1.notifyRole)('worker', 'banner_updated', { action: 'reordered' });
        (0, socket_1.notifyRole)('admin', 'banner_updated', { action: 'reordered' });
        res.json({ message: 'Banners reordered', banners });
    }
    catch (error) {
        console.error('Reorder banners error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.reorderBanners = reorderBanners;
// ─── Customers List ───
const getCustomers = async (req, res) => {
    try {
        const q = (req.query.q || '').trim();
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '50', 10)));
        const skip = (page - 1) * limit;
        const searchFilter = q
            ? { $or: [
                    { fullName: { $regex: q, $options: 'i' } },
                    { email: { $regex: q, $options: 'i' } },
                    { phone: { $regex: q, $options: 'i' } },
                ] }
            : {};
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const [total, newToday, activeCountResult, filteredTotal, customers] = await Promise.all([
            User_1.default.countDocuments(),
            User_1.default.countDocuments({ createdAt: { $gte: todayStart } }),
            Booking_1.default.aggregate([{ $group: { _id: '$customer' } }, { $count: 'n' }]),
            q ? User_1.default.countDocuments(searchFilter) : Promise.resolve(null),
            User_1.default.aggregate([
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
    }
    catch (error) {
        console.error('Get customers error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getCustomers = getCustomers;
// ─── Help Tickets ───
const getHelpTickets = async (req, res) => {
    try {
        const { type, status, q } = req.query;
        const baseQuery = {};
        const query = {};
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
            const userModelForLookup = type === 'customer' ? 'User' : type === 'worker' ? 'Worker' : null;
            const [matchedCustomers, matchedWorkers] = await Promise.all([
                userModelForLookup && userModelForLookup !== 'User'
                    ? Promise.resolve([])
                    : User_1.default.find({
                        $or: [
                            { fullName: pattern },
                            { phone: pattern },
                            { email: pattern },
                        ],
                    }).select('_id'),
                userModelForLookup && userModelForLookup !== 'Worker'
                    ? Promise.resolve([])
                    : Worker_1.default.find({
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
        const tickets = await HelpTicket_1.default.find(query)
            .populate('user', 'fullName phone email')
            .sort({ updatedAt: -1 });
        const [totalTickets, openTickets, escalatedTickets, resolvedTickets, customerTickets, workerTickets, customerCreators, workerCreators, ticketsByCategory, createdByUser,] = await Promise.all([
            HelpTicket_1.default.countDocuments(baseQuery),
            HelpTicket_1.default.countDocuments({ ...baseQuery, status: 'open' }),
            HelpTicket_1.default.countDocuments({ ...baseQuery, status: 'escalated' }),
            HelpTicket_1.default.countDocuments({ ...baseQuery, status: 'resolved' }),
            HelpTicket_1.default.countDocuments({ ...baseQuery, userModel: 'User' }),
            HelpTicket_1.default.countDocuments({ ...baseQuery, userModel: 'Worker' }),
            HelpTicket_1.default.distinct('user', { ...baseQuery, userModel: 'User' }),
            HelpTicket_1.default.distinct('user', { ...baseQuery, userModel: 'Worker' }),
            HelpTicket_1.default.aggregate([
                { $match: baseQuery },
                { $group: { _id: '$category', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
            ]),
            HelpTicket_1.default.aggregate([
                { $match: baseQuery },
                {
                    $group: {
                        _id: { user: '$user', userModel: '$userModel' },
                        count: { $sum: 1 },
                    },
                },
            ]),
        ]);
        const ticketCountByUser = new Map();
        createdByUser.forEach((entry) => {
            const key = `${entry._id.userModel}:${entry._id.user.toString()}`;
            ticketCountByUser.set(key, entry.count);
        });
        const ticketsWithMeta = tickets.map((ticket) => {
            const ticketObj = ticket.toObject();
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
    }
    catch (error) {
        console.error('Get help tickets error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getHelpTickets = getHelpTickets;
const resolveHelpTicket = async (req, res) => {
    try {
        const ticket = await HelpTicket_1.default.findByIdAndUpdate(req.params.id, { status: 'resolved' }, { new: true });
        if (ticket) {
            const ticketForAdmin = await HelpTicket_1.default.findById(ticket._id)
                .populate('user', 'fullName phone email');
            (0, socket_1.notifyUser)(ticket.user.toString(), 'help_ticket_updated', {
                action: 'resolved',
                ticket,
            });
            if (ticketForAdmin) {
                (0, socket_1.notifyRole)('admin', 'help_ticket_updated', {
                    action: 'resolved',
                    ticket: ticketForAdmin,
                });
            }
        }
        await (0, adminActivity_1.logAdminActivity)(req, { action: 'ticket.resolve', category: 'support', targetType: 'ticket', targetId: String(ticket?._id || ''), meta: { userModel: ticket?.userModel } });
        res.json({ message: 'Ticket resolved', ticket });
    }
    catch (error) {
        console.error('Resolve help ticket error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.resolveHelpTicket = resolveHelpTicket;
// ─── Admin Reply to Help Ticket ───
const replyHelpTicket = async (req, res) => {
    try {
        const { message } = req.body;
        const ticket = await HelpTicket_1.default.findById(req.params.id);
        if (!ticket) {
            res.status(404).json({ message: 'Ticket not found' });
            return;
        }
        ticket.chatHistory.push({ sender: 'admin', message, timestamp: new Date() });
        await ticket.save();
        const ticketForAdmin = await HelpTicket_1.default.findById(ticket._id)
            .populate('user', 'fullName phone email');
        (0, socket_1.notifyUser)(ticket.user.toString(), 'help_ticket_updated', {
            action: 'reply',
            ticket,
        });
        if (ticketForAdmin) {
            (0, socket_1.notifyRole)('admin', 'help_ticket_updated', {
                action: 'reply',
                ticket: ticketForAdmin,
            });
        }
        // Create notification for the user
        await (0, socket_1.sendNotification)({
            recipientId: ticket.user.toString(),
            recipientModel: ticket.userModel,
            type: 'help_reply',
            title: 'Support Reply',
            message: 'You have a new reply on your support ticket.',
            data: { ticketId: ticket._id },
        });
        res.json({ message: 'Reply sent', ticket: ticketForAdmin || ticket });
    }
    catch (error) {
        console.error('Reply help ticket error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.replyHelpTicket = replyHelpTicket;
// ─── Get Pending Refunds ───
const getRefunds = async (_req, res) => {
    try {
        const refunds = await Booking_1.default.find({
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
        const paymentTxns = await Transaction_1.default.find({
            booking: { $in: bookingIds },
            type: 'booking_payment',
        }).select('booking status razorpayPaymentId amount');
        const txnMap = new Map();
        paymentTxns.forEach((t) => {
            if (t.booking)
                txnMap.set(t.booking.toString(), t);
        });
        const enrichedRefunds = refunds.map((r) => {
            const obj = r.toObject();
            const txn = txnMap.get(r._id.toString());
            obj.paymentTransaction = txn
                ? { status: txn.status, razorpayPaymentId: txn.razorpayPaymentId, amount: txn.amount }
                : null;
            return obj;
        });
        res.json({ refunds: enrichedRefunds });
    }
    catch (error) {
        console.error('Get refunds error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getRefunds = getRefunds;
// ─── Process Refund ───
const processRefund = async (req, res) => {
    try {
        const booking = await Booking_1.default.findById(req.params.bookingId);
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
        await Transaction_1.default.create({
            tid: (await Promise.resolve().then(() => __importStar(require('../utils/generateTID')))).generateTID(),
            booking: booking._id,
            user: booking.customer,
            type: 'refund',
            amount: booking.amount,
            method: 'online',
            status: 'completed',
        });
        // Notify customer
        await (0, socket_1.sendNotification)({
            recipientId: booking.customer.toString(),
            recipientModel: 'User',
            type: 'refund_completed',
            title: 'Refund Processed',
            message: `Your refund of ₹${booking.amount} has been processed successfully.`,
            data: { bookingId: booking._id },
        });
        (0, exports.clearDashboardCache)();
        await (0, adminActivity_1.logAdminActivity)(req, { action: 'refund.process', category: 'refunds', targetType: 'booking', targetId: String(booking._id), amount: booking.amount });
        res.json({ message: 'Refund processed', booking });
    }
    catch (error) {
        console.error('Process refund error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.processRefund = processRefund;
// ─── Reject Refund ───
const rejectRefund = async (req, res) => {
    try {
        const { reason } = req.body;
        if (!reason) {
            res.status(400).json({ message: 'Rejection reason is required' });
            return;
        }
        const booking = await Booking_1.default.findById(req.params.bookingId);
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
        await (0, socket_1.sendNotification)({
            recipientId: booking.customer.toString(),
            recipientModel: 'User',
            type: 'refund_rejected',
            title: 'Refund Request Rejected',
            message: `Your refund request has been rejected. Reason: ${reason}`,
            data: { bookingId: booking._id },
        });
        await (0, adminActivity_1.logAdminActivity)(req, { action: 'refund.reject', category: 'refunds', targetType: 'booking', targetId: String(booking._id) });
        res.json({ message: 'Refund rejected', booking });
    }
    catch (error) {
        console.error('Reject refund error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.rejectRefund = rejectRefund;
// ─── Admin Notifications ───
const getAdminNotifications = async (req, res) => {
    try {
        const notifications = await Notification_1.default.find({ recipient: req.user.id, recipientModel: 'Admin' })
            .sort({ createdAt: -1 })
            .limit(50);
        res.json({ notifications });
    }
    catch (error) {
        console.error('Get admin notifications error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getAdminNotifications = getAdminNotifications;
const markAdminNotificationRead = async (req, res) => {
    try {
        await Notification_1.default.findOneAndUpdate({ _id: req.params.id, recipient: req.user.id }, { isRead: true });
        res.json({ message: 'Marked as read' });
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
exports.markAdminNotificationRead = markAdminNotificationRead;
const markAllAdminNotificationsRead = async (req, res) => {
    try {
        await Notification_1.default.updateMany({ recipient: req.user.id, recipientModel: 'Admin', isRead: false }, { isRead: true });
        res.json({ message: 'All marked as read' });
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
exports.markAllAdminNotificationsRead = markAllAdminNotificationsRead;
const deleteAdminNotification = async (req, res) => {
    try {
        await Notification_1.default.findOneAndDelete({ _id: req.params.id, recipient: req.user.id });
        res.json({ message: 'Deleted' });
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
exports.deleteAdminNotification = deleteAdminNotification;
// ─── Chatbot QA Management ───
const getChatbotQA = async (_req, res) => {
    try {
        const qas = await ChatbotQA_1.default.find().sort({ category: 1, order: 1 });
        res.json({ qas });
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getChatbotQA = getChatbotQA;
const createChatbotQA = async (req, res) => {
    try {
        const qa = await ChatbotQA_1.default.create(req.body);
        res.status(201).json({ message: 'QA created', qa });
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
exports.createChatbotQA = createChatbotQA;
const updateChatbotQA = async (req, res) => {
    try {
        const qa = await ChatbotQA_1.default.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json({ message: 'QA updated', qa });
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
exports.updateChatbotQA = updateChatbotQA;
const deleteChatbotQA = async (req, res) => {
    try {
        await ChatbotQA_1.default.findByIdAndDelete(req.params.id);
        res.json({ message: 'QA deleted' });
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
exports.deleteChatbotQA = deleteChatbotQA;
// ─── Workers List ───
const getAllWorkers = async (req, res) => {
    try {
        const { status, search } = req.query;
        const filter = {};
        if (status && status !== 'all')
            filter.accountStatus = status;
        if (search) {
            const s = String(search);
            filter.$or = [
                { fullName: { $regex: s, $options: 'i' } },
                { phone: { $regex: s, $options: 'i' } },
            ];
        }
        const workers = await Worker_1.default.find(filter)
            .select('fullName phone profileImage accountStatus isActive categories rating totalWorkDone totalEarnings balance block createdAt')
            .populate('categories', 'name')
            .sort({ createdAt: -1 });
        const [statTotal, statLive, statPending, statRejected] = await Promise.all([
            Worker_1.default.countDocuments(),
            Worker_1.default.countDocuments({ accountStatus: 'live' }),
            Worker_1.default.countDocuments({ accountStatus: { $in: ['test', 'ekyc_pending', 'ekyc_done'] } }),
            Worker_1.default.countDocuments({ accountStatus: 'rejected' }),
        ]);
        const stats = { total: statTotal, live: statLive, pending: statPending, rejected: statRejected };
        res.json({ workers, stats });
    }
    catch (error) {
        console.error('Get all workers error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getAllWorkers = getAllWorkers;
// ─── Worker Detail ───
const getWorkerDetail = async (req, res) => {
    try {
        const worker = await Worker_1.default.findById(req.params.id)
            .select('-password')
            .populate('categories', 'name slug image');
        if (!worker) {
            res.status(404).json({ message: 'Worker not found' });
            return;
        }
        // Get bookings for this worker
        const bookings = await Booking_1.default.find({ assignedWorker: worker._id })
            .populate('customer', 'fullName phone')
            .populate('category', 'name')
            .sort({ createdAt: -1 })
            .limit(50);
        const bookingStatsFacet = await Booking_1.default.aggregate([
            { $match: { assignedWorker: worker._id } },
            { $facet: {
                    total: [{ $count: 'n' }],
                    completed: [{ $match: { status: 'completed' } }, { $count: 'n' }],
                    cancelled: [{ $match: { status: 'cancelled' } }, { $count: 'n' }],
                    inProgress: [{ $match: { status: 'in_progress' } }, { $count: 'n' }],
                } },
        ]);
        const bookingStats = {
            total: bookingStatsFacet[0]?.total[0]?.n ?? 0,
            completed: bookingStatsFacet[0]?.completed[0]?.n ?? 0,
            cancelled: bookingStatsFacet[0]?.cancelled[0]?.n ?? 0,
            inProgress: bookingStatsFacet[0]?.inProgress[0]?.n ?? 0,
        };
        // Get reviews from completed bookings
        const reviewBookings = await Booking_1.default.find({
            assignedWorker: worker._id,
            'review.rating': { $exists: true },
        })
            .select('review customer category amount createdAt')
            .populate('customer', 'fullName phone')
            .populate('category', 'name')
            .sort({ 'review.createdAt': -1 })
            .limit(20);
        // Transaction history
        const transactions = await Transaction_1.default.find({ worker: worker._id })
            .sort({ createdAt: -1 })
            .limit(30);
        // Withdrawal history
        const withdrawals = await Withdrawal_1.default.find({ worker: worker._id })
            .sort({ createdAt: -1 })
            .limit(20);
        res.json({ worker, bookings, bookingStats, reviewBookings, transactions, withdrawals });
    }
    catch (error) {
        console.error('Get worker detail error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getWorkerDetail = getWorkerDetail;
// ───────────────────────────────────────────────────────────────
// Cancellation moderation: temporary block / unblock + flag watch
// ───────────────────────────────────────────────────────────────
const applyBlock = (doc, hours, reason, adminId) => {
    if (!doc.block)
        doc.block = {};
    doc.block.isBlocked = true;
    doc.block.reason = reason || 'Temporarily restricted for excessive cancellations.';
    doc.block.blockedAt = new Date();
    doc.block.blockedUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
    doc.block.blockedBy = adminId;
    doc.block.blockCount = (doc.block.blockCount || 0) + 1;
};
const clearBlock = (doc) => {
    if (!doc.block)
        doc.block = {};
    doc.block.isBlocked = false;
    doc.block.reason = '';
    doc.block.blockedAt = null;
    doc.block.blockedUntil = null;
    doc.block.blockedBy = null;
};
const blockCustomer = async (req, res) => {
    try {
        const hours = Number(req.body?.hours);
        const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
        if (!hours || hours <= 0 || hours > 720) {
            res.status(400).json({ message: 'Provide valid block hours (1-720)' });
            return;
        }
        const user = await User_1.default.findById(req.params.id);
        if (!user) {
            res.status(404).json({ message: 'Customer not found' });
            return;
        }
        applyBlock(user, hours, reason, req.user.id);
        await user.save();
        (0, socket_1.notifyUser)(user._id.toString(), 'account_blocked', { block: (0, userBlock_1.blockPayload)(user.block) });
        await (0, adminActivity_1.logAdminActivity)(req, { action: 'customer.block', category: 'moderation', targetType: 'customer', targetId: String(user._id), meta: { hours, reason } });
        res.json({ message: `Customer blocked for ${hours} hours`, block: (0, userBlock_1.blockPayload)(user.block) });
    }
    catch (error) {
        console.error('Block customer error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.blockCustomer = blockCustomer;
const unblockCustomer = async (req, res) => {
    try {
        const user = await User_1.default.findById(req.params.id);
        if (!user) {
            res.status(404).json({ message: 'Customer not found' });
            return;
        }
        clearBlock(user);
        await user.save();
        (0, socket_1.notifyUser)(user._id.toString(), 'account_unblocked', {});
        await (0, adminActivity_1.logAdminActivity)(req, { action: 'customer.unblock', category: 'moderation', targetType: 'customer', targetId: String(user._id) });
        res.json({ message: 'Customer unblocked' });
    }
    catch (error) {
        console.error('Unblock customer error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.unblockCustomer = unblockCustomer;
const blockWorkerAccount = async (req, res) => {
    try {
        const hours = Number(req.body?.hours);
        const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
        if (!hours || hours <= 0 || hours > 720) {
            res.status(400).json({ message: 'Provide valid block hours (1-720)' });
            return;
        }
        const worker = await Worker_1.default.findById(req.params.id);
        if (!worker) {
            res.status(404).json({ message: 'Worker not found' });
            return;
        }
        applyBlock(worker, hours, reason, req.user.id);
        await worker.save();
        (0, socket_1.notifyUser)(worker._id.toString(), 'account_blocked', { block: (0, userBlock_1.blockPayload)(worker.block) });
        await (0, adminActivity_1.logAdminActivity)(req, { action: 'worker.block', category: 'moderation', targetType: 'worker', targetId: String(worker._id), meta: { hours, reason } });
        res.json({ message: `Worker blocked for ${hours} hours`, block: (0, userBlock_1.blockPayload)(worker.block) });
    }
    catch (error) {
        console.error('Block worker error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.blockWorkerAccount = blockWorkerAccount;
const unblockWorkerAccount = async (req, res) => {
    try {
        const worker = await Worker_1.default.findById(req.params.id);
        if (!worker) {
            res.status(404).json({ message: 'Worker not found' });
            return;
        }
        clearBlock(worker);
        await worker.save();
        (0, socket_1.notifyUser)(worker._id.toString(), 'account_unblocked', {});
        await (0, adminActivity_1.logAdminActivity)(req, { action: 'worker.unblock', category: 'moderation', targetType: 'worker', targetId: String(worker._id) });
        res.json({ message: 'Worker unblocked' });
    }
    catch (error) {
        console.error('Unblock worker error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.unblockWorkerAccount = unblockWorkerAccount;
// Customers / workers with many recent cancellations (default: >= 3 in 24h).
const getCancellationFlags = async (req, res) => {
    try {
        const hours = Math.min(168, Math.max(1, Number(req.query.hours) || 24));
        const min = Math.max(2, Number(req.query.min) || 3);
        const since = new Date(Date.now() - hours * 60 * 60 * 1000);
        const [custAgg, workAgg] = await Promise.all([
            Booking_1.default.aggregate([
                { $match: { 'cancellation.cancelledBy': 'customer', 'cancellation.cancelledAt': { $gte: since } } },
                { $group: { _id: '$customer', count: { $sum: 1 }, lastAt: { $max: '$cancellation.cancelledAt' } } },
                { $match: { count: { $gte: min } } },
                { $sort: { count: -1 } },
            ]),
            Booking_1.default.aggregate([
                { $match: { 'cancellation.cancelledBy': 'worker', 'cancellation.cancelledAt': { $gte: since } } },
                { $group: { _id: '$assignedWorker', count: { $sum: 1 }, lastAt: { $max: '$cancellation.cancelledAt' } } },
                { $match: { count: { $gte: min } } },
                { $sort: { count: -1 } },
            ]),
        ]);
        const custIds = custAgg.map((c) => c._id).filter(Boolean);
        const workIds = workAgg.map((w) => w._id).filter(Boolean);
        const [users, workers] = await Promise.all([
            User_1.default.find({ _id: { $in: custIds } }).select('fullName phone email profileImage block'),
            Worker_1.default.find({ _id: { $in: workIds } }).select('fullName phone email profileImage block'),
        ]);
        const uMap = new Map(users.map((u) => [String(u._id), u]));
        const wMap = new Map(workers.map((w) => [String(w._id), w]));
        const customers = custAgg
            .map((c) => {
            const u = uMap.get(String(c._id));
            return u ? { _id: u._id, fullName: u.fullName, phone: u.phone, email: u.email, profileImage: u.profileImage, cancelCount: c.count, lastAt: c.lastAt, block: (0, userBlock_1.blockPayload)(u.block) } : null;
        })
            .filter(Boolean);
        const flaggedWorkers = workAgg
            .map((w) => {
            const d = wMap.get(String(w._id));
            return d ? { _id: d._id, fullName: d.fullName, phone: d.phone, email: d.email, profileImage: d.profileImage, cancelCount: w.count, lastAt: w.lastAt, block: (0, userBlock_1.blockPayload)(d.block) } : null;
        })
            .filter(Boolean);
        res.json({ window: { hours, min }, customers, workers: flaggedWorkers });
    }
    catch (error) {
        console.error('Get cancellation flags error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getCancellationFlags = getCancellationFlags;
// ───────────────────────────────────────────────────────────────
// Admin push / broadcast notifications (Swiggy/Zomato style)
// ───────────────────────────────────────────────────────────────
const resolveAudience = (raw) => raw === 'worker'
    ? { Model: Worker_1.default, recipientModel: 'Worker', role: 'worker' }
    : { Model: User_1.default, recipientModel: 'User', role: 'customer' };
// Best-effort push fan-out to everyone who has a registered device/browser.
const broadcastPushToTokenHolders = async (recipientModel, title, message, data) => {
    try {
        const [mobileIds, webIds] = await Promise.all([
            MobilePushToken_1.default.find({ recipientModel, isActive: true }).distinct('recipient'),
            PushSubscription_1.default.find({ recipientModel }).distinct('recipient'),
        ]);
        const unique = new Set([...mobileIds.map(String), ...webIds.map(String)]);
        const now = new Date();
        for (const recipientId of unique) {
            const payload = { recipientId, recipientModel, notificationId: 'broadcast', type: 'admin_broadcast', title, message, data, createdAt: now };
            await Promise.allSettled([(0, mobilePush_service_1.sendMobilePushNotification)(payload), (0, webPush_service_1.sendWebPushNotification)(payload)]);
        }
    }
    catch (error) {
        console.error('Broadcast push fan-out error:', error);
    }
};
// Core broadcast: in-app (bulk) + live socket + background push fan-out.
// Returns how many recipients received the in-app notification.
const broadcastToAudience = async (audience, title, message, data = {}, type = 'admin_broadcast') => {
    const { Model, recipientModel, role } = resolveAudience(audience);
    const filter = recipientModel === 'User' ? { isActive: { $ne: false } } : {};
    const recipients = await Model.find(filter).select('_id').lean();
    if (recipients.length) {
        const docs = recipients.map((r) => ({ recipient: r._id, recipientModel, type, title, message, data }));
        await Notification_1.default.insertMany(docs, { ordered: false }).catch(() => { });
    }
    (0, socket_1.notifyRole)(role, 'notification_event', { type, title, message, isRead: false, createdAt: new Date(), data });
    void broadcastPushToTokenHolders(recipientModel, title, message, data);
    return recipients.length;
};
exports.broadcastToAudience = broadcastToAudience;
// POST /admin/push/:audience/broadcast  — send to ALL customers or ALL workers
const broadcastNotification = async (req, res) => {
    try {
        const audience = String(req.params.audience) === 'worker' ? 'worker' : 'customer';
        const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
        const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
        if (!title || !message) {
            res.status(400).json({ message: 'Title and message are required' });
            return;
        }
        if (title.length > 120 || message.length > 500) {
            res.status(400).json({ message: 'Title/message too long' });
            return;
        }
        const count = await (0, exports.broadcastToAudience)(audience, title, message, { broadcast: true });
        await (0, adminActivity_1.logAdminActivity)(req, { action: `notify.broadcast.${audience}`, category: 'notifications', meta: { count, title } });
        res.json({ message: `Notification sent to ${count} ${audience}s`, count });
    }
    catch (error) {
        console.error('Broadcast notification error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.broadcastNotification = broadcastNotification;
// POST /admin/push/:audience/personal  — send to one selected user
const personalNotification = async (req, res) => {
    try {
        const { Model, recipientModel, role } = resolveAudience(String(req.params.audience));
        const recipientId = typeof req.body?.recipientId === 'string' ? req.body.recipientId : '';
        const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
        const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
        if (!recipientId || !title || !message) {
            res.status(400).json({ message: 'Recipient, title and message are required' });
            return;
        }
        const exists = await Model.exists({ _id: recipientId });
        if (!exists) {
            res.status(404).json({ message: `${role} not found` });
            return;
        }
        // sendNotification already does in-app + socket + web/mobile push.
        await (0, socket_1.sendNotification)({ recipientId, recipientModel, type: 'admin_personal', title, message, data: { personal: true } });
        await (0, adminActivity_1.logAdminActivity)(req, { action: `notify.personal.${role}`, category: 'notifications', targetType: role, targetId: recipientId, meta: { title } });
        res.json({ message: 'Notification sent' });
    }
    catch (error) {
        console.error('Personal notification error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.personalNotification = personalNotification;
// GET /admin/waitlist — locations customers requested where Fixo isn't available yet
const getWaitlist = async (req, res) => {
    try {
        const status = req.query.status === 'reached' ? 'reached' : 'pending';
        const [waitlist, pendingCount, reachedCount] = await Promise.all([
            Waitlist_1.default.find({ status }).populate('user', 'fullName phone email').sort({ createdAt: -1 }).limit(300).lean(),
            Waitlist_1.default.countDocuments({ status: 'pending' }),
            Waitlist_1.default.countDocuments({ status: 'reached' }),
        ]);
        res.json({ waitlist, stats: { pending: pendingCount, reached: reachedCount } });
    }
    catch (error) {
        console.error('Get waitlist error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getWaitlist = getWaitlist;
const markWaitlistReached = async (req, res) => {
    try {
        const entry = await Waitlist_1.default.findByIdAndUpdate(req.params.id, { status: 'reached' }, { new: true });
        if (!entry) {
            res.status(404).json({ message: 'Entry not found' });
            return;
        }
        (0, socket_1.notifyUser)(entry.user.toString(), 'notification_event', {
            type: 'service_added',
            title: 'Great news! 🎉',
            message: 'Fixo is now available in your requested area. You can book a service now!',
            isRead: false, createdAt: new Date(), data: {},
        });
        await (0, socket_1.sendNotification)({
            recipientId: entry.user.toString(), recipientModel: 'User', type: 'service_added',
            title: 'Great news! 🎉', message: 'Fixo is now available in your requested area. You can book a service now!',
        });
        await (0, adminActivity_1.logAdminActivity)(req, { action: 'waitlist.reached', category: 'general', targetType: 'waitlist', targetId: String(entry._id) });
        res.json({ message: 'Marked as reached & customer notified' });
    }
    catch (error) {
        console.error('Mark waitlist reached error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.markWaitlistReached = markWaitlistReached;
// GET /admin/push/:audience/recipients?q=  — search users for the personal picker
const searchNotificationRecipients = async (req, res) => {
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
        const recipients = await Model.find(filter)
            .select('fullName phone email profileImage')
            .sort({ createdAt: -1 })
            .limit(20);
        res.json({ recipients });
    }
    catch (error) {
        console.error('Search recipients error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.searchNotificationRecipients = searchNotificationRecipients;
// ───────────────────────────────────────────────────────────────
// Worker skill review (new skill requests after approval)
// ───────────────────────────────────────────────────────────────
// GET /admin/skill-requests — workers with skills awaiting verification
const getSkillRequests = async (_req, res) => {
    try {
        const workers = await Worker_1.default.find({ 'skills.status': 'pending_review' })
            .select('fullName phone email profileImage skills rating accountStatus createdAt')
            .populate('skills.category', 'name image')
            .sort({ updatedAt: -1 })
            .limit(200)
            .lean();
        res.json({ workers });
    }
    catch (error) {
        console.error('Get skill requests error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getSkillRequests = getSkillRequests;
const notifySkillResult = (workerId, title, message) => {
    void (0, socket_1.sendNotification)({ recipientId: workerId, recipientModel: 'Worker', type: 'skill_review', title, message }).catch(() => { });
};
// POST /admin/skill-requests/:workerId/:skillId/decision { decision, reason }
const reviewSkill = async (req, res) => {
    try {
        const decision = req.body?.decision === 'approve' ? 'approve' : 'reject';
        const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
        const worker = await Worker_1.default.findById(req.params.workerId);
        if (!worker) {
            res.status(404).json({ message: 'Worker not found' });
            return;
        }
        const skill = (worker.skills || []).find((s) => String(s._id) === req.params.skillId);
        if (!skill || skill.status !== 'pending_review') {
            res.status(400).json({ message: 'No pending request for this skill' });
            return;
        }
        const cat = await Category_1.default.findById(skill.category).select('name');
        skill.decidedAt = new Date();
        if (decision === 'approve') {
            skill.status = 'approved';
            skill.rejectionReason = '';
            (0, workerSkills_1.syncCategoriesFromSkills)(worker);
            await worker.save();
            notifySkillResult(String(worker._id), 'Skill Approved ✅', `Your "${cat?.name || 'new'}" skill is approved. You can now take these jobs.`);
        }
        else {
            skill.status = 'rejected';
            skill.rejectionReason = reason || 'Could not verify this skill';
            await worker.save();
            notifySkillResult(String(worker._id), 'Skill Not Approved', `Your "${cat?.name || 'requested'}" skill request was rejected. ${reason ? 'Reason: ' + reason : ''}`);
        }
        await (0, adminActivity_1.logAdminActivity)(req, { action: `skill.${decision}`, category: 'skill_review', targetType: 'worker', targetId: String(worker._id), meta: { category: cat?.name } });
        res.json({ message: decision === 'approve' ? 'Skill approved' : 'Skill rejected' });
    }
    catch (error) {
        console.error('Review skill error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.reviewSkill = reviewSkill;
// POST /admin/skill-requests/:workerId/:skillId/call-attempt — log a call try (auto-reject at 3)
const logSkillCallAttempt = async (req, res) => {
    try {
        const worker = await Worker_1.default.findById(req.params.workerId);
        if (!worker) {
            res.status(404).json({ message: 'Worker not found' });
            return;
        }
        const skill = (worker.skills || []).find((s) => String(s._id) === req.params.skillId);
        if (!skill || skill.status !== 'pending_review') {
            res.status(400).json({ message: 'No pending request' });
            return;
        }
        skill.callAttempts = (skill.callAttempts || 0) + 1;
        let autoRejected = false;
        if (skill.callAttempts >= 3) {
            skill.status = 'rejected';
            skill.rejectionReason = 'Could not connect on call after 3 attempts';
            skill.decidedAt = new Date();
            autoRejected = true;
            const cat = await Category_1.default.findById(skill.category).select('name');
            notifySkillResult(String(worker._id), 'Skill Not Approved', `We could not reach you to verify "${cat?.name || 'your requested skill'}". Please request again when reachable.`);
        }
        await worker.save();
        res.json({ message: autoRejected ? 'Auto-rejected after 3 attempts' : 'Call attempt logged', callAttempts: skill.callAttempts, autoRejected });
    }
    catch (error) {
        console.error('Skill call attempt error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.logSkillCallAttempt = logSkillCallAttempt;
//# sourceMappingURL=admin.controller.js.map