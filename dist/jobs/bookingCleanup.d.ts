/**
 * Auto-cancel stale bookings that are still in 'finding_workers' status
 * after the configured stale window. This cleans up abandoned requests
 * where the customer left or went offline without any worker bidding.
 *
 * Runs every 60 seconds via setInterval in server.ts
 */
export declare const cancelStaleBookings: () => Promise<number>;
/**
 * Deletes booking voice-note media for bookings that are already completed/cancelled.
 * This ensures media storage does not grow indefinitely.
 */
export declare const cleanupClosedBookingVoiceNotes: () => Promise<number>;
//# sourceMappingURL=bookingCleanup.d.ts.map