import Booking from '../models/Booking';
import { notifyUser } from '../socket';
import env from '../config/env';

/**
 * Auto-cancel stale bookings that are still in 'finding_workers' status
 * after 3 minutes. This cleans up abandoned requests where the customer
 * left or went offline without any worker bidding.
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
          new: true,
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
