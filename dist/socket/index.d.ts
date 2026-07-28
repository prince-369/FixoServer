import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
/**
 * Resolve whether the Socket.IO Redis adapter should run, given REDIS_URL and the explicit
 * SOCKET_REDIS_ENABLED flag. Pure + exported for tests.
 *
 *   flag undefined → backward-compatible: enabled iff REDIS_URL is present
 *   flag false     → disabled regardless of REDIS_URL
 *   flag true      → enabled; 'enabled-without-redis' when REDIS_URL is absent
 */
export declare const resolveSocketAdapter: (redisUrl: string | undefined, socketRedisEnabled: boolean | undefined) => "disabled" | "enabled" | "enabled-without-redis";
export interface SocketAuth {
    id: string;
    role: 'customer' | 'worker' | 'admin';
}
export declare const authenticateHandshake: (handshake: {
    auth?: {
        token?: unknown;
    } | null;
    headers?: Record<string, unknown>;
}) => SocketAuth | null;
export declare const initializeSocket: (server: HTTPServer) => SocketIOServer;
export declare const getIO: () => SocketIOServer;
export declare const notifyUser: (userId: string, event: string, data: unknown) => void;
export type VerificationStatus = 'unsubmitted' | 'pending' | 'approved' | 'rejected' | 'resubmitted';
/**
 * Emit the canonical, minimal `verification_status_updated` event to `user:<workerId>`.
 *
 * Deliberately ships ONLY what the worker client needs to gate its UI — never the worker
 * document, Aadhaar fields, document URLs, WhatsApp number, verifiedBy or admin notes.
 * `updatedAt` is the worker's post-save timestamp: the monotonic version marker clients
 * use to reject stale API responses. Must be called AFTER a successful `worker.save()`.
 *
 * Realtime delivery is best-effort: a failure here must never fail the admin/worker action,
 * so everything is wrapped and logged without sensitive fields (fallback polling self-heals).
 */
export declare const notifyVerificationStatus: (worker: {
    _id: unknown;
    accountStatus?: string;
    rejectionReason?: string;
    updatedAt?: Date | string | null;
}, status: VerificationStatus) => void;
export declare const notifyActiveWorkers: (event: string, data: unknown) => void;
export declare const notifyWorkers: (workerIds: string[], event: string, data: unknown) => void;
export declare const notifyRole: (role: string, event: string, data: unknown) => void;
export declare const notifyBookingRoom: (bookingId: string, event: string, data: unknown) => void;
export declare const isUserOnline: (userId: string) => boolean;
/**
 * Emit the recipient's current unread-notification count to their own socket room.
 *
 * Count-only payload `{ count }` (a normalized non-negative integer) — no notification
 * content, so nothing sensitive crosses the wire. Scoped strictly to `user:<recipientId>`,
 * and only for real end users (customers/workers); Admin badges are out of scope.
 *
 * Best-effort: if counting fails it logs and returns without throwing, so it can never
 * break the caller's primary action — the client's 3-minute fallback self-heals.
 */
export declare const emitNotificationUnreadCount: (recipientId: string, recipientModel: "User" | "Worker" | "Admin") => Promise<void>;
export declare const sendNotification: (params: {
    recipientId: string;
    recipientModel: "User" | "Worker" | "Admin";
    type: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
}) => Promise<void>;
export declare const sendAdminNotification: (params: {
    type: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
}) => Promise<void>;
export declare const closeSocketServer: () => Promise<void>;
//# sourceMappingURL=index.d.ts.map