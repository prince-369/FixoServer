import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
export declare const initializeSocket: (server: HTTPServer) => SocketIOServer;
export declare const getIO: () => SocketIOServer;
export declare const notifyUser: (userId: string, event: string, data: unknown) => void;
export declare const notifyActiveWorkers: (event: string, data: unknown) => void;
export declare const notifyWorkers: (workerIds: string[], event: string, data: unknown) => void;
export declare const notifyRole: (role: string, event: string, data: unknown) => void;
export declare const notifyBookingRoom: (bookingId: string, event: string, data: unknown) => void;
export declare const isUserOnline: (userId: string) => boolean;
export declare const getActiveEKYCRooms: () => Map<string, {
    workerId: string;
    adminId?: string;
    createdAt: Date;
}>;
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