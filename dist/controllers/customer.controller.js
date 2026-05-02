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
exports.escalateHelpTicket = exports.appendHelpTicketMessage = exports.getHelpTicketDetail = exports.getHelpTickets = exports.createHelpTicket = exports.getChatbotQA = exports.deleteNotification = exports.markAllNotificationsRead = exports.markNotificationRead = exports.getNotifications = exports.submitReview = exports.submitRefundDetails = exports.cancelBooking = exports.getTransactions = exports.getBookingDetail = exports.getBookings = exports.getBanners = exports.getCategoryDetail = exports.getCategories = exports.updateProfile = exports.getProfile = void 0;
const User_1 = __importDefault(require("../models/User"));
const Booking_1 = __importDefault(require("../models/Booking"));
const Transaction_1 = __importDefault(require("../models/Transaction"));
const Category_1 = __importDefault(require("../models/Category"));
const Banner_1 = __importDefault(require("../models/Banner"));
const Notification_1 = __importDefault(require("../models/Notification"));
const HelpTicket_1 = __importDefault(require("../models/HelpTicket"));
const ChatbotQA_1 = __importDefault(require("../models/ChatbotQA"));
const ticketNumber_service_1 = require("../services/ticketNumber.service");
const cloudinary_service_1 = require("../services/cloudinary.service");
const socket_1 = require("../socket");
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
// ─── Get Transactions ───
const getTransactions = async (req, res) => {
    try {
        const transactions = await Transaction_1.default.find({ user: req.user.id, type: { $nin: ['worker_earning', 'commission'] } })
            .populate({ path: 'booking', select: 'workDescription status amount cashSurcharge paymentMethod category', populate: { path: 'category', select: 'name' } })
            .populate('worker', 'fullName')
            .sort({ createdAt: -1 });
        res.json({ transactions });
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
        // If online payment was made, set refund pending
        if (booking.paymentStatus === 'paid' && booking.paymentMethod === 'online') {
            booking.paymentStatus = 'refund_pending';
        }
        await booking.save();
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
        res.json({ message: 'Refund details submitted. Refund will be processed within 24 hours.' });
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