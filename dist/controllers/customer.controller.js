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
exports.escalateHelpTicket = exports.appendHelpTicketMessage = exports.getHelpTicketDetail = exports.getHelpTickets = exports.createHelpTicket = exports.getChatbotQA = exports.deleteNotification = exports.markAllNotificationsRead = exports.markNotificationRead = exports.getNotifications = exports.submitReview = exports.submitRefundDetails = exports.cancelBooking = exports.getTransactions = exports.revealCompletionCode = exports.getBookingDetail = exports.getBookings = exports.getBanners = exports.getCategoryDetail = exports.getCategories = exports.confirmDeactivateAccount = exports.sendDeactivateAccountOtp = exports.deleteAccount = exports.updateProfile = exports.getProfile = void 0;
const crypto_1 = __importDefault(require("crypto"));
const User_1 = __importDefault(require("../models/User"));
const Booking_1 = __importDefault(require("../models/Booking"));
const Transaction_1 = __importDefault(require("../models/Transaction"));
const Category_1 = __importDefault(require("../models/Category"));
const Banner_1 = __importDefault(require("../models/Banner"));
const Notification_1 = __importDefault(require("../models/Notification"));
const HelpTicket_1 = __importDefault(require("../models/HelpTicket"));
const ChatbotQA_1 = __importDefault(require("../models/ChatbotQA"));
const RefreshToken_1 = __importDefault(require("../models/RefreshToken"));
const PasswordResetToken_1 = __importDefault(require("../models/PasswordResetToken"));
const OtpCode_1 = __importDefault(require("../models/OtpCode"));
const PushSubscription_1 = __importDefault(require("../models/PushSubscription"));
const ticketNumber_service_1 = require("../services/ticketNumber.service");
const cloudinary_service_1 = require("../services/cloudinary.service");
const email_service_1 = require("../services/email.service");
const bookingVoice_service_1 = require("../services/bookingVoice.service");
const socket_1 = require("../socket");
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const DEACTIVATION_OTP_TTL_MINUTES = 10;
const hashDeactivationOtp = (userId, otp) => crypto_1.default.createHash('sha256').update(`${userId}:${otp}`).digest('hex');
const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));
// ─── Get Profile ───
const getProfile = async (req, res) => {
    try {
        const user = await User_1.default.findById(req.user.id);
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        res.json({ user });
    }
    catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getProfile = getProfile;
// ─── Update Profile ───
const updateProfile = async (req, res) => {
    try {
        const { fullName, bio } = req.body;
        const updateData = {};
        if (fullName)
            updateData.fullName = fullName;
        if (bio !== undefined)
            updateData.bio = bio;
        if (req.file) {
            const uploaded = await (0, cloudinary_service_1.uploadBufferToCloudinary)(req.file.buffer, 'profiles');
            updateData.profileImage = uploaded.url;
        }
        const user = await User_1.default.findByIdAndUpdate(req.user.id, updateData, { new: true });
        res.json({ message: 'Profile updated', user });
    }
    catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.updateProfile = updateProfile;
// ─── Delete Customer Account (Self-Serve) ───
const deleteAccount = async (req, res) => {
    try {
        const user = await User_1.default.findById(req.user.id).select('phone isActive');
        if (!user || user.isActive === false) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        const activeBookingsCount = await Booking_1.default.countDocuments({
            customer: req.user.id,
            status: { $nin: ['completed', 'cancelled'] },
        });
        if (activeBookingsCount > 0) {
            res.status(400).json({
                message: 'You have active bookings. Complete or cancel them before deleting your account.',
            });
            return;
        }
        const oldPhone = user.phone;
        const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
        const anonymizedPhone = `9${stamp.slice(-9)}`;
        user.fullName = 'Deleted User';
        user.email = `deleted_${user._id}_${stamp}@deleted.fixo.local`;
        user.phone = anonymizedPhone;
        user.googleId = undefined;
        user.profileImage = '';
        user.bio = 'Account deleted by user';
        user.isActive = false;
        user.deletedAt = new Date();
        await user.save();
        await Promise.all([
            RefreshToken_1.default.deleteMany({ userId: user._id, role: 'customer' }),
            PasswordResetToken_1.default.deleteMany({ userId: user._id, role: 'customer' }),
            OtpCode_1.default.deleteMany({ phone: oldPhone, purpose: 'password-reset' }),
            PushSubscription_1.default.updateMany({ recipient: user._id, recipientModel: 'User' }, { $set: { isActive: false } }),
        ]);
        res.json({ message: 'Account deleted successfully' });
    }
    catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.deleteAccount = deleteAccount;
// ─── Send Deactivation OTP ───
const sendDeactivateAccountOtp = async (req, res) => {
    try {
        const user = await User_1.default.findById(req.user.id).select('fullName email isActive');
        if (!user || user.isActive === false) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        const activeBookingsCount = await Booking_1.default.countDocuments({
            customer: req.user.id,
            status: { $nin: ['completed', 'cancelled'] },
        });
        if (activeBookingsCount > 0) {
            res.status(400).json({
                message: 'You have active bookings. Complete or cancel them before deactivating your account.',
            });
            return;
        }
        const otp = generateOtp();
        const otpHash = hashDeactivationOtp(user._id.toString(), otp);
        const expiresAt = new Date(Date.now() + DEACTIVATION_OTP_TTL_MINUTES * 60 * 1000);
        await User_1.default.updateOne({ _id: user._id }, { $set: { deactivationOtpHash: otpHash, deactivationOtpExpiresAt: expiresAt } });
        const emailSent = await (0, email_service_1.sendAccountDeactivationOtpEmail)(user.email, otp, user.fullName);
        if (!emailSent) {
            res.status(500).json({ message: 'Unable to send OTP email. Please try again.' });
            return;
        }
        res.json({ message: 'OTP sent to your email address.' });
    }
    catch (error) {
        console.error('Send deactivation OTP error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.sendDeactivateAccountOtp = sendDeactivateAccountOtp;
// ─── Confirm Account Deactivation ───
const confirmDeactivateAccount = async (req, res) => {
    try {
        const rawOtp = typeof req.body?.otp === 'string' ? req.body.otp.trim() : '';
        if (!/^\d{6}$/.test(rawOtp)) {
            res.status(400).json({ message: 'Please enter a valid 6-digit OTP.' });
            return;
        }
        const user = await User_1.default.findById(req.user.id).select('+deactivationOtpHash +deactivationOtpExpiresAt phone isActive');
        if (!user || user.isActive === false) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        if (!user.deactivationOtpHash || !user.deactivationOtpExpiresAt || user.deactivationOtpExpiresAt < new Date()) {
            res.status(400).json({ message: 'OTP expired. Please request a new OTP.' });
            return;
        }
        const expectedHash = hashDeactivationOtp(user._id.toString(), rawOtp);
        if (expectedHash !== user.deactivationOtpHash) {
            res.status(400).json({ message: 'Invalid OTP. Please try again.' });
            return;
        }
        const activeBookingsCount = await Booking_1.default.countDocuments({
            customer: req.user.id,
            status: { $nin: ['completed', 'cancelled'] },
        });
        if (activeBookingsCount > 0) {
            res.status(400).json({
                message: 'You have active bookings. Complete or cancel them before deactivating your account.',
            });
            return;
        }
        const oldPhone = user.phone;
        const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
        const anonymizedPhone = `9${stamp.slice(-9)}`;
        user.fullName = 'Deactivated User';
        user.email = `deactivated_${user._id}_${stamp}@deleted.fixo.local`;
        user.phone = anonymizedPhone;
        user.googleId = undefined;
        user.profileImage = '';
        user.bio = 'Account deactivated by user';
        user.isActive = false;
        user.deletedAt = new Date();
        user.deactivationOtpHash = undefined;
        user.deactivationOtpExpiresAt = undefined;
        await user.save();
        await Promise.all([
            RefreshToken_1.default.deleteMany({ userId: user._id, role: 'customer' }),
            PasswordResetToken_1.default.deleteMany({ userId: user._id, role: 'customer' }),
            OtpCode_1.default.deleteMany({ phone: oldPhone, purpose: 'password-reset' }),
            PushSubscription_1.default.updateMany({ recipient: user._id, recipientModel: 'User' }, { $set: { isActive: false } }),
        ]);
        res.json({ message: 'Account deactivated successfully.' });
    }
    catch (error) {
        console.error('Confirm deactivate account error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.confirmDeactivateAccount = confirmDeactivateAccount;
// ─── Get Categories (Public) ───
const getCategories = async (_req, res) => {
    try {
        const categories = await Category_1.default.find({ isActive: true }).sort({ order: 1 });
        res.json({ categories });
    }
    catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getCategories = getCategories;
// ─── Get Category Detail ───
const getCategoryDetail = async (req, res) => {
    try {
        const idParam = req.params.id;
        const id = Array.isArray(idParam) ? idParam[0] : idParam;
        if (!id) {
            res.status(400).json({ message: 'Category id is required' });
            return;
        }
        const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
        const category = await Category_1.default.findOne({
            ...(isObjectId ? { _id: id } : { slug: id }),
            isActive: true,
        });
        if (!category) {
            res.status(404).json({ message: 'Category not found' });
            return;
        }
        res.json({ category });
    }
    catch (error) {
        console.error('Get category detail error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getCategoryDetail = getCategoryDetail;
// ─── Get Banners (Public) ───
const getBanners = async (_req, res) => {
    try {
        const now = new Date();
        const banners = await Banner_1.default.find({
            isActive: true,
            $and: [
                {
                    $or: [
                        { 'schedule.startAt': null },
                        { 'schedule.startAt': { $exists: false } },
                        { 'schedule.startAt': { $lte: now } },
                    ],
                },
                {
                    $or: [
                        { 'schedule.endAt': null },
                        { 'schedule.endAt': { $exists: false } },
                        { 'schedule.endAt': { $gte: now } },
                    ],
                },
            ],
        }).sort({ order: 1 });
        res.json({ banners });
    }
    catch (error) {
        console.error('Get banners error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getBanners = getBanners;
// ─── Get Customer Bookings ───
const getBookings = async (req, res) => {
    try {
        const { status } = req.query;
        const query = { customer: req.user.id };
        if (status === 'active') {
            query.status = { $nin: ['completed', 'cancelled'] };
        }
        else if (status === 'completed') {
            query.status = 'completed';
        }
        else if (status === 'cancelled') {
            query.status = 'cancelled';
        }
        const bookings = await Booking_1.default.find(query)
            .populate('category', 'name slug image')
            .populate('assignedWorker', 'fullName phone profileImage rating')
            .sort({ createdAt: -1 });
        res.json({ bookings });
    }
    catch (error) {
        console.error('Get bookings error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getBookings = getBookings;
// ─── Get Booking Detail ───
const getBookingDetail = async (req, res) => {
    try {
        const booking = await Booking_1.default.findOne({ _id: req.params.id, customer: req.user.id })
            .populate('category', 'name slug image')
            .populate('assignedWorker', 'fullName phone regularPhone profileImage rating bio location totalWorkDone categories')
            .populate('acceptedBid', 'priceOffered');
        if (!booking) {
            res.status(404).json({ message: 'Booking not found' });
            return;
        }
        res.json({ booking });
    }
    catch (error) {
        console.error('Get booking detail error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getBookingDetail = getBookingDetail;
// ─── Reveal Completion Code (customer confirms work is done) ───
const revealCompletionCode = async (req, res) => {
    try {
        const booking = await Booking_1.default.findOne({
            _id: req.params.id,
            customer: req.user.id,
            status: { $in: ['payment_done', 'in_progress'] },
        });
        if (!booking) {
            res.status(404).json({ message: 'Booking not found' });
            return;
        }
        if (!booking.completionPin) {
            res.status(400).json({ message: 'Completion code is not available yet' });
            return;
        }
        if (!booking.completionRequestedByWorkerAt) {
            res.status(400).json({ message: 'Worker has not requested completion code yet' });
            return;
        }
        if (!booking.completionCodeRevealedAt) {
            booking.completionCodeRevealedAt = new Date();
            await booking.save();
        }
        const payload = {
            bookingId: booking._id,
            status: booking.status,
            completionCodeRevealed: true,
            message: 'Customer revealed completion code.',
        };
        if (booking.assignedWorker) {
            (0, socket_1.notifyUser)(booking.assignedWorker.toString(), 'booking_status_updated', payload);
            await (0, socket_1.sendNotification)({
                recipientId: booking.assignedWorker.toString(),
                recipientModel: 'Worker',
                type: 'completion_code_revealed',
                title: 'Completion Code Revealed',
                message: 'Customer has revealed the completion code. Proceed only after confirming work is fully done.',
                data: { bookingId: booking._id },
            });
        }
        (0, socket_1.notifyUser)(req.user.id, 'booking_status_updated', payload);
        res.json({
            message: 'Completion code revealed. Share it only after confirming work is fully completed.',
            booking,
        });
    }
    catch (error) {
        console.error('Reveal completion code error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.revealCompletionCode = revealCompletionCode;
// ─── Get Transactions ───
const getTransactions = async (req, res) => {
    try {
        const transactions = await Transaction_1.default.find({ user: req.user.id, type: { $nin: ['worker_earning', 'commission'] } })
            .populate({ path: 'booking', select: 'workDescription status amount cashSurcharge paymentMethod category', populate: { path: 'category', select: 'name' } })
            .populate('worker', 'fullName')
            .sort({ createdAt: -1 });
        // Hide invalid legacy records where cancelled cash bookings were marked as paid.
        const sanitizedTransactions = transactions.filter((txn) => {
            if (txn.type !== 'booking_payment' || txn.status !== 'completed') {
                return true;
            }
            const bookingDoc = txn.booking;
            const isInvalidCancelledCashPayment = bookingDoc?.status === 'cancelled' && bookingDoc?.paymentMethod === 'cash';
            return !isInvalidCancelledCashPayment;
        });
        res.json({ transactions: sanitizedTransactions });
    }
    catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getTransactions = getTransactions;
// ─── Cancel Booking ───
const cancelBooking = async (req, res) => {
    try {
        const { reason } = req.body;
        const booking = await Booking_1.default.findOne({ _id: req.params.id, customer: req.user.id });
        if (!booking) {
            res.status(404).json({ message: 'Booking not found' });
            return;
        }
        if (['completed', 'cancelled', 'in_progress'].includes(booking.status)) {
            res.status(400).json({ message: 'Cannot cancel this booking' });
            return;
        }
        booking.status = 'cancelled';
        booking.cancellation = {
            cancelledBy: 'customer',
            reason: reason || 'Customer cancelled',
            cancelledAt: new Date(),
        };
        const isOnlinePaid = booking.paymentStatus === 'paid' && booking.paymentMethod === 'online';
        // Only successful online payments enter refund flow.
        if (isOnlinePaid) {
            booking.paymentStatus = 'refund_pending';
        }
        else if (booking.paymentStatus === 'paid') {
            // Legacy safety: cancelled non-online bookings should not stay marked as paid.
            booking.paymentStatus = 'pending';
            booking.refundDetails = undefined;
        }
        await booking.save();
        void (0, bookingVoice_service_1.removeBookingVoiceNote)(booking);
        if (isOnlinePaid) {
            (0, socket_1.sendAdminNotification)({
                type: 'refund_pending',
                title: 'New Refund Request',
                message: `Refund review needed for booking #${booking._id.toString().slice(-6).toUpperCase()}.`,
                data: { bookingId: booking._id },
            });
        }
        if (!isOnlinePaid) {
            // Legacy safety: invalidate wrong booking payment entries for cancelled unpaid bookings.
            await Transaction_1.default.updateMany({
                booking: booking._id,
                user: booking.customer,
                type: 'booking_payment',
                status: 'completed',
            }, { $set: { status: 'failed' } });
        }
        // Notify assigned worker if any
        if (booking.assignedWorker) {
            (0, socket_1.notifyUser)(booking.assignedWorker.toString(), 'booking_status_updated', {
                bookingId: booking._id,
                status: 'cancelled',
                reason: booking.cancellation.reason,
                cancelledBy: 'customer',
                paymentStatus: booking.paymentStatus,
            });
            await (0, socket_1.sendNotification)({
                recipientId: booking.assignedWorker.toString(),
                recipientModel: 'Worker',
                type: 'booking_cancelled',
                title: 'Booking Cancelled',
                message: `A booking has been cancelled by the customer. Reason: ${booking.cancellation.reason}`,
                data: { bookingId: booking._id },
            });
        }
        (0, socket_1.notifyUser)(req.user.id, 'booking_status_updated', {
            bookingId: booking._id,
            status: 'cancelled',
            reason: booking.cancellation.reason,
            cancelledBy: 'customer',
            paymentStatus: booking.paymentStatus,
        });
        res.json({ message: 'Booking cancelled', booking });
    }
    catch (error) {
        console.error('Cancel booking error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.cancelBooking = cancelBooking;
// ─── Submit Refund Details ───
const submitRefundDetails = async (req, res) => {
    try {
        const { upiId, bankAccountNumber, ifscCode, bankName, holderName } = req.body;
        const booking = await Booking_1.default.findOne({
            _id: req.params.id,
            customer: req.user.id,
            paymentStatus: 'refund_pending',
        });
        if (!booking) {
            res.status(404).json({ message: 'No booking with pending refund found' });
            return;
        }
        booking.refundDetails = {
            upiId,
            bankAccountNumber,
            ifscCode,
            bankName,
            holderName,
            status: 'pending',
        };
        await booking.save();
        (0, socket_1.sendAdminNotification)({
            type: 'refund_details_submitted',
            title: 'Refund Details Submitted',
            message: `Customer submitted refund details for booking #${booking._id.toString().slice(-6).toUpperCase()}.`,
            data: { bookingId: booking._id },
        });
        res.json({ message: 'Refund details submitted. Refund will be processed within 3-10 business days.' });
    }
    catch (error) {
        console.error('Submit refund details error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.submitRefundDetails = submitRefundDetails;
// ─── Submit Review ───
const submitReview = async (req, res) => {
    try {
        const { rating, feedback } = req.body;
        const booking = await Booking_1.default.findOne({
            _id: req.params.id,
            customer: req.user.id,
            status: 'completed',
        });
        if (!booking) {
            res.status(404).json({ message: 'Completed booking not found' });
            return;
        }
        if (booking.review?.rating) {
            res.status(400).json({ message: 'Already reviewed' });
            return;
        }
        booking.review = { rating, feedback, createdAt: new Date() };
        await booking.save();
        // Update worker rating
        if (booking.assignedWorker) {
            const Worker = (await Promise.resolve().then(() => __importStar(require('../models/Worker')))).default;
            const worker = await Worker.findById(booking.assignedWorker);
            if (worker) {
                const newCount = worker.rating.count + 1;
                const newAvg = ((worker.rating.average * worker.rating.count) + rating) / newCount;
                worker.rating = { average: Math.round(newAvg * 10) / 10, count: newCount };
                await worker.save();
            }
        }
        res.json({ message: 'Review submitted', review: booking.review });
    }
    catch (error) {
        console.error('Submit review error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.submitReview = submitReview;
// ─── Get Customer Notifications ───
const getNotifications = async (req, res) => {
    try {
        const notifications = await Notification_1.default.find({ recipient: req.user.id, recipientModel: 'User' })
            .sort({ createdAt: -1 })
            .limit(50);
        res.json({ notifications });
    }
    catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getNotifications = getNotifications;
// ─── Mark Notification Read ───
const markNotificationRead = async (req, res) => {
    try {
        await Notification_1.default.findOneAndUpdate({ _id: req.params.id, recipient: req.user.id }, { isRead: true });
        res.json({ message: 'Marked as read' });
    }
    catch (error) {
        console.error('Mark notification read error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.markNotificationRead = markNotificationRead;
// ─── Mark All Notifications Read ───
const markAllNotificationsRead = async (req, res) => {
    try {
        await Notification_1.default.updateMany({ recipient: req.user.id, recipientModel: 'User', isRead: false }, { isRead: true });
        res.json({ message: 'All marked as read' });
    }
    catch (error) {
        console.error('Mark all read error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.markAllNotificationsRead = markAllNotificationsRead;
// ─── Delete Notification ───
const deleteNotification = async (req, res) => {
    try {
        await Notification_1.default.findOneAndDelete({ _id: req.params.id, recipient: req.user.id });
        res.json({ message: 'Deleted' });
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
exports.deleteNotification = deleteNotification;
// ─── Get Chatbot QA (Public) ───
const getChatbotQA = async (req, res) => {
    try {
        const { category } = req.query;
        const query = {
            isActive: true,
            $or: [
                { targetAudience: { $in: ['all', 'customer'] } },
                { targetAudience: { $exists: false } },
            ],
        };
        if (category)
            query.category = category;
        const qas = await ChatbotQA_1.default.find(query).sort({ category: 1, order: 1 });
        // Get unique categories
        const categories = await ChatbotQA_1.default.distinct('category', {
            isActive: true,
            $or: [
                { targetAudience: { $in: ['all', 'customer'] } },
                { targetAudience: { $exists: false } },
            ],
        });
        res.json({ qas, categories });
    }
    catch (error) {
        console.error('Get chatbot QA error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getChatbotQA = getChatbotQA;
// ─── Create Help Ticket ───
const createHelpTicket = async (req, res) => {
    try {
        const { category, message, phoneNumber } = req.body;
        if (!category || !message) {
            res.status(400).json({ message: 'Category and message are required' });
            return;
        }
        const ticketNumber = await (0, ticketNumber_service_1.generateTicketNumber)();
        const ticket = await HelpTicket_1.default.create({
            ticketNumber,
            user: req.user.id,
            userModel: 'User',
            category,
            chatHistory: [
                { sender: 'user', message, timestamp: new Date() },
                {
                    sender: 'bot',
                    message: `Your ticket ${ticketNumber} has been created. Share this number for faster support. Our team typically responds within 2-6 hours.`,
                    timestamp: new Date(),
                },
            ],
            phoneNumber,
            status: 'open',
        });
        const ticketForAdmin = await HelpTicket_1.default.findById(ticket._id)
            .populate('user', 'fullName phone email');
        (0, socket_1.notifyUser)(req.user.id, 'help_ticket_updated', {
            action: 'created',
            ticket,
        });
        if (ticketForAdmin) {
            (0, socket_1.notifyRole)('admin', 'help_ticket_updated', {
                action: 'created',
                ticket: ticketForAdmin,
            });
        }
        // Persist notification for admins
        (0, socket_1.sendAdminNotification)({
            type: 'new_help_ticket',
            title: 'New Support Ticket',
            message: `Customer created ticket #${ticketNumber}: ${category}`,
            data: { ticketId: ticket._id },
        }).catch(() => { });
        res.status(201).json({ message: 'Ticket created', ticket });
    }
    catch (error) {
        console.error('Create help ticket error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.createHelpTicket = createHelpTicket;
// ─── Get My Help Tickets ───
const getHelpTickets = async (req, res) => {
    try {
        const { q, status } = req.query;
        const query = { user: req.user.id, userModel: 'User' };
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
        const tickets = await HelpTicket_1.default.find(query)
            .sort({ updatedAt: -1 });
        const baseSummaryQuery = { user: req.user.id, userModel: 'User' };
        const [totalTickets, openTickets, escalatedTickets, resolvedTickets] = await Promise.all([
            HelpTicket_1.default.countDocuments(baseSummaryQuery),
            HelpTicket_1.default.countDocuments({ ...baseSummaryQuery, status: 'open' }),
            HelpTicket_1.default.countDocuments({ ...baseSummaryQuery, status: 'escalated' }),
            HelpTicket_1.default.countDocuments({ ...baseSummaryQuery, status: 'resolved' }),
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
    }
    catch (error) {
        console.error('Get help tickets error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getHelpTickets = getHelpTickets;
// ─── Get Help Ticket Detail ───
const getHelpTicketDetail = async (req, res) => {
    try {
        const ticket = await HelpTicket_1.default.findOne({ _id: req.params.id, user: req.user.id });
        if (!ticket) {
            res.status(404).json({ message: 'Ticket not found' });
            return;
        }
        res.json({ ticket });
    }
    catch (error) {
        console.error('Get ticket detail error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getHelpTicketDetail = getHelpTicketDetail;
// ─── Append Message to Help Ticket ───
const appendHelpTicketMessage = async (req, res) => {
    try {
        const { message } = req.body;
        const ticket = await HelpTicket_1.default.findOne({ _id: req.params.id, user: req.user.id });
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
        const ticketForAdmin = await HelpTicket_1.default.findById(ticket._id)
            .populate('user', 'fullName phone email');
        (0, socket_1.notifyUser)(req.user.id, 'help_ticket_updated', {
            action: 'message',
            ticket,
        });
        if (ticketForAdmin) {
            (0, socket_1.notifyRole)('admin', 'help_ticket_updated', {
                action: 'message',
                ticket: ticketForAdmin,
            });
        }
        res.json({ message: 'Message sent', ticket });
    }
    catch (error) {
        console.error('Append help ticket message error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.appendHelpTicketMessage = appendHelpTicketMessage;
// ─── Escalate Help Ticket ───
const escalateHelpTicket = async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        const ticket = await HelpTicket_1.default.findOne({ _id: req.params.id, user: req.user.id });
        if (!ticket) {
            res.status(404).json({ message: 'Ticket not found' });
            return;
        }
        ticket.status = 'escalated';
        if (phoneNumber)
            ticket.phoneNumber = phoneNumber;
        ticket.chatHistory.push({
            sender: 'bot',
            message: 'Your issue has been escalated. Our team will contact you within 24 hours.',
            timestamp: new Date(),
        });
        await ticket.save();
        const ticketForAdmin = await HelpTicket_1.default.findById(ticket._id)
            .populate('user', 'fullName phone email');
        (0, socket_1.notifyUser)(req.user.id, 'help_ticket_updated', {
            action: 'escalated',
            ticket,
        });
        if (ticketForAdmin) {
            (0, socket_1.notifyRole)('admin', 'help_ticket_updated', {
                action: 'escalated',
                ticket: ticketForAdmin,
            });
        }
        res.json({ message: 'Ticket escalated', ticket });
    }
    catch (error) {
        console.error('Escalate help ticket error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.escalateHelpTicket = escalateHelpTicket;
//# sourceMappingURL=customer.controller.js.map