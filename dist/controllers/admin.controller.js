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
exports.getWorkerDetail = exports.getAllWorkers = exports.getCashPayments = exports.deleteChatbotQA = exports.updateChatbotQA = exports.createChatbotQA = exports.getChatbotQA = exports.deleteAdminNotification = exports.markAllAdminNotificationsRead = exports.markAdminNotificationRead = exports.getAdminNotifications = exports.rejectRefund = exports.processRefund = exports.getRefunds = exports.notifyWorkerDues = exports.replyHelpTicket = exports.resolveHelpTicket = exports.getHelpTickets = exports.getWorkerDues = exports.getCommissions = exports.getCustomers = exports.reorderBanners = exports.updateBanner = exports.deleteBanner = exports.createBanner = exports.getBanners = exports.deleteCategory = exports.updateCategoryDetails = exports.updateCategory = exports.createCategory = exports.getCategories = exports.declineWithdrawal = exports.completeWithdrawal = exports.getWithdrawals = exports.saveEkycCapture = exports.rejectWorker = exports.approveWorker = exports.updateVideoKycResult = exports.getWorkerEKYCDetails = exports.getPendingEKYC = exports.getAdminBootstrapStatus = exports.getPendingAdminBadges = exports.getDashboard = void 0;
const Worker_1 = __importDefault(require("../models/Worker"));
const User_1 = __importDefault(require("../models/User"));
const Booking_1 = __importDefault(require("../models/Booking"));
const Transaction_1 = __importDefault(require("../models/Transaction"));
const Withdrawal_1 = __importDefault(require("../models/Withdrawal"));
const Category_1 = __importDefault(require("../models/Category"));
const Banner_1 = __importDefault(require("../models/Banner"));
const HelpTicket_1 = __importDefault(require("../models/HelpTicket"));
const ChatbotQA_1 = __importDefault(require("../models/ChatbotQA"));
const socket_1 = require("../socket");
const Notification_1 = __importDefault(require("../models/Notification"));
const cloudinary_service_1 = require("../services/cloudinary.service");
const adminBootstrap_service_1 = require("../services/adminBootstrap.service");
const VIDEO_KYC_RETRY_COOLDOWN_MS = 3 * 60 * 1000;
// ─── Dashboard Stats ───
const getDashboard = async (_req, res) => {
    try {
        const totalWorkers = await Worker_1.default.countDocuments();
        const activeWorkers = await Worker_1.default.countDocuments({ isActive: true, accountStatus: 'live' });
        const pendingEKYC = await Worker_1.default.countDocuments({ accountStatus: { $in: ['test', 'ekyc_pending', 'ekyc_done'] } });
        const pendingWithdrawals = await Withdrawal_1.default.countDocuments({ status: 'pending' });
        const totalCustomers = await User_1.default.countDocuments();
        const pendingHelpTickets = await HelpTicket_1.default.countDocuments({ status: { $in: ['open', 'escalated'] } });
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayWorkDone = await Booking_1.default.countDocuments({
            status: 'completed',
            updatedAt: { $gte: today },
        });
        const totalBookings = await Booking_1.default.countDocuments();
        const totalCompleted = await Booking_1.default.countDocuments({ status: 'completed' });
        const totalCancelled = await Booking_1.default.countDocuments({ status: 'cancelled' });
        const totalInProgress = await Booking_1.default.countDocuments({ status: 'in_progress' });
        // Commission earnings
        const commissionStats = await Transaction_1.default.aggregate([
            { $match: { type: 'commission', status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);
        // Monthly profit (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const monthlyProfit = await Transaction_1.default.aggregate([
            {
                $match: {
                    type: { $in: ['commission', 'dues_deposit', 'dues_auto_deduct', 'dues_wallet_deduct'] },
                    status: 'completed',
                    createdAt: { $gte: thirtyDaysAgo },
                },
            },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);
        // Total dues outstanding
        const duesStats = await Worker_1.default.aggregate([
            { $match: { dues: { $gt: 0 } } },
            { $group: { _id: null, totalDues: { $sum: '$dues' }, count: { $sum: 1 } } },
        ]);
        // --- Chart Data: Last 7 days revenue (daily breakdown) ---
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);
        const dailyRevenue = await Transaction_1.default.aggregate([
            {
                $match: {
                    type: { $in: ['commission', 'dues_deposit', 'dues_auto_deduct', 'dues_wallet_deduct'] },
                    status: 'completed',
                    createdAt: { $gte: sevenDaysAgo },
                },
            },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                        type: '$type',
                    },
                    total: { $sum: '$amount' },
                },
            },
        ]);
        // --- Chart Data: Last 7 days bookings (daily) ---
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
        // Build last 7 days arrays
        const revenueChart = [];
        const bookingsChart = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const dayLabel = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
            let commission = 0, dues = 0;
            for (const r of dailyRevenue) {
                if (r._id.date === dateStr) {
                    if (r._id.type === 'commission')
                        commission = r.total;
                    else
                        dues += r.total;
                }
            }
            revenueChart.push({ date: dayLabel, commission, dues, total: commission + dues });
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
        // --- Donut: Revenue breakdown ---
        const revenueBreakdown = await Transaction_1.default.aggregate([
            { $match: { type: { $in: ['commission', 'dues_deposit', 'dues_auto_deduct', 'dues_wallet_deduct'] }, status: 'completed' } },
            { $group: { _id: '$type', total: { $sum: '$amount' } } },
        ]);
        const revenueDonut = revenueBreakdown.map((r) => ({
            name: r._id === 'commission'
                ? 'Online Commission'
                : r._id === 'dues_deposit'
                    ? 'Dues (Razorpay)'
                    : r._id === 'dues_wallet_deduct'
                        ? 'Dues (Wallet)'
                        : 'Dues (Auto-Deduct)',
            value: r.total,
        }));
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
        res.json({
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
            totalCommissionEarnings: commissionStats[0]?.total || 0,
            monthlyProfit: monthlyProfit[0]?.total || 0,
            totalDuesOutstanding: duesStats[0]?.totalDues || 0,
            workersWithDues: duesStats[0]?.count || 0,
            // Charts
            revenueChart,
            bookingsChart,
            revenueDonut,
            bookingStatusDonut,
            paymentMethodDonut,
            workerStatusDonut,
            topCategories,
        });
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
        const [pendingEKYC, pendingWithdrawals, pendingRefunds, pendingSupport] = await Promise.all([
            Worker_1.default.countDocuments({ accountStatus: { $in: ['test', 'ekyc_pending', 'ekyc_done'] } }),
            Withdrawal_1.default.countDocuments({ status: 'pending' }),
            Booking_1.default.countDocuments({ paymentStatus: 'refund_pending' }),
            HelpTicket_1.default.countDocuments({ status: { $in: ['open', 'escalated'] } }),
        ]);
        const pendingFinance = pendingWithdrawals + pendingRefunds;
        const totalActionRequired = pendingEKYC + pendingFinance + pendingSupport;
        res.json({
            pendingEKYC,
            pendingWithdrawals,
            pendingRefunds,
            pendingSupport,
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
        const workers = await Worker_1.default.find({
            accountStatus: { $in: ['test', 'ekyc_pending', 'ekyc_done'] },
        }).sort({ createdAt: -1 });
        const approvedCount = await Worker_1.default.countDocuments({ accountStatus: { $in: ['approved', 'live'] } });
        const rejectedCount = await Worker_1.default.countDocuments({ accountStatus: 'rejected' });
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
        const worker = await Worker_1.default.findById(req.params.workerId);
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
        const worker = await Worker_1.default.findByIdAndUpdate(req.params.workerId, {
            accountStatus: 'approved',
            ekycRejectionReason: undefined,
            videoKycIncompleteReason: '',
            videoKycRetryAvailableAt: null,
        }, { new: true });
        if (!worker) {
            res.status(404).json({ message: 'Worker not found' });
            return;
        }
        // Notify worker in real-time so their page updates instantly
        (0, socket_1.notifyUser)(worker._id.toString(), 'kyc_status_updated', {
            workerId: worker._id,
            status: 'approved',
            worker,
        });
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
const getCustomers = async (_req, res) => {
    try {
        const customers = await User_1.default.find().sort({ createdAt: -1 });
        const customerStats = await Promise.all(customers.map(async (customer) => {
            const bookingCount = await Booking_1.default.countDocuments({ customer: customer._id });
            const completedCount = await Booking_1.default.countDocuments({ customer: customer._id, status: 'completed' });
            return {
                ...customer.toObject(),
                totalBookings: bookingCount,
                completedBookings: completedCount,
            };
        }));
        res.json({ customers: customerStats });
    }
    catch (error) {
        console.error('Get customers error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getCustomers = getCustomers;
// ─── Commission Details ───
const getCommissions = async (_req, res) => {
    try {
        // Detailed per-transaction commission list with customer + worker + booking info
        const commissions = await Transaction_1.default.find({ type: 'commission', status: 'completed' })
            .populate('worker', 'fullName phone profileImage')
            .populate({
            path: 'booking',
            select: 'workDescription category amount paymentMethod customer',
            populate: [
                { path: 'category', select: 'name' },
                { path: 'customer', select: 'fullName phone' },
            ],
        })
            .sort({ createdAt: -1 });
        const totalCommission = commissions.reduce((sum, c) => sum + c.amount, 0);
        // Per-worker breakdown
        const perWorker = await Transaction_1.default.aggregate([
            { $match: { type: 'commission', status: 'completed' } },
            {
                $group: {
                    _id: '$worker',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 },
                },
            },
            {
                $lookup: {
                    from: 'workers',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'worker',
                },
            },
            { $unwind: '$worker' },
            { $sort: { total: -1 } },
        ]);
        // Dues income (paid dues deposits — platform revenue from cash surcharges)
        const duesIncome = await Transaction_1.default.aggregate([
            { $match: { type: { $in: ['dues_deposit', 'dues_auto_deduct', 'dues_wallet_deduct'] }, status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]);
        // Total revenue = online commissions + cash dues collected
        const totalDuesCollected = duesIncome[0]?.total || 0;
        res.json({
            commissions,
            totalCommission,
            totalDuesCollected,
            totalRevenue: totalCommission + totalDuesCollected,
            perWorker,
            commissionRate: '20%',
        });
    }
    catch (error) {
        console.error('Get commissions error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getCommissions = getCommissions;
// ─── Worker Dues ───
const getWorkerDues = async (_req, res) => {
    try {
        // Workers with outstanding dues — include duesSince for overdue calculation
        const workersWithDues = await Worker_1.default.find({ dues: { $gt: 0 } })
            .select('fullName phone dues duesSince profileImage balance')
            .sort({ dues: -1 });
        const collectedByWorker = await Transaction_1.default.aggregate([
            { $match: { type: { $in: ['dues_deposit', 'dues_auto_deduct', 'dues_wallet_deduct'] }, status: 'completed' } },
            { $group: { _id: '$worker', totalCollected: { $sum: '$amount' } } },
        ]);
        const collectedMap = new Map(collectedByWorker
            .filter((row) => row?._id)
            .map((row) => [String(row._id), row.totalCollected || 0]));
        // Enrich with overdue status
        const enrichedDues = workersWithDues.map((w) => {
            const obj = w.toObject();
            const daysSinceDues = w.duesSince
                ? Math.floor((Date.now() - new Date(w.duesSince).getTime()) / (1000 * 60 * 60 * 24))
                : 0;
            return {
                ...obj,
                duesPending: obj.dues || 0,
                duesCollectedTotal: collectedMap.get(String(obj._id)) || 0,
                daysSinceDues,
                isOverdue: daysSinceDues >= 10,
                withdrawalDisabled: obj.dues > 0,
            };
        });
        // Paid dues history (Razorpay payments + auto-deductions)
        const workersPaidDues = await Transaction_1.default.find({
            type: { $in: ['dues_deposit', 'dues_auto_deduct', 'dues_wallet_deduct'] },
            status: 'completed',
        })
            .populate('worker', 'fullName phone profileImage')
            .sort({ createdAt: -1 })
            .limit(100);
        // Summary stats
        const totalOutstanding = workersWithDues.reduce((s, w) => s + (w.dues || 0), 0);
        const totalCollected = await Transaction_1.default.aggregate([
            { $match: { type: { $in: ['dues_deposit', 'dues_auto_deduct', 'dues_wallet_deduct'] }, status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]);
        const overdueCount = enrichedDues.filter((d) => d.isOverdue).length;
        res.json({
            workersWithDues: enrichedDues,
            workersPaidDues,
            totalOutstanding,
            totalCollected: totalCollected[0]?.total || 0,
            totalPayments: totalCollected[0]?.count || 0,
            overdueCount,
        });
    }
    catch (error) {
        console.error('Get worker dues error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getWorkerDues = getWorkerDues;
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
// ─── Notify Worker About Dues ───
const notifyWorkerDues = async (req, res) => {
    try {
        const worker = await Worker_1.default.findById(req.params.workerId);
        if (!worker || worker.dues <= 0) {
            res.status(404).json({ message: 'Worker not found or no dues pending' });
            return;
        }
        await (0, socket_1.sendNotification)({
            recipientId: worker._id.toString(),
            recipientModel: 'Worker',
            type: 'dues_reminder',
            title: 'Dues Payment Reminder',
            message: `You have ₹${worker.dues} in pending cash surcharge dues. Please pay at your earliest convenience.`,
            data: { dues: worker.dues },
        });
        res.json({ message: 'Dues notification sent to worker' });
    }
    catch (error) {
        console.error('Notify worker dues error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.notifyWorkerDues = notifyWorkerDues;
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
// ─── Cash Payments by Customers ───
const getCashPayments = async (_req, res) => {
    try {
        const cashBookings = await Booking_1.default.find({
            paymentMethod: 'cash',
            status: 'completed',
        })
            .populate('customer', 'fullName phone')
            .populate('assignedWorker', 'fullName phone dues')
            .sort({ updatedAt: -1 });
        res.json({ cashBookings });
    }
    catch (error) {
        console.error('Get cash payments error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getCashPayments = getCashPayments;
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
            .select('fullName phone profileImage accountStatus isActive categories rating totalWorkDone totalEarnings balance dues createdAt')
            .populate('categories', 'name')
            .sort({ createdAt: -1 });
        const stats = {
            total: await Worker_1.default.countDocuments(),
            live: await Worker_1.default.countDocuments({ accountStatus: 'live' }),
            pending: await Worker_1.default.countDocuments({ accountStatus: { $in: ['test', 'ekyc_pending', 'ekyc_done'] } }),
            rejected: await Worker_1.default.countDocuments({ accountStatus: 'rejected' }),
        };
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
        const bookingStats = {
            total: await Booking_1.default.countDocuments({ assignedWorker: worker._id }),
            completed: await Booking_1.default.countDocuments({ assignedWorker: worker._id, status: 'completed' }),
            cancelled: await Booking_1.default.countDocuments({ assignedWorker: worker._id, status: 'cancelled' }),
            inProgress: await Booking_1.default.countDocuments({ assignedWorker: worker._id, status: 'in_progress' }),
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
//# sourceMappingURL=admin.controller.js.map