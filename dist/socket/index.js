"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeSocketServer = exports.sendAdminNotification = exports.sendNotification = exports.isUserOnline = exports.notifyBookingRoom = exports.notifyRole = exports.notifyWorkers = exports.notifyActiveWorkers = exports.notifyUser = exports.getIO = exports.initializeSocket = exports.authenticateHandshake = void 0;
const socket_io_1 = require("socket.io");
const ioredis_1 = __importDefault(require("ioredis"));
const redis_adapter_1 = require("@socket.io/redis-adapter");
const env_1 = __importDefault(require("../config/env"));
const Notification_1 = __importDefault(require("../models/Notification"));
const Admin_1 = __importDefault(require("../models/Admin"));
const generateToken_1 = require("../utils/generateToken");
const webPush_service_1 = require("../services/webPush.service");
const mobilePush_service_1 = require("../services/mobilePush.service");
const metrics_1 = require("../monitoring/metrics");
let io;
let isSocketInitialized = false;
let redisPubClient = null;
let redisSubClient = null;
const buildRedisOptions = (redisUrl) => {
    const options = {
        lazyConnect: true,
        connectTimeout: 10000,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
    };
    if (redisUrl.startsWith('rediss://')) {
        options.tls = {};
    }
    return options;
};
const toAlternateRedisScheme = (redisUrl) => {
    if (redisUrl.startsWith('rediss://')) {
        return `redis://${redisUrl.slice('rediss://'.length)}`;
    }
    if (redisUrl.startsWith('redis://')) {
        return `rediss://${redisUrl.slice('redis://'.length)}`;
    }
    return null;
};
const isLikelyProtocolMismatch = (error) => {
    if (!(error instanceof Error))
        return false;
    const message = error.message.toLowerCase();
    return (message.includes('err_ssl_packet_length_too_long') ||
        message.includes('packet length too long') ||
        message.includes("stream isn't writeable") ||
        message.includes('connection is closed') ||
        message.includes('ssl routines'));
};
// Track connected users: { socketId: { userId, role } }
const connectedUsers = new Map();
// Reverse map: userId -> socketId (for quick lookup)
const userSocketMap = new Map();
// Multi-tab support: userId -> all active socketIds
const userSocketsMap = new Map();
const setupSocketRedisAdapter = async () => {
    if (!env_1.default.REDIS_URL || !isSocketInitialized)
        return;
    const connectAdapterWithUrl = async (redisUrl) => {
        redisPubClient = new ioredis_1.default(redisUrl, buildRedisOptions(redisUrl));
        redisSubClient = redisPubClient.duplicate();
        redisPubClient.on('error', (error) => {
            console.error('Socket Redis pub client error:', error);
        });
        redisSubClient.on('error', (error) => {
            console.error('Socket Redis sub client error:', error);
        });
        await redisPubClient.connect();
        await redisSubClient.connect();
    };
    const resetAdapterClients = () => {
        if (redisPubClient) {
            redisPubClient.disconnect();
            redisPubClient = null;
        }
        if (redisSubClient) {
            redisSubClient.disconnect();
            redisSubClient = null;
        }
    };
    try {
        await connectAdapterWithUrl(env_1.default.REDIS_URL);
    }
    catch (error) {
        const alternateRedisUrl = toAlternateRedisScheme(env_1.default.REDIS_URL);
        if (!alternateRedisUrl || !isLikelyProtocolMismatch(error)) {
            console.error('Failed to initialize Socket Redis adapter. Continuing without adapter.', error);
            resetAdapterClients();
            return;
        }
        console.warn(`Socket Redis TLS mismatch for ${env_1.default.REDIS_URL}. Retrying with ${alternateRedisUrl}.`);
        resetAdapterClients();
        try {
            await connectAdapterWithUrl(alternateRedisUrl);
        }
        catch (retryError) {
            console.error('Failed to initialize Socket Redis adapter. Continuing without adapter.', retryError);
            resetAdapterClients();
            return;
        }
    }
    io.adapter((0, redis_adapter_1.createAdapter)(redisPubClient, redisSubClient));
    console.log('Socket Redis adapter enabled');
};
// Authenticate a Socket.IO handshake from its access token.
// Returns the verified identity, or null when no valid token is presented.
// Identity is ONLY ever derived from a verified token here — never from the
// client-supplied `register` payload — which closes the impersonation bypass.
const authenticateHandshake = (handshake) => {
    try {
        const authToken = typeof handshake.auth?.token === 'string' ? handshake.auth.token : undefined;
        const headerAuthRaw = handshake.headers?.authorization;
        const headerAuth = typeof headerAuthRaw === 'string' ? headerAuthRaw : undefined;
        const headerToken = headerAuth?.startsWith('Bearer ') ? headerAuth.slice(7) : undefined;
        const token = authToken || headerToken;
        if (!token)
            return null;
        const decoded = (0, generateToken_1.verifyAccessToken)(token);
        if (!decoded?.id || !decoded?.role)
            return null;
        return { id: decoded.id, role: decoded.role };
    }
    catch {
        return null;
    }
};
exports.authenticateHandshake = authenticateHandshake;
const initializeSocket = (server) => {
    io = new socket_io_1.Server(server, {
        transports: ['websocket', 'polling'],
        maxHttpBufferSize: env_1.default.SOCKET_MAX_HTTP_BUFFER_SIZE,
        pingInterval: env_1.default.SOCKET_PING_INTERVAL_MS,
        pingTimeout: env_1.default.SOCKET_PING_TIMEOUT_MS,
        connectionStateRecovery: {
            maxDisconnectionDuration: 2 * 60 * 1000,
            skipMiddlewares: true,
        },
        cors: {
            origin: (origin, callback) => {
                if (!origin || env_1.default.CLIENT_URLS.includes(origin)) {
                    callback(null, true);
                    return;
                }
                callback(new Error('CORS origin not allowed'));
            },
            methods: ['GET', 'POST'],
            credentials: true,
        },
    });
    isSocketInitialized = true;
    void setupSocketRedisAdapter();
    io.use((socket, next) => {
        // Reject any socket that does not present a valid access token. A missing or
        // invalid/expired token is unauthorized — we never fall back to trusting
        // client-supplied identity.
        const auth = (0, exports.authenticateHandshake)(socket.handshake);
        if (!auth) {
            next(new Error('unauthorized'));
            return;
        }
        socket.data.auth = auth;
        next();
    });
    io.on('connection', (socket) => {
        console.log(`Socket connected: ${socket.id}`);
        (0, metrics_1.recordSocketConnected)(socket.conn.transport.name || 'unknown');
        const registerSocketUser = (userId, role) => {
            connectedUsers.set(socket.id, { userId, role });
            if (!userSocketsMap.has(userId)) {
                userSocketsMap.set(userId, new Set());
            }
            userSocketsMap.get(userId).add(socket.id);
            // Keep latest socket for backward compatibility
            userSocketMap.set(userId, socket.id);
            socket.join(`user:${userId}`);
            socket.join(`role:${role}`);
            console.log(`User registered: ${userId} (${role})`);
        };
        const authData = socket.data.auth;
        if (authData?.id && authData?.role) {
            registerSocketUser(authData.id, authData.role);
        }
        // ─── Register user ───
        // Identity is taken exclusively from the verified token (socket.data.auth);
        // any client-supplied userId/role in the payload is ignored. Kept so clients
        // that emit `register` on connect still get (re-)joined to their rooms.
        socket.on('register', () => {
            if (authData?.id && authData?.role) {
                registerSocketUser(authData.id, authData.role);
                (0, metrics_1.recordSocketEvent)('register');
            }
        });
        // ─── Worker goes active/inactive ───
        socket.on('worker:toggle-active', ({ isActive }) => {
            if (isActive) {
                socket.join('workers:active');
            }
            else {
                socket.leave('workers:active');
            }
        });
        // ─── Worker live location update ───
        socket.on('worker:location-update', ({ bookingId, coordinates }) => {
            if (typeof bookingId !== 'string' || !bookingId.trim())
                return;
            if (!Array.isArray(coordinates) || coordinates.length !== 2)
                return;
            if (!coordinates.every((value) => Number.isFinite(value)))
                return;
            const userData = connectedUsers.get(socket.id);
            if (userData) {
                (0, metrics_1.recordSocketEvent)('worker:location-update');
                io.to(`booking:${bookingId}`).emit('worker:location-changed', {
                    bookingId,
                    workerId: userData.userId,
                    coordinates,
                    timestamp: new Date().toISOString(),
                });
            }
        });
        // ─── Join booking room (for live tracking) ───
        socket.on('booking:join', ({ bookingId }) => {
            if (typeof bookingId !== 'string' || !bookingId.trim())
                return;
            socket.join(`booking:${bookingId}`);
        });
        socket.on('booking:leave', ({ bookingId }) => {
            if (typeof bookingId !== 'string' || !bookingId.trim())
                return;
            socket.leave(`booking:${bookingId}`);
        });
        // ─── Worker ETA / message to customer (real-time) ───
        socket.on('worker:send-message', ({ bookingId, message }) => {
            if (typeof bookingId !== 'string' || !bookingId.trim())
                return;
            if (typeof message !== 'string' || !message.trim())
                return;
            const userData = connectedUsers.get(socket.id);
            if (userData) {
                (0, metrics_1.recordSocketEvent)('worker:send-message');
                io.to(`booking:${bookingId}`).emit('worker:message', {
                    bookingId,
                    message: message.trim().slice(0, 500),
                    workerId: userData.userId,
                    timestamp: new Date().toISOString(),
                });
            }
        });
        // ─── Disconnect ───
        socket.on('disconnect', (reason) => {
            const userData = connectedUsers.get(socket.id);
            if (userData) {
                const socketSet = userSocketsMap.get(userData.userId);
                if (socketSet) {
                    socketSet.delete(socket.id);
                    if (socketSet.size === 0) {
                        userSocketsMap.delete(userData.userId);
                        userSocketMap.delete(userData.userId);
                    }
                    else {
                        const [nextSocketId] = socketSet;
                        if (nextSocketId)
                            userSocketMap.set(userData.userId, nextSocketId);
                    }
                }
            }
            connectedUsers.delete(socket.id);
            (0, metrics_1.recordSocketDisconnected)(reason || 'unknown');
            console.log(`Socket disconnected: ${socket.id}`);
        });
    });
    return io;
};
exports.initializeSocket = initializeSocket;
const getIO = () => {
    if (!isSocketInitialized)
        throw new Error('Socket.IO not initialized');
    return io;
};
exports.getIO = getIO;
// Send notification to specific user
const notifyUser = (userId, event, data) => {
    if (isSocketInitialized) {
        io.to(`user:${userId}`).emit(event, data);
    }
};
exports.notifyUser = notifyUser;
// Send notification to all active workers
const notifyActiveWorkers = (event, data) => {
    if (isSocketInitialized) {
        io.to('workers:active').emit(event, data);
    }
};
exports.notifyActiveWorkers = notifyActiveWorkers;
// Send notification to specific workers by IDs
const notifyWorkers = (workerIds, event, data) => {
    if (isSocketInitialized) {
        workerIds.forEach((id) => {
            io.to(`user:${id}`).emit(event, data);
        });
    }
};
exports.notifyWorkers = notifyWorkers;
// Send notification to a role room
const notifyRole = (role, event, data) => {
    if (isSocketInitialized) {
        io.to(`role:${role}`).emit(event, data);
    }
};
exports.notifyRole = notifyRole;
// Send event to a booking room
const notifyBookingRoom = (bookingId, event, data) => {
    if (isSocketInitialized) {
        io.to(`booking:${bookingId}`).emit(event, data);
    }
};
exports.notifyBookingRoom = notifyBookingRoom;
// Check if user is online
const isUserOnline = (userId) => {
    return (userSocketsMap.get(userId)?.size || 0) > 0;
};
exports.isUserOnline = isUserOnline;
let adminCache = null;
const getAdminIds = async () => {
    const now = Date.now();
    if (adminCache && adminCache.expiresAt > now) {
        return adminCache.ids;
    }
    const admins = await Admin_1.default.find().select('_id').lean();
    const ids = admins.map((admin) => admin._id.toString());
    adminCache = {
        ids,
        expiresAt: now + 15000,
    };
    return ids;
};
// ─── Create notification in DB + emit via socket in one call ───
const sendNotification = async (params) => {
    try {
        const notification = await Notification_1.default.create({
            recipient: params.recipientId,
            recipientModel: params.recipientModel,
            type: params.type,
            title: params.title,
            message: params.message,
            data: params.data,
        });
        // Emit to the user's personal room
        if (isSocketInitialized) {
            const payload = {
                _id: notification._id,
                recipient: params.recipientId,
                recipientModel: params.recipientModel,
                type: params.type,
                title: params.title,
                message: params.message,
                data: params.data,
                isRead: false,
                createdAt: notification.createdAt,
                expiresAt: notification.expiresAt,
            };
            io.to(`user:${params.recipientId}`).emit('notification_event', payload);
        }
        const pushPayload = {
            recipientId: params.recipientId,
            recipientModel: params.recipientModel,
            notificationId: String(notification._id),
            type: params.type,
            title: params.title,
            message: params.message,
            data: params.data,
            createdAt: notification.createdAt,
        };
        await Promise.allSettled([
            (0, webPush_service_1.sendWebPushNotification)(pushPayload),
            (0, mobilePush_service_1.sendMobilePushNotification)(pushPayload),
        ]);
    }
    catch (error) {
        console.error('sendNotification error:', error);
    }
};
exports.sendNotification = sendNotification;
// ─── Create notification for ALL admins in DB + emit via socket ───
const sendAdminNotification = async (params) => {
    try {
        const adminIds = await getAdminIds();
        await Promise.all(adminIds.map((adminId) => (0, exports.sendNotification)({
            recipientId: adminId,
            recipientModel: 'Admin',
            type: params.type,
            title: params.title,
            message: params.message,
            data: params.data,
        })));
    }
    catch (error) {
        console.error('sendAdminNotification error:', error);
    }
};
exports.sendAdminNotification = sendAdminNotification;
const closeSocketServer = async () => {
    if (isSocketInitialized) {
        await new Promise((resolve) => {
            io.close(() => resolve());
        });
        isSocketInitialized = false;
    }
    if (redisPubClient) {
        try {
            await redisPubClient.quit();
        }
        catch {
            redisPubClient.disconnect();
        }
        redisPubClient = null;
    }
    if (redisSubClient) {
        try {
            await redisSubClient.quit();
        }
        catch {
            redisSubClient.disconnect();
        }
        redisSubClient = null;
    }
};
exports.closeSocketServer = closeSocketServer;
//# sourceMappingURL=index.js.map