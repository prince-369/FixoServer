"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelStaleBookings = void 0;
const Booking_1 = __importDefault(require("../models/Booking"));
const socket_1 = require("../socket");
const env_1 = __importDefault(require("../config/env"));
/**
 * Auto-cancel stale bookings that are still in 'finding_workers' status
 * after 3 minutes. This cleans up abandoned requests where the customer
 * left or went offline without any worker bidding.
 *
 * Runs every 60 seconds via setInterval in server.ts
 */
const cancelStaleBookings = async () => {
    try {
        const threshold = new Date(Date.now() - env_1.default.JOB_STALE_BOOKING_MINUTES * 60 * 1000);
        let cancelledCount = 0;
        while (cancelledCount < 500) {
            const updatedBooking = await Booking_1.default.findOneAndUpdate({
                status: 'finding_workers',
                createdAt: { $lt: threshold },
            }, {
                $set: {
                    status: 'cancelled',
                    cancellation: {
                        cancelledBy: 'admin',
                        reason: `Auto-cancelled: no bids received within ${env_1.default.JOB_STALE_BOOKING_MINUTES} minutes`,
                        cancelledAt: new Date(),
                    },
                },
            }, {
                new: true,
                sort: { createdAt: 1 },
                projection: { _id: 1, customer: 1 },
            });
            if (!updatedBooking) {
                break;
            }
            cancelledCount += 1;
            (0, socket_1.notifyUser)(updatedBooking.customer.toString(), 'booking_status_updated', {
                bookingId: updatedBooking._id,
                status: 'cancelled',
            });
        }
        if (cancelledCount > 0) {
            console.log(`Auto-cancelled ${cancelledCount} stale booking(s)`);
        }
        return cancelledCount;
    }
    catch (error) {
        console.error('Stale booking cleanup error:', error);
        return 0;
    }
};
exports.cancelStaleBookings = cancelStaleBookings;
//# sourceMappingURL=bookingCleanup.js.map