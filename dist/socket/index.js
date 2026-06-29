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
const Worker_1 = __importDefault(require("../models/Worker"));
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
// How long a live eKYC call survives after a participant drops (network blip / app kill / accidental close).
// If they rejoin within this window, the SAME call resumes automatically — no restart.
const EKYC_GRACE_MS = 120 * 1000;
const ekycRooms = new Map();
// After a live video-KYC call ends, flag the worker so the admin's "was the call OK?"
// (completed / incomplete) decision survives a page reload, network drop or app close.
// The flag is cleared once the admin marks completed/incomplete or approves/rejects.
const markVideoKycAwaitingResult = async (workerId) => {
    try {
        await Worker_1.default.updateOne({ _id: workerId, accountStatus: { $in: ['test', 'ekyc_pending'] } }, { $set: { videoKycAwaitingResult: true, videoKycCallEndedAt: new Date() } });
        console.log(`[eKYC] Worker ${workerId} flagged awaiting video-KYC result`);
    }
    catch (e) {
        console.error('[eKYC] Failed to flag awaiting result:', e);
    }
};
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
const getVideoKycRetryState = async (workerId) => {
    try {
        const worker = await Worker_1.default.findById(workerId).select('videoKycRetryAvailableAt videoKycIncompleteReason');
        if (!worker?.videoKycRetryAvailableAt) {
            return { blocked: false };
        }
        const retryAvailableAt = new Date(worker.videoKycRetryAvailableAt);
        if (Number.isNaN(retryAvailableAt.getTime()) || retryAvailableAt.getTime() <= Date.now()) {
            return { blocked: false };
        }
        const reason = typeof worker.videoKycIncompleteReason === 'string' && worker.videoKycIncompleteReason.trim()
            ? worker.videoKycIncompleteReason.trim()
            : undefined;
        return {
            blocked: true,
            retryAvailableAt,
            reason,
        };
    }
    catch (error) {
        console.error('[eKYC] Failed to resolve retry state:', error);
        return { blocked: false };
    }
};
const emitRetryBlocked = (socket, workerId, retryAvailableAt, reason) => {
    const retrySecondsLeft = Math.max(1, Math.ceil((retryAvailableAt.getTime() - Date.now()) / 1000));
    socket.emit('ekyc:retry-blocked', {
        workerId,
        reason,
        retrySecondsLeft,
        retryAvailableAt: retryAvailableAt.toISOString(),
    });
};
// Aggregate "VideoCall component ready" signals on the instance that OWNS the room.
// Called both for local sockets and (via serverSideEmit) for sockets connected to
// other instances, so a worker + admin split across instances still reaches 2-ready.
const handleVideoReady = (roomId, socketId) => {
    const room = ekycRooms.get(roomId);
    if (!room)
        return; // Only the owning instance has the room — others ignore.
    // A participant came back during the grace window → resume this call.
    // Clear the grace timer, wipe the stale WebRTC handshake, and ask BOTH sides
    // to re-run a clean negotiation so the live call continues from where it left off.
    if (room.interrupted) {
        if (room.graceTimeoutId) {
            clearTimeout(room.graceTimeoutId);
            room.graceTimeoutId = undefined;
        }
        room.interrupted = false;
        room.offer = undefined;
        room.answer = undefined;
        room.iceCandidates = [];
        room.readySockets.clear();
        io.to(roomId).emit('ekyc:reconnect-now', { roomId });
        io.to('role:admin').emit('ekyc:reconnect-now', { roomId });
        console.log(`[eKYC] Reconnect during grace → fresh handshake for room ${roomId}`);
    }
    room.readySockets.add(socketId);
    console.log(`[eKYC] video-ready from ${socketId}, room ${roomId}, readySockets: ${room.readySockets.size}`);
    if (room.readySockets.size >= 2) {
        // Both sides are ready — tell EVERYONE in the room to start
        console.log(`[eKYC] Both ready! Emitting ekyc:both-ready to room ${roomId}`);
        io.to(roomId).emit('ekyc:both-ready', { roomId });
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
    // ─── Inter-instance eKYC sync (multi-instance AWS deploy) ───
    // When an admin joins on a different server instance than the one that owns the
    // in-memory room, the join is broadcast here so the owning instance can update
    // the room's adminId and clear its auto-cancel timeout.
    io.on('ekyc:admin-joined-sync', ({ roomId, adminId }) => {
        const room = ekycRooms.get(roomId);
        if (room) {
            room.adminId = adminId;
            if (room.timeoutId) {
                clearTimeout(room.timeoutId);
                room.timeoutId = undefined;
            }
            deleteEkycNotifications(room.workerId);
            console.log(`[eKYC] admin-joined-sync applied on owning instance for room ${roomId}`);
        }
    });
    // Aggregate cross-instance "video-ready" signals on the owning instance.
    io.on('ekyc:video-ready-sync', ({ roomId, socketId }) => {
        handleVideoReady(roomId, socketId);
    });
    // Buffer WebRTC handshake artifacts on the owning instance when the producing
    // socket connected to a different instance (multi-instance deploy).
    io.on('ekyc:buffer-offer', ({ roomId, offer }) => {
        const room = ekycRooms.get(roomId);
        if (room)
            room.offer = offer;
    });
    io.on('ekyc:buffer-answer', ({ roomId, answer }) => {
        const room = ekycRooms.get(roomId);
        if (room)
            room.answer = answer;
    });
    io.on('ekyc:buffer-ice', ({ roomId, fromSocketId, candidate }) => {
        const room = ekycRooms.get(roomId);
        if (room)
            room.iceCandidates.push({ from: fromSocketId, candidate });
    });
    // Serve buffered artifacts to a requester that connected to a different instance.
    io.on('ekyc:request-offer-sync', ({ roomId, requesterId }) => {
        const room = ekycRooms.get(roomId);
        if (room?.offer)
            io.to(requesterId).emit('ekyc:offer', { offer: room.offer });
    });
    io.on('ekyc:request-answer-sync', ({ roomId, requesterId }) => {
        const room = ekycRooms.get(roomId);
        if (room?.answer)
            io.to(requesterId).emit('ekyc:answer', { answer: room.answer });
    });
    io.on('ekyc:request-candidates-sync', ({ roomId, requesterId }) => {
        const room = ekycRooms.get(roomId);
        if (room) {
            const others = room.iceCandidates.filter((c) => c.from !== requesterId);
            others.forEach(({ candidate }) => io.to(requesterId).emit('ekyc:ice-candidate', { candidate }));
        }
    });
    // Worker reconnected on a different instance — owning instance re-notifies if admin joined.
    io.on('ekyc:rejoin-sync', ({ roomId, workerId }) => {
        const room = ekycRooms.get(roomId);
        if (room && room.workerId === workerId && room.adminId) {
            io.to(`user:${workerId}`).emit('ekyc:admin-joined', { adminId: room.adminId, roomId });
            console.log(`[eKYC] rejoin-sync re-notified worker ${workerId} (admin already joined) for room ${roomId}`);
        }
    });
    // A user reconnected on a different instance and asked to resume — the instance
    // that owns their ongoing eKYC room answers by emitting resume-available to them.
    io.on('ekyc:check-resume-sync', ({ userId, role }) => {
        for (const [roomId, room] of ekycRooms.entries()) {
            const isWorker = role === 'worker' && room.workerId === userId;
            const isAdmin = role === 'admin' && room.adminId === userId;
            if (!isWorker && !isAdmin)
                continue;
            io.to(`user:${userId}`).emit('ekyc:resume-available', {
                roomId,
                role,
                workerId: room.workerId,
                adminId: room.adminId,
            });
            console.log(`[eKYC] check-resume-sync: re-notified ${role} ${userId} to resume ${roomId}`);
        }
    });
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
            // Resume an INTERRUPTED eKYC call after reconnect/relaunch.
            // If this user (worker or admin) belongs to a call that dropped and is still
            // inside the grace window, tell them to jump straight back into the same room.
            for (const [roomId, room] of ekycRooms.entries()) {
                if (!room.interrupted)
                    continue;
                const isWorker = role === 'worker' && room.workerId === userId;
                const isAdmin = role === 'admin' && room.adminId === userId;
                if (!isWorker && !isAdmin)
                    continue;
                socket.emit('ekyc:resume-available', {
                    roomId,
                    role,
                    workerId: room.workerId,
                    adminId: room.adminId,
                    workerName: room.workerName,
                    workerPhone: room.workerPhone,
                });
                console.log(`[eKYC] resume-available sent to ${role} ${userId} for room ${roomId}`);
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
        socket.on('ekyc:worker-preparing', async ({ workerId, workerName, workerPhone, countdownSeconds }) => {
            if (typeof workerId !== 'string' || !workerId.trim())
                return;
            const retryState = await getVideoKycRetryState(workerId);
            if (retryState.blocked && retryState.retryAvailableAt) {
                emitRetryBlocked(socket, workerId, retryState.retryAvailableAt, retryState.reason);
                return;
            }
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
        socket.on('ekyc:create-room', async ({ workerId, workerName, workerPhone }) => {
            if (typeof workerId !== 'string' || !workerId.trim())
                return;
            const retryState = await getVideoKycRetryState(workerId);
            if (retryState.blocked && retryState.retryAvailableAt) {
                emitRetryBlocked(socket, workerId, retryState.retryAvailableAt, retryState.reason);
                return;
            }
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
        // Worker re-joins room after socket reconnect
        socket.on('ekyc:rejoin-room', ({ roomId, workerId }) => {
            if (!roomId || !workerId)
                return;
            const room = ekycRooms.get(roomId);
            if (room && room.workerId === workerId) {
                socket.join(roomId);
                console.log(`[eKYC] Worker re-joined room after reconnect: ${roomId}, socket: ${socket.id}`);
                // If admin already joined, notify the worker immediately
                if (room.adminId) {
                    socket.emit('ekyc:admin-joined', { adminId: room.adminId, roomId });
                }
            }
            else {
                // Room may live on another instance — still join locally for signaling and
                // ask the owning instance to re-notify if an admin has already joined.
                socket.join(roomId);
                try {
                    io.serverSideEmit('ekyc:rejoin-sync', { roomId, workerId });
                }
                catch { /* no adapter */ }
            }
        });
        // ─── Client-initiated resume check (page reload / network drop / app relaunch) ───
        // The admin/worker asks "am I part of an ongoing eKYC call?" right after their
        // socket is ready and listeners are attached. This avoids the race where the
        // server's auto-register fires resume-available before the client is listening,
        // and works across instances via serverSideEmit.
        socket.on('ekyc:check-resume', () => {
            const actor = connectedUsers.get(socket.id);
            if (!actor)
                return;
            let foundLocally = false;
            for (const [roomId, room] of ekycRooms.entries()) {
                const isWorker = actor.role === 'worker' && room.workerId === actor.userId;
                const isAdmin = actor.role === 'admin' && room.adminId === actor.userId;
                if (!isWorker && !isAdmin)
                    continue;
                foundLocally = true;
                socket.join(roomId);
                socket.emit('ekyc:resume-available', {
                    roomId,
                    role: actor.role,
                    workerId: room.workerId,
                    adminId: room.adminId,
                });
                console.log(`[eKYC] check-resume: ${actor.role} ${actor.userId} resumed into ${roomId}`);
            }
            if (!foundLocally) {
                // Room may be owned by another instance — ask the cluster.
                try {
                    io.serverSideEmit('ekyc:check-resume-sync', { userId: actor.userId, role: actor.role });
                }
                catch { /* no adapter */ }
            }
        });
        // Admin joins eKYC call — clear timeout since call is answered
        socket.on('ekyc:join-room', ({ roomId, adminId }) => {
            if (typeof roomId !== 'string' || !roomId.trim())
                return;
            if (typeof adminId !== 'string' || !adminId.trim())
                return;
            (0, metrics_1.recordSocketEvent)('ekyc:join-room');
            // Always join the room locally so this admin socket receives WebRTC signaling.
            socket.join(roomId);
            // RoomId always encodes the workerId as `ekyc:<workerId>` — derive it so we can
            // reach the worker even when the in-memory room lives on a DIFFERENT server
            // instance (multi-instance AWS deploy behind the Redis adapter).
            const room = ekycRooms.get(roomId);
            const workerId = room?.workerId || roomId.replace(/^ekyc:/, '');
            if (room) {
                // Room is owned by THIS instance — update its state directly.
                room.adminId = adminId;
                if (room.timeoutId) {
                    clearTimeout(room.timeoutId);
                    room.timeoutId = undefined;
                }
                deleteEkycNotifications(room.workerId);
            }
            else {
                // Room lives on another instance — sync the join across the cluster so the
                // owning instance updates adminId + clears its auto-cancel timeout.
                try {
                    io.serverSideEmit('ekyc:admin-joined-sync', { roomId, adminId });
                }
                catch (e) {
                    console.error('[eKYC] serverSideEmit admin-joined-sync failed:', e);
                }
            }
            // Notify the worker. The Redis adapter makes `io.to(...)` cross-instance, so this
            // reaches the worker socket regardless of which instance it connected to.
            io.to(roomId).emit('ekyc:admin-joined', { adminId, roomId });
            if (workerId) {
                io.to(`user:${workerId}`).emit('ekyc:admin-joined', { adminId, roomId });
            }
            console.log(`[eKYC] Admin ${adminId} joined room: ${roomId} (workerId: ${workerId}, localRoom: ${!!room}), socket: ${socket.id}`);
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
            // Process locally if this instance owns the room…
            handleVideoReady(roomId, socket.id);
            // …and forward to the rest of the cluster so the owning instance (which may be
            // different from where this socket connected) can aggregate readiness too.
            try {
                io.serverSideEmit('ekyc:video-ready-sync', { roomId, socketId: socket.id });
            }
            catch (e) {
                console.error('[eKYC] serverSideEmit video-ready-sync failed:', e);
            }
        });
        // WebRTC offer — buffer on server + relay
        socket.on('ekyc:offer', ({ roomId, offer }) => {
            const room = ekycRooms.get(roomId);
            if (room) {
                room.offer = offer;
            }
            else {
                // Buffer on the owning instance (multi-instance deploy).
                try {
                    io.serverSideEmit('ekyc:buffer-offer', { roomId, offer });
                }
                catch { /* no adapter */ }
            }
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
            else {
                // Owning instance may be elsewhere — ask the cluster to deliver it.
                try {
                    io.serverSideEmit('ekyc:request-offer-sync', { roomId, requesterId: socket.id });
                }
                catch { /* no adapter */ }
            }
        });
        // WebRTC answer — relay
        socket.on('ekyc:answer', ({ roomId, answer }) => {
            const room = ekycRooms.get(roomId);
            if (room) {
                room.answer = answer;
            }
            else {
                try {
                    io.serverSideEmit('ekyc:buffer-answer', { roomId, answer });
                }
                catch { /* no adapter */ }
            }
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
            else {
                try {
                    io.serverSideEmit('ekyc:request-answer-sync', { roomId, requesterId: socket.id });
                }
                catch { /* no adapter */ }
            }
        });
        // ICE candidate — buffer + relay
        socket.on('ekyc:ice-candidate', ({ roomId, candidate }) => {
            const room = ekycRooms.get(roomId);
            if (room) {
                room.iceCandidates.push({ from: socket.id, candidate });
            }
            else {
                try {
                    io.serverSideEmit('ekyc:buffer-ice', { roomId, fromSocketId: socket.id, candidate });
                }
                catch { /* no adapter */ }
            }
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
            else {
                try {
                    io.serverSideEmit('ekyc:request-candidates-sync', { roomId, requesterId: socket.id });
                }
                catch { /* no adapter */ }
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
                if (room.graceTimeoutId) {
                    clearTimeout(room.graceTimeoutId);
                    room.graceTimeoutId = undefined;
                }
                deleteEkycNotifications(room.workerId);
                // A real call happened (admin had joined) → admin must now decide completed/incomplete.
                if (room.adminId)
                    void markVideoKycAwaitingResult(room.workerId);
            }
            io.to('role:admin').emit('ekyc:call-ended', { roomId, workerId: room?.workerId, reason: reason || 'manual-end-call' });
            io.to(roomId).emit('ekyc:call-ended', { roomId, workerId: room?.workerId, reason: reason || 'manual-end-call' });
            ekycRooms.delete(roomId);
            (0, metrics_1.setActiveEkycRooms)(ekycRooms.size);
            io.in(roomId).socketsLeave(roomId);
            console.log(`[eKYC] Call ended: ${roomId}, reason: ${reason || 'manual-end-call'}`);
        });
        // A client's peer connection failed but the socket is still alive (e.g. NAT rebind).
        // Force a clean re-handshake on both sides without ending the call.
        socket.on('ekyc:request-reconnect', ({ roomId }) => {
            if (typeof roomId !== 'string' || !roomId.trim())
                return;
            const room = ekycRooms.get(roomId);
            if (!room) {
                socket.emit('ekyc:call-ended', { roomId, reason: 'expired' });
                return;
            }
            (0, metrics_1.recordSocketEvent)('ekyc:request-reconnect');
            socket.join(roomId);
            if (room.graceTimeoutId) {
                clearTimeout(room.graceTimeoutId);
                room.graceTimeoutId = undefined;
            }
            room.interrupted = false;
            room.offer = undefined;
            room.answer = undefined;
            room.iceCandidates = [];
            room.readySockets.clear();
            io.to(roomId).emit('ekyc:reconnect-now', { roomId });
            console.log(`[eKYC] Client-requested reconnect → fresh handshake for room ${roomId}`);
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
                    // A required participant is no longer present in this room.
                    const someoneLeft = !workerStillPresent || (Boolean(room.adminId) && !adminStillPresent);
                    if (!someoneLeft)
                        continue;
                    // Before the admin has joined, there is no live call yet — keep the old
                    // behaviour (the 2-min create-room timeout handles an unanswered call).
                    if (!room.adminId) {
                        if (room.timeoutId)
                            clearTimeout(room.timeoutId);
                        io.to(roomId).emit('ekyc:call-ended', { roomId, workerId: room.workerId, reason: 'participant-disconnected' });
                        io.in(roomId).socketsLeave(roomId);
                        void deleteEkycNotifications(room.workerId);
                        ekycRooms.delete(roomId);
                        (0, metrics_1.setActiveEkycRooms)(ekycRooms.size);
                        console.log(`[eKYC] Room cleaned (admin not joined yet): ${roomId}`);
                        continue;
                    }
                    // Live call dropped → DON'T end. Hold the room for a grace window so the
                    // dropped side can rejoin the SAME call (network blip / app kill / accidental close).
                    if (room.interrupted)
                        continue; // already counting down
                    room.interrupted = true;
                    const side = !workerStillPresent ? 'worker' : 'admin';
                    const payload = { roomId, side, graceSeconds: EKYC_GRACE_MS / 1000 };
                    io.to(roomId).emit('ekyc:participant-interrupted', payload);
                    io.to('role:admin').emit('ekyc:participant-interrupted', payload);
                    if (room.graceTimeoutId)
                        clearTimeout(room.graceTimeoutId);
                    room.graceTimeoutId = setTimeout(() => {
                        const r = ekycRooms.get(roomId);
                        if (!r || !r.interrupted)
                            return; // resumed in time
                        io.to(roomId).emit('ekyc:call-ended', { roomId, workerId: r.workerId, reason: 'grace-expired' });
                        io.to('role:admin').emit('ekyc:call-ended', { roomId, workerId: r.workerId, reason: 'grace-expired' });
                        io.in(roomId).socketsLeave(roomId);
                        void deleteEkycNotifications(r.workerId);
                        // The call had connected (admin joined) but ended on a drop → admin still decides.
                        if (r.adminId)
                            void markVideoKycAwaitingResult(r.workerId);
                        ekycRooms.delete(roomId);
                        (0, metrics_1.setActiveEkycRooms)(ekycRooms.size);
                        console.log(`[eKYC] Grace expired (${EKYC_GRACE_MS / 1000}s), call ended: ${roomId}`);
                    }, EKYC_GRACE_MS);
                    console.log(`[eKYC] ${side} dropped — ${EKYC_GRACE_MS / 1000}s grace started, room held: ${roomId}`);
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