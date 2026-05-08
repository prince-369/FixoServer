"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeSocketServer = exports.sendAdminNotification = exports.sendNotification = exports.getActiveEKYCRooms = exports.isUserOnline = exports.notifyBookingRoom = exports.notifyRole = exports.notifyWorkers = exports.notifyActiveWorkers = exports.notifyUser = exports.getIO = exports.initializeSocket = void 0;
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
// Track active eKYC video call rooms
const ekycRooms = new Map();
// Helper: delete eKYC notifications for a worker from all admins
const deleteEkycNotifications = async (workerId) => {
    try {
        await Notification_1.default.deleteMany({
            type: { $in: ['ekyc_preparing', 'ekyc_waiting'] },
            'data.workerId': workerId,
        });
        console.log(`[eKYC] Deleted eKYC notifications for worker ${workerId}`);
    }
    catch (e) {
        console.error('[eKYC] Failed to delete notifications:', e);
    }
};
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
    (0, metrics_1.setActiveEkycRooms)(0);
    void setupSocketRedisAdapter();
    io.use((socket, next) => {
        try {
            const authToken = socket.handshake.auth?.token;
            const headerAuth = socket.handshake.headers.authorization;
            const headerToken = headerAuth?.startsWith('Bearer ') ? headerAuth.slice(7) : undefined;
            const token = authToken || headerToken;
            if (!token) {
                next();
                return;
            }
            const decoded = (0, generateToken_1.verifyAccessToken)(token);
            socket.data.auth = decoded;
            next();
        }
        catch {
            // Allow connection even with invalid/expired token — manual 'register' event will handle identity
            console.warn('Socket auth failed (expired token?), allowing unauthenticated connection');
            next();
        }
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
            // When admin registers, notify about any existing waiting eKYC rooms
            if (role === 'admin') {
                for (const [roomId, room] of ekycRooms.entries()) {
                    if (!room.adminId) {
                        socket.emit('ekyc:worker-waiting', {
                            workerId: room.workerId,
                            roomId,
                            workerName: room.workerName,
                            workerPhone: room.workerPhone,
                        });
                    }
                }
            }
        };
        const authData = socket.data.auth;
        if (authData?.id && authData?.role) {
            registerSocketUser(authData.id, authData.role);
        }
        // ─── Register user ───
        socket.on('register', ({ userId, role }) => {
            const tokenUserId = authData?.id;
            const tokenRole = authData?.role;
            if (tokenUserId && tokenRole) {
                if (tokenUserId !== userId || tokenRole !== role) {
                    socket.emit('socket:error', { message: 'Socket identity mismatch' });
                    return;
                }
            }
            registerSocketUser(tokenUserId || userId, tokenRole || role);
            (0, metrics_1.recordSocketEvent)('register');
        });
        // ─── Admin marks themself as available for worker eKYC ───
        socket.on('ekyc:notify-availability', async ({ workerId }, ack) => {
            const sendAck = (ok, message) => {
                if (typeof ack === 'function') {
                    ack(message ? { ok, message } : { ok });
                }
            };
            if (typeof workerId !== 'string' || !workerId.trim()) {
                sendAck(false, 'Worker ID is required.');
                return;
            }
            const actor = connectedUsers.get(socket.id);
            if (!actor || actor.role !== 'admin') {
                sendAck(false, 'Only admins can notify worker availability.');
                return;
            }
            const targetWorkerId = workerId.trim();
            const availabilityMessage = 'A verification specialist is available now. Start Video KYC when you are ready.';
            (0, metrics_1.recordSocketEvent)('ekyc:notify-availability');
            try {
                // Keep only the latest unread availability ping to avoid notification spam.
                await Notification_1.default.deleteMany({
                    recipient: targetWorkerId,
                    recipientModel: 'Worker',
                    type: 'ekyc_admin_available',
                    isRead: false,
                });
                await (0, exports.sendNotification)({
                    recipientId: targetWorkerId,
                    recipientModel: 'Worker',
                    type: 'ekyc_admin_available',
                    title: 'E-KYC Team Available',
                    message: availabilityMessage,
                    data: {
                        workerId: targetWorkerId,
                        adminId: actor.userId,
                    },
                });
                io.to(`user:${targetWorkerId}`).emit('ekyc:admin-available', {
                    workerId: targetWorkerId,
                    adminId: actor.userId,
                    message: availabilityMessage,
                    sentAt: new Date().toISOString(),
                });
                console.log(`[eKYC] Admin ${actor.userId} notified worker ${targetWorkerId} about availability`);
                sendAck(true);
            }
            catch (error) {
                console.error('[eKYC] Failed to notify worker availability:', error);
                sendAck(false, 'Failed to notify worker right now. Please try again.');
            }
        });
        // ─── Worker goes active/inactive ───
        socket.on('worker:toggle-active', ({ workerId, isActive }) => {
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
        // ─── WebRTC eKYC Video Call Signaling ───
        // Worker is preparing for eKYC (30s countdown started) — notify admins
        socket.on('ekyc:worker-preparing', ({ workerId, workerName, workerPhone, countdownSeconds }) => {
            (0, metrics_1.recordSocketEvent)('ekyc:worker-preparing');
            const name = workerName || 'Worker';
            const phone = workerPhone || '';
            const seconds = countdownSeconds || 30;
            io.to('role:admin').emit('ekyc:worker-preparing', { workerId, workerName: name, workerPhone: phone, countdownSeconds: seconds });
            console.log(`[eKYC] Worker ${name} (${workerId}) preparing (${seconds}s) — admins notified`);
            // Also send a persistent notification so NotificationBell fires browser notification + toast
            (0, exports.sendAdminNotification)({
                type: 'ekyc_preparing',
                title: 'Video KYC Incoming',
                message: `${name} is starting Video KYC in ${seconds} seconds — get ready!`,
                data: { workerId, workerName: name, workerPhone: phone },
            });
        });
        // Worker cancels during countdown (before room creation)
        socket.on('ekyc:cancel-preparing', ({ workerId }) => {
            (0, metrics_1.recordSocketEvent)('ekyc:cancel-preparing');
            io.to('role:admin').emit('ekyc:call-ended', { workerId, reason: 'worker-cancelled-preparing' });
            deleteEkycNotifications(workerId);
            console.log(`[eKYC] Worker ${workerId} cancelled during preparation`);
        });
        // Worker initiates eKYC call room
        socket.on('ekyc:create-room', ({ workerId, workerName, workerPhone }) => {
            if (typeof workerId !== 'string' || !workerId.trim())
                return;
            (0, metrics_1.recordSocketEvent)('ekyc:create-room');
            const roomId = `ekyc:${workerId}`;
            const name = workerName || 'Worker';
            const phone = workerPhone || '';
            ekycRooms.set(roomId, {
                workerId, workerName: name, workerPhone: phone,
                createdAt: new Date(), iceCandidates: [], readySockets: new Set(),
            });
            (0, metrics_1.setActiveEkycRooms)(ekycRooms.size);
            socket.join(roomId);
            io.to('role:admin').emit('ekyc:worker-waiting', { workerId, roomId, workerName: name, workerPhone: phone });
            console.log(`[eKYC] Room created: ${roomId} by socket ${socket.id}`);
            // Persistent notification for the actual call waiting
            (0, exports.sendAdminNotification)({
                type: 'ekyc_waiting',
                title: 'Video KYC Call Waiting',
                message: `${name} is waiting for Video KYC verification now!`,
                data: { workerId, roomId, workerName: name, workerPhone: phone },
            });
            // Auto-timeout: if admin doesn't join within 2 minutes, cancel the call
            const room = ekycRooms.get(roomId);
            if (room) {
                room.timeoutId = setTimeout(() => {
                    const currentRoom = ekycRooms.get(roomId);
                    if (currentRoom && !currentRoom.adminId) {
                        io.to(roomId).emit('ekyc:call-timeout');
                        io.to('role:admin').emit('ekyc:call-ended', { roomId, workerId, reason: 'call-timeout' });
                        io.in(roomId).socketsLeave(roomId);
                        ekycRooms.delete(roomId);
                        (0, metrics_1.setActiveEkycRooms)(ekycRooms.size);
                        deleteEkycNotifications(workerId);
                        console.log(`[eKYC] Call timed out (2min): ${roomId}`);
                    }
                }, 2 * 60 * 1000);
            }
        });
        // Admin joins eKYC call — clear timeout since call is answered
        socket.on('ekyc:join-room', ({ roomId, adminId }) => {
            if (typeof roomId !== 'string' || !roomId.trim())
                return;
            if (typeof adminId !== 'string' || !adminId.trim())
                return;
            const room = ekycRooms.get(roomId);
            if (room) {
                (0, metrics_1.recordSocketEvent)('ekyc:join-room');
                room.adminId = adminId;
                if (room.timeoutId) {
                    clearTimeout(room.timeoutId);
                    room.timeoutId = undefined;
                }
                socket.join(roomId);
                io.to(roomId).emit('ekyc:admin-joined', { adminId, roomId });
                deleteEkycNotifications(room.workerId);
                console.log(`[eKYC] Admin ${adminId} joined room: ${roomId}, socket: ${socket.id}`);
            }
        });
        // Admin rejects/declines the incoming call
        socket.on('ekyc:reject-call', ({ roomId }) => {
            const room = ekycRooms.get(roomId);
            if (room) {
                (0, metrics_1.recordSocketEvent)('ekyc:reject-call');
                if (room.timeoutId) {
                    clearTimeout(room.timeoutId);
                    room.timeoutId = undefined;
                }
                io.to(roomId).emit('ekyc:call-rejected');
                io.to('role:admin').emit('ekyc:call-ended', { roomId, workerId: room.workerId, reason: 'admin-rejected-call' });
                io.in(roomId).socketsLeave(roomId);
                deleteEkycNotifications(room.workerId);
                ekycRooms.delete(roomId);
                (0, metrics_1.setActiveEkycRooms)(ekycRooms.size);
                console.log(`[eKYC] Call rejected by admin: ${roomId}`);
            }
        });
        // ── Both sides signal "my VideoCall component is ready" ──
        // Server tracks which sockets are ready; when 2 sockets are ready, tells the initiator to create offer
        socket.on('ekyc:video-ready', ({ roomId }) => {
            socket.join(roomId); // Ensure room membership
            const room = ekycRooms.get(roomId);
            if (!room) {
                console.log(`[eKYC] video-ready: room ${roomId} not found`);
                return;
            }
            room.readySockets.add(socket.id);
            console.log(`[eKYC] video-ready from ${socket.id}, room ${roomId}, readySockets: ${room.readySockets.size}`);
            if (room.readySockets.size >= 2) {
                // Both sides are ready — tell EVERYONE in the room to start
                console.log(`[eKYC] Both ready! Emitting ekyc:both-ready to room ${roomId}`);
                io.to(roomId).emit('ekyc:both-ready', { roomId });
            }
        });
        // WebRTC offer — buffer on server + relay
        socket.on('ekyc:offer', ({ roomId, offer }) => {
            const room = ekycRooms.get(roomId);
            if (room)
                room.offer = offer;
            console.log(`[eKYC] Offer received from ${socket.id}, relaying to room ${roomId}`);
            socket.to(roomId).emit('ekyc:offer', { offer });
        });
        // Admin requests the buffered offer (in case it missed the relay)
        socket.on('ekyc:request-offer', ({ roomId }) => {
            const room = ekycRooms.get(roomId);
            if (room?.offer) {
                console.log(`[eKYC] Sending buffered offer to ${socket.id}`);
                socket.emit('ekyc:offer', { offer: room.offer });
            }
        });
        // WebRTC answer — relay
        socket.on('ekyc:answer', ({ roomId, answer }) => {
            const room = ekycRooms.get(roomId);
            if (room)
                room.answer = answer;
            console.log(`[eKYC] Answer received from ${socket.id}, relaying to room ${roomId}`);
            socket.to(roomId).emit('ekyc:answer', { answer });
        });
        // Worker requests buffered answer (if relay was missed)
        socket.on('ekyc:request-answer', ({ roomId }) => {
            const room = ekycRooms.get(roomId);
            if (room?.answer) {
                console.log(`[eKYC] Sending buffered answer to ${socket.id}`);
                socket.emit('ekyc:answer', { answer: room.answer });
            }
        });
        // ICE candidate — buffer + relay
        socket.on('ekyc:ice-candidate', ({ roomId, candidate }) => {
            const room = ekycRooms.get(roomId);
            if (room)
                room.iceCandidates.push({ from: socket.id, candidate });
            socket.to(roomId).emit('ekyc:ice-candidate', { candidate });
        });
        // Request buffered ICE candidates (in case some were missed)
        socket.on('ekyc:request-candidates', ({ roomId }) => {
            const room = ekycRooms.get(roomId);
            if (room) {
                const others = room.iceCandidates.filter(c => c.from !== socket.id);
                others.forEach(({ candidate }) => {
                    socket.emit('ekyc:ice-candidate', { candidate });
                });
                console.log(`[eKYC] Sent ${others.length} buffered ICE candidates to ${socket.id}`);
            }
        });
        // End eKYC call
        socket.on('ekyc:end-call', ({ roomId, reason }) => {
            if (typeof roomId !== 'string' || !roomId.trim())
                return;
            (0, metrics_1.recordSocketEvent)('ekyc:end-call');
            const room = ekycRooms.get(roomId);
            if (room) {
                if (room.timeoutId) {
                    clearTimeout(room.timeoutId);
                    room.timeoutId = undefined;
                }
                deleteEkycNotifications(room.workerId);
            }
            io.to(roomId).emit('ekyc:call-ended', { roomId, workerId: room?.workerId, reason: reason || 'manual-end-call' });
            ekycRooms.delete(roomId);
            (0, metrics_1.setActiveEkycRooms)(ekycRooms.size);
            io.in(roomId).socketsLeave(roomId);
            console.log(`[eKYC] Call ended: ${roomId}, reason: ${reason || 'manual-end-call'}`);
        });
        // Admin commands worker to switch camera (front/back)
        socket.on('ekyc:switch-camera', ({ roomId, facing }) => {
            // Relay to the worker (other side in the room)
            socket.to(roomId).emit('ekyc:switch-camera', { facing });
            console.log(`[eKYC] Camera switch to ${facing} requested in room ${roomId}`);
        });
        // Admin requests worker to capture their camera frame
        socket.on('ekyc:request-capture', ({ roomId }) => {
            socket.to(roomId).emit('ekyc:request-capture', { roomId });
            console.log(`[eKYC] Capture requested in room ${roomId}`);
        });
        // Worker sends captured frame back to admin
        socket.on('ekyc:capture-result', ({ roomId, imageData }) => {
            socket.to(roomId).emit('ekyc:capture-result', { imageData });
            console.log(`[eKYC] Capture result relayed in room ${roomId}`);
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
                const isUserPresentInRoom = (userId, roomId) => {
                    const userSockets = userSocketsMap.get(userId);
                    if (!userSockets || userSockets.size === 0)
                        return false;
                    const roomSockets = io.sockets.adapter.rooms.get(roomId);
                    if (!roomSockets || roomSockets.size === 0)
                        return false;
                    for (const sid of userSockets) {
                        if (roomSockets.has(sid))
                            return true;
                    }
                    return false;
                };
                // Clean up eKYC rooms only when a participant has actually left the room.
                // This avoids false call-end events when another tab/socket of same user disconnects.
                for (const [roomId, room] of ekycRooms.entries()) {
                    const isWorkerRoom = room.workerId === userData.userId;
                    const isAdminRoom = room.adminId === userData.userId;
                    if (!isWorkerRoom && !isAdminRoom)
                        continue;
                    room.readySockets.delete(socket.id);
                    const workerStillPresent = isUserPresentInRoom(room.workerId, roomId);
                    const adminStillPresent = room.adminId ? isUserPresentInRoom(room.adminId, roomId) : false;
                    // End room when a required participant is no longer present in this room.
                    const shouldEndRoom = !workerStillPresent || (Boolean(room.adminId) && !adminStillPresent);
                    if (!shouldEndRoom)
                        continue;
                    if (room.timeoutId) {
                        clearTimeout(room.timeoutId);
                    }
                    io.to(roomId).emit('ekyc:call-ended', { roomId, workerId: room.workerId, reason: 'participant-disconnected' });
                    io.in(roomId).socketsLeave(roomId);
                    void deleteEkycNotifications(room.workerId);
                    ekycRooms.delete(roomId);
                    (0, metrics_1.setActiveEkycRooms)(ekycRooms.size);
                    console.log(`[eKYC] Room cleaned after participant disconnect: ${roomId}`);
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
// Get active eKYC rooms
const getActiveEKYCRooms = () => {
    return ekycRooms;
};
exports.getActiveEKYCRooms = getActiveEKYCRooms;
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
    for (const room of ekycRooms.values()) {
        if (room.timeoutId) {
            clearTimeout(room.timeoutId);
        }
    }
    ekycRooms.clear();
    (0, metrics_1.setActiveEkycRooms)(0);
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