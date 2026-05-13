"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupClosedBookingVoiceNotes = exports.cancelStaleBookings = void 0;
const Booking_1 = __importDefault(require("../models/Booking"));
const socket_1 = require("../socket");
const env_1 = __importDefault(require("../config/env"));
const cloudinary_service_1 = require("../services/cloudinary.service");
/**
 * Auto-cancel stale bookings that are still in 'finding_workers' status
 * after the configured stale window. This cleans up abandoned requests
 * where the customer left or went offline without any worker bidding.
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
                returnDocument: 'after',
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
/**
 * Deletes booking voice-note media for bookings that are already completed/cancelled.
 * This ensures media storage does not grow indefinitely.
 */
const cleanupClosedBookingVoiceNotes = async () => {
    try {
        let cleanedCount = 0;
        while (cleanedCount < 200) {
            const booking = await Booking_1.default.findOne({
                status: { $in: ['completed', 'cancelled'] },
                'voiceNote.publicId': { $exists: true, $ne: '' },
            }).select('_id voiceNote.publicId');
            if (!booking || !booking.voiceNote?.publicId) {
                break;
            }
            try {
                await (0, cloudinary_service_1.deleteFromCloudinary)(booking.voiceNote.publicId, 'video');
            }
            catch (error) {
                console.error('Failed to delete closed-booking voice note from Cloudinary:', error);
            }
            await Booking_1.default.updateOne({ _id: booking._id }, { $unset: { voiceNote: 1 } });
            cleanedCount += 1;
        }
        if (cleanedCount > 0) {
            console.log(`Cleaned ${cleanedCount} closed-booking voice note(s)`);
        }
        return cleanedCount;
    }
    catch (error) {
        console.error('Closed booking voice note cleanup error:', error);
        return 0;
    }
};
exports.cleanupClosedBookingVoiceNotes = cleanupClosedBookingVoiceNotes;
//# sourceMappingURL=bookingCleanup.js.map