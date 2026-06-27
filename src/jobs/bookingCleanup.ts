import Booking from '../models/Booking';
import { notifyUser, sendNotification } from '../socket';
import env from '../config/env';
import { deleteFromCloudinary } from '../services/cloudinary.service';

/**
 * Auto-cancel stale bookings that are still in 'finding_workers' status
 * after the configured stale window. This cleans up abandoned requests
 * where the customer left or went offline without any worker bidding.
 *
 * Runs every 60 seconds via setInterval in server.ts
 */
export const cancelStaleBookings = async (): Promise<number> => {
  try {
    const threshold = new Date(Date.now() - env.JOB_STALE_BOOKING_MINUTES * 60 * 1000);
    let cancelledCount = 0;

    while (cancelledCount < 500) {
      const updatedBooking = await Booking.findOneAndUpdate(
        {
          status: 'finding_workers',
          createdAt: { $lt: threshold },
        },
        {
          $set: {
            status: 'cancelled',
            cancellation: {
              cancelledBy: 'admin',
              reason: `Auto-cancelled: no bids received within ${env.JOB_STALE_BOOKING_MINUTES} minutes`,
              cancelledAt: new Date(),
            },
          },
        },
        {
          returnDocument: 'after',
          sort: { createdAt: 1 },
          projection: { _id: 1, customer: 1 },
        }
      );

      if (!updatedBooking) {
        break;
      }

      cancelledCount += 1;

      notifyUser(updatedBooking.customer.toString(), 'booking_status_updated', {
        bookingId: updatedBooking._id,
        status: 'cancelled',
      });
    }

    if (cancelledCount > 0) {
      console.log(`Auto-cancelled ${cancelledCount} stale booking(s)`);
    }

    return cancelledCount;
  } catch (error) {
    console.error('Stale booking cleanup error:', error);
    return 0;
  }
};

/**
 * When a scheduled booking's chosen time arrives, notify both sides:
 *  - the customer that their booking time is here, and
 *  - the assigned worker that they can now head out ("Approve & Go" unlocks).
 *
 * Runs every cleanup tick. Each booking is notified exactly once (scheduleNotified).
 */
export const notifyDueScheduledBookings = async (): Promise<number> => {
  try {
    let notifiedCount = 0;

    while (notifiedCount < 300) {
      const booking = await Booking.findOneAndUpdate(
        {
          scheduledAt: { $ne: null, $lte: new Date() },
          scheduleNotified: { $ne: true },
          status: { $in: ['finding_workers', 'bids_received', 'worker_accepted', 'worker_approved', 'payment_done'] },
        },
        { $set: { scheduleNotified: true } },
        { returnDocument: 'after', sort: { scheduledAt: 1 }, projection: { _id: 1, customer: 1, assignedWorker: 1, status: 1, scheduledAt: 1 } }
      );

      if (!booking) break;
      notifiedCount += 1;

      const bookingId = booking._id;
      const customerId = booking.customer.toString();

      // Realtime ping → both sides refresh and the worker's Approve & Go enables.
      notifyUser(customerId, 'booking:schedule-reached', { bookingId, scheduledAt: booking.scheduledAt });
      void sendNotification({
        recipientId: customerId,
        recipientModel: 'User',
        type: 'booking_schedule_reached',
        title: 'Scheduled time is here',
        message: 'Your booking time has arrived. The worker can now start the job.',
        data: { bookingId },
      });

      if (booking.assignedWorker) {
        const workerId = booking.assignedWorker.toString();
        notifyUser(workerId, 'booking:schedule-reached', { bookingId, scheduledAt: booking.scheduledAt });
        void sendNotification({
          recipientId: workerId,
          recipientModel: 'Worker',
          type: 'booking_schedule_reached',
          title: 'You can start now',
          message: 'The scheduled time has arrived. You can head out for this job now.',
          data: { bookingId },
        });
      }
    }

    if (notifiedCount > 0) {
      console.log(`Notified ${notifiedCount} scheduled booking(s) whose time arrived`);
    }

    return notifiedCount;
  } catch (error) {
    console.error('Scheduled booking notify error:', error);
    return 0;
  }
};

/**
 * Deletes booking voice-note media for bookings that are already completed/cancelled.
 * This ensures media storage does not grow indefinitely.
 */
export const cleanupClosedBookingVoiceNotes = async (): Promise<number> => {
  try {
    let cleanedCount = 0;

    while (cleanedCount < 200) {
      const booking = await Booking.findOne({
        status: { $in: ['completed', 'cancelled'] },
        'voiceNote.publicId': { $exists: true, $ne: '' },
      }).select('_id voiceNote.publicId');

      if (!booking || !booking.voiceNote?.publicId) {
        break;
      }

      try {
        await deleteFromCloudinary(booking.voiceNote.publicId, 'video');
      } catch (error) {
        console.error('Failed to delete closed-booking voice note from Cloudinary:', error);
      }

      await Booking.updateOne({ _id: booking._id }, { $unset: { voiceNote: 1 } });
      cleanedCount += 1;
    }

    if (cleanedCount > 0) {
      console.log(`Cleaned ${cleanedCount} closed-booking voice note(s)`);
    }

    return cleanedCount;
  } catch (error) {
    console.error('Closed booking voice note cleanup error:', error);
    return 0;
  }
};
