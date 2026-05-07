import { Request, Response } from 'express';
import User from '../models/User';
import Booking from '../models/Booking';
import Transaction from '../models/Transaction';
import Category from '../models/Category';
import Banner from '../models/Banner';
import Notification from '../models/Notification';
import HelpTicket from '../models/HelpTicket';
import ChatbotQA from '../models/ChatbotQA';
import RefreshToken from '../models/RefreshToken';
import PasswordResetToken from '../models/PasswordResetToken';
import OtpCode from '../models/OtpCode';
import PushSubscription from '../models/PushSubscription';
import { generateTicketNumber } from '../services/ticketNumber.service';
import { uploadBufferToCloudinary } from '../services/cloudinary.service';
import { notifyRole, notifyUser, sendNotification, sendAdminNotification } from '../socket';

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ─── Get Profile ───
export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!.id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Update Profile ───
export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fullName, bio } = req.body;
    const updateData: Record<string, unknown> = {};

    if (fullName) updateData.fullName = fullName;
    if (bio !== undefined) updateData.bio = bio;

    if (req.file) {
      const uploaded = await uploadBufferToCloudinary(req.file.buffer, 'profiles');
      updateData.profileImage = uploaded.url;
    }

    const user = await User.findByIdAndUpdate(req.user!.id, updateData, { new: true });
    res.json({ message: 'Profile updated', user });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Delete Customer Account (Self-Serve) ───
export const deleteAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!.id).select('phone isActive');
    if (!user || user.isActive === false) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const activeBookingsCount = await Booking.countDocuments({
      customer: req.user!.id,
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
      RefreshToken.deleteMany({ userId: user._id, role: 'customer' }),
      PasswordResetToken.deleteMany({ userId: user._id, role: 'customer' }),
      OtpCode.deleteMany({ phone: oldPhone, purpose: 'password-reset' }),
      PushSubscription.updateMany(
        { recipient: user._id, recipientModel: 'User' },
        { $set: { isActive: false } }
      ),
    ]);

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Get Categories (Public) ───
export const getCategories = async (_req: Request, res: Response): Promise<void> => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ order: 1 });
    res.json({ categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Get Category Detail ───
export const getCategoryDetail = async (req: Request, res: Response): Promise<void> => {
  try {
    const idParam = req.params.id;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;
    if (!id) {
      res.status(400).json({ message: 'Category id is required' });
      return;
    }
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    const category = await Category.findOne({
      ...(isObjectId ? { _id: id } : { slug: id }),
      isActive: true,
    });
    if (!category) {
      res.status(404).json({ message: 'Category not found' });
      return;
    }
    res.json({ category });
  } catch (error) {
    console.error('Get category detail error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Get Banners (Public) ───
export const getBanners = async (_req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const banners = await Banner.find({
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
  } catch (error) {
    console.error('Get banners error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Get Customer Bookings ───
export const getBookings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.query;
    const query: Record<string, unknown> = { customer: req.user!.id };

    if (status === 'active') {
      query.status = { $nin: ['completed', 'cancelled'] };
    } else if (status === 'completed') {
      query.status = 'completed';
    } else if (status === 'cancelled') {
      query.status = 'cancelled';
    }

    const bookings = await Booking.find(query)
      .populate('category', 'name slug image')
      .populate('assignedWorker', 'fullName phone profileImage rating')
      .sort({ createdAt: -1 });

    res.json({ bookings });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Get Booking Detail ───
export const getBookingDetail = async (req: Request, res: Response): Promise<void> => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, customer: req.user!.id })
      .populate('category', 'name slug image')
      .populate('assignedWorker', 'fullName phone regularPhone profileImage rating bio location totalWorkDone categories')
      .populate('acceptedBid', 'priceOffered');

    if (!booking) {
      res.status(404).json({ message: 'Booking not found' });
      return;
    }

    res.json({ booking });
  } catch (error) {
    console.error('Get booking detail error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Reveal Completion Code (customer confirms work is done) ───
export const revealCompletionCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      customer: req.user!.id,
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
      notifyUser(booking.assignedWorker.toString(), 'booking_status_updated', payload);

      await sendNotification({
        recipientId: booking.assignedWorker.toString(),
        recipientModel: 'Worker',
        type: 'completion_code_revealed',
        title: 'Completion Code Revealed',
        message: 'Customer has revealed the completion code. Proceed only after confirming work is fully done.',
        data: { bookingId: booking._id },
      });
    }

    notifyUser(req.user!.id, 'booking_status_updated', payload);

    res.json({
      message: 'Completion code revealed. Share it only after confirming work is fully completed.',
      booking,
    });
  } catch (error) {
    console.error('Reveal completion code error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Get Transactions ───
export const getTransactions = async (req: Request, res: Response): Promise<void> => {
  try {
    const transactions = await Transaction.find({ user: req.user!.id, type: { $nin: ['worker_earning', 'commission'] } })
      .populate({ path: 'booking', select: 'workDescription status amount cashSurcharge paymentMethod category', populate: { path: 'category', select: 'name' } })
      .populate('worker', 'fullName')
      .sort({ createdAt: -1 });

    // Hide invalid legacy records where cancelled cash bookings were marked as paid.
    const sanitizedTransactions = transactions.filter((txn) => {
      if (txn.type !== 'booking_payment' || txn.status !== 'completed') {
        return true;
      }

      const bookingDoc = txn.booking as { status?: string; paymentMethod?: string } | null;
      const isInvalidCancelledCashPayment = bookingDoc?.status === 'cancelled' && bookingDoc?.paymentMethod === 'cash';

      return !isInvalidCancelledCashPayment;
    });

    res.json({ transactions: sanitizedTransactions });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Cancel Booking ───
export const cancelBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const { reason } = req.body;
    const booking = await Booking.findOne({ _id: req.params.id, customer: req.user!.id });

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
    } else if (booking.paymentStatus === 'paid') {
      // Legacy safety: cancelled non-online bookings should not stay marked as paid.
      booking.paymentStatus = 'pending';
      booking.refundDetails = undefined;
    }

    await booking.save();

    if (!isOnlinePaid) {
      // Legacy safety: invalidate wrong booking payment entries for cancelled unpaid bookings.
      await Transaction.updateMany(
        {
          booking: booking._id,
          user: booking.customer,
          type: 'booking_payment',
          status: 'completed',
        },
        { $set: { status: 'failed' } }
      );
    }

    // Notify assigned worker if any
    if (booking.assignedWorker) {
      notifyUser(booking.assignedWorker.toString(), 'booking_status_updated', {
        bookingId: booking._id,
        status: 'cancelled',
        reason: booking.cancellation.reason,
        cancelledBy: 'customer',
        paymentStatus: booking.paymentStatus,
      });
      await sendNotification({
        recipientId: booking.assignedWorker.toString(),
        recipientModel: 'Worker',
        type: 'booking_cancelled',
        title: 'Booking Cancelled',
        message: `A booking has been cancelled by the customer. Reason: ${booking.cancellation.reason}`,
        data: { bookingId: booking._id },
      });
    }

    notifyUser(req.user!.id, 'booking_status_updated', {
      bookingId: booking._id,
      status: 'cancelled',
      reason: booking.cancellation.reason,
      cancelledBy: 'customer',
      paymentStatus: booking.paymentStatus,
    });
    res.json({ message: 'Booking cancelled', booking });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Submit Refund Details ───
export const submitRefundDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { upiId, bankAccountNumber, ifscCode, bankName, holderName } = req.body;
    const booking = await Booking.findOne({
      _id: req.params.id,
      customer: req.user!.id,
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

    res.json({ message: 'Refund details submitted. Refund will be processed within 3-10 business days.' });
  } catch (error) {
    console.error('Submit refund details error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Submit Review ───
export const submitReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const { rating, feedback } = req.body;
    const booking = await Booking.findOne({
      _id: req.params.id,
      customer: req.user!.id,
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
      const Worker = (await import('../models/Worker')).default;
      const worker = await Worker.findById(booking.assignedWorker);
      if (worker) {
        const newCount = worker.rating.count + 1;
        const newAvg = ((worker.rating.average * worker.rating.count) + rating) / newCount;
        worker.rating = { average: Math.round(newAvg * 10) / 10, count: newCount };
        await worker.save();
      }
    }

    res.json({ message: 'Review submitted', review: booking.review });
  } catch (error) {
    console.error('Submit review error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Get Customer Notifications ───
export const getNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const notifications = await Notification.find({ recipient: req.user!.id, recipientModel: 'User' })
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
      { recipient: req.user!.id, recipientModel: 'User', isRead: false },
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

// ─── Get Chatbot QA (Public) ───
export const getChatbotQA = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category } = req.query;
    const query: Record<string, unknown> = {
      isActive: true,
      $or: [
        { targetAudience: { $in: ['all', 'customer'] } },
        { targetAudience: { $exists: false } },
      ],
    };
    if (category) query.category = category;

    const qas = await ChatbotQA.find(query).sort({ category: 1, order: 1 });

    // Get unique categories
    const categories = await ChatbotQA.distinct('category', {
      isActive: true,
      $or: [
        { targetAudience: { $in: ['all', 'customer'] } },
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
      message: `Customer created ticket #${ticketNumber}: ${category}`,
      data: { ticketId: ticket._id },
    }).catch(() => {});

    res.status(201).json({ message: 'Ticket created', ticket });
  } catch (error) {
    console.error('Create help ticket error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Get My Help Tickets ───
export const getHelpTickets = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q, status } = req.query;
    const query: Record<string, unknown> = { user: req.user!.id, userModel: 'User' };

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

    const baseSummaryQuery = { user: req.user!.id, userModel: 'User' };
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
