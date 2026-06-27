import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import Redis from 'ioredis';
import type { RedisOptions } from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';
import env from '../config/env';
import Notification from '../models/Notification';
import Admin from '../models/Admin';
import Worker from '../models/Worker';
import { verifyAccessToken } from '../utils/generateToken';
import { sendWebPushNotification } from '../services/webPush.service';
import { sendMobilePushNotification } from '../services/mobilePush.service';
import {
  recordSocketConnected,
  recordSocketDisconnected,
  recordSocketEvent,
  setActiveEkycRooms,
} from '../monitoring/metrics';

let io!: SocketIOServer;
let isSocketInitialized = false;
let redisPubClient: Redis | null = null;
let redisSubClient: Redis | null = null;

const buildRedisOptions = (redisUrl: string): RedisOptions => {
  const options: RedisOptions = {
    lazyConnect: true,
    connectTimeout: 10_000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  };

  if (redisUrl.startsWith('rediss://')) {
    options.tls = {};
  }

  return options;
};

const toAlternateRedisScheme = (redisUrl: string): string | null => {
  if (redisUrl.startsWith('rediss://')) {
    return `redis://${redisUrl.slice('rediss://'.length)}`;
  }
  if (redisUrl.startsWith('redis://')) {
    return `rediss://${redisUrl.slice('redis://'.length)}`;
  }
  return null;
};

const isLikelyProtocolMismatch = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('err_ssl_packet_length_too_long') ||
    message.includes('packet length too long') ||
    message.includes("stream isn't writeable") ||
    message.includes('connection is closed') ||
    message.includes('ssl routines')
  );
};

// Track connected users: { socketId: { userId, role } }
const connectedUsers = new Map<string, { userId: string; role: string }>();
// Reverse map: userId -> socketId (for quick lookup)
const userSocketMap = new Map<string, string>();
// Multi-tab support: userId -> all active socketIds
const userSocketsMap = new Map<string, Set<string>>();

type EkycNotifyAck = (response: { ok: boolean; message?: string }) => void;

type VideoKycRetryState = {
  blocked: boolean;
  retryAvailableAt?: Date;
  reason?: string;
};

// Track active eKYC video call rooms
// How long a live eKYC call survives after a participant drops (network blip / app kill / accidental close).
// If they rejoin within this window, the SAME call resumes automatically — no restart.
const EKYC_GRACE_MS = 120 * 1000;

const ekycRooms = new Map<string, {
  workerId: string;
  adminId?: string;
  workerName: string;
  workerPhone: string;
  createdAt: Date;
  // WebRTC signaling buffers
  offer?: any;
  answer?: any;
  iceCandidates: { from: string; candidate: any }[];
  readySockets: Set<string>;
  timeoutId?: ReturnType<typeof setTimeout>;
  // Reconnect grace state
  interrupted?: boolean;
  graceTimeoutId?: ReturnType<typeof setTimeout>;
}>();

// After a live video-KYC call ends, flag the worker so the admin's "was the call OK?"
// (completed / incomplete) decision survives a page reload, network drop or app close.
// The flag is cleared once the admin marks completed/incomplete or approves/rejects.
const markVideoKycAwaitingResult = async (workerId: string) => {
  try {
    await Worker.updateOne(
      { _id: workerId, accountStatus: { $in: ['test', 'ekyc_pending'] } },
      { $set: { videoKycAwaitingResult: true, videoKycCallEndedAt: new Date() } },
    );
    console.log(`[eKYC] Worker ${workerId} flagged awaiting video-KYC result`);
  } catch (e) {
    console.error('[eKYC] Failed to flag awaiting result:', e);
  }
};

// Helper: delete eKYC notifications for a worker from all admins
const deleteEkycNotifications = async (workerId: string) => {
  try {
    await Notification.deleteMany({
      type: { $in: ['ekyc_preparing', 'ekyc_waiting'] },
      'data.workerId': workerId,
    });
    console.log(`[eKYC] Deleted eKYC notifications for worker ${workerId}`);
  } catch (e) {
    console.error('[eKYC] Failed to delete notifications:', e);
  }
};

const getVideoKycRetryState = async (workerId: string): Promise<VideoKycRetryState> => {
  try {
    const worker = await Worker.findById(workerId).select('videoKycRetryAvailableAt videoKycIncompleteReason');
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
  } catch (error) {
    console.error('[eKYC] Failed to resolve retry state:', error);
    return { blocked: false };
  }
};

const emitRetryBlocked = (socket: Socket, workerId: string, retryAvailableAt: Date, reason?: string) => {
  const retrySecondsLeft = Math.max(1, Math.ceil((retryAvailableAt.getTime() - Date.now()) / 1000));
  socket.emit('ekyc:retry-blocked', {
    workerId,
    reason,
    retrySecondsLeft,
    retryAvailableAt: retryAvailableAt.toISOString(),
  });
};

const setupSocketRedisAdapter = async (): Promise<void> => {
  if (!env.REDIS_URL || !isSocketInitialized) return;

  const connectAdapterWithUrl = async (redisUrl: string): Promise<void> => {
    redisPubClient = new Redis(redisUrl, buildRedisOptions(redisUrl));
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

  const resetAdapterClients = (): void => {
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
    await connectAdapterWithUrl(env.REDIS_URL);
  } catch (error) {
    const alternateRedisUrl = toAlternateRedisScheme(env.REDIS_URL);
    if (!alternateRedisUrl || !isLikelyProtocolMismatch(error)) {
      console.error('Failed to initialize Socket Redis adapter. Continuing without adapter.', error);
      resetAdapterClients();
      return;
    }

    console.warn(`Socket Redis TLS mismatch for ${env.REDIS_URL}. Retrying with ${alternateRedisUrl}.`);
    resetAdapterClients();

    try {
      await connectAdapterWithUrl(alternateRedisUrl);
    } catch (retryError) {
      console.error('Failed to initialize Socket Redis adapter. Continuing without adapter.', retryError);
      resetAdapterClients();
      return;
    }
  }

  io.adapter(createAdapter(redisPubClient, redisSubClient));
  console.log('Socket Redis adapter enabled');
};

export const initializeSocket = (server: HTTPServer): SocketIOServer => {
  io = new SocketIOServer(server, {
    transports: ['websocket', 'polling'],
    maxHttpBufferSize: env.SOCKET_MAX_HTTP_BUFFER_SIZE,
    pingInterval: env.SOCKET_PING_INTERVAL_MS,
    pingTimeout: env.SOCKET_PING_TIMEOUT_MS,
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: true,
    },
    cors: {
      origin: (origin, callback) => {
        if (!origin || env.CLIENT_URLS.includes(origin)) {
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
  setActiveEkycRooms(0);

  void setupSocketRedisAdapter();

  io.use((socket, next) => {
    try {
      const authToken = socket.handshake.auth?.token as string | undefined;
      const headerAuth = socket.handshake.headers.authorization as string | undefined;
      const headerToken = headerAuth?.startsWith('Bearer ') ? headerAuth.slice(7) : undefined;
      const token = authToken || headerToken;

      if (!token) {
        next();
        return;
      }

      const decoded = verifyAccessToken(token);
      socket.data.auth = decoded;
      next();
    } catch {
      // Allow connection even with invalid/expired token — manual 'register' event will handle identity
      console.warn('Socket auth failed (expired token?), allowing unauthenticated connection');
      next();
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);
    recordSocketConnected(socket.conn.transport.name || 'unknown');

    const registerSocketUser = (userId: string, role: string) => {
      connectedUsers.set(socket.id, { userId, role });

      if (!userSocketsMap.has(userId)) {
        userSocketsMap.set(userId, new Set());
      }
      userSocketsMap.get(userId)!.add(socket.id);

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
        if (!room.interrupted) continue;
        const isWorker = role === 'worker' && room.workerId === userId;
        const isAdmin = role === 'admin' && room.adminId === userId;
        if (!isWorker && !isAdmin) continue;
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

    const authData = socket.data.auth as { id: string; role: 'customer' | 'worker' | 'admin' } | undefined;
    if (authData?.id && authData?.role) {
      registerSocketUser(authData.id, authData.role);
    }

    // ─── Register user ───
    socket.on('register', ({ userId, role }: { userId: string; role: string }) => {
      const tokenUserId = authData?.id;
      const tokenRole = authData?.role;

      if (tokenUserId && tokenRole) {
        if (tokenUserId !== userId || tokenRole !== role) {
          socket.emit('socket:error', { message: 'Socket identity mismatch' });
          return;
        }
      }

      registerSocketUser(tokenUserId || userId, tokenRole || role);
      recordSocketEvent('register');
    });

    // ─── Admin marks themself as available for worker eKYC ───
    socket.on(
      'ekyc:notify-availability',
      async (
        { workerId }: { workerId?: string },
        ack?: EkycNotifyAck,
      ) => {
        const sendAck = (ok: boolean, message?: string) => {
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
        recordSocketEvent('ekyc:notify-availability');

        try {
          // Keep only the latest unread availability ping to avoid notification spam.
          await Notification.deleteMany({
            recipient: targetWorkerId,
            recipientModel: 'Worker',
            type: 'ekyc_admin_available',
            isRead: false,
          });

          await sendNotification({
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
        } catch (error) {
          console.error('[eKYC] Failed to notify worker availability:', error);
          sendAck(false, 'Failed to notify worker right now. Please try again.');
        }
      },
    );

    // ─── Worker goes active/inactive ───
    socket.on('worker:toggle-active', ({ workerId, isActive }) => {
      if (isActive) {
        socket.join('workers:active');
      } else {
        socket.leave('workers:active');
      }
    });

    // ─── Worker live location update ───
    socket.on('worker:location-update', ({ bookingId, coordinates }: { bookingId: string; coordinates: number[] }) => {
      if (typeof bookingId !== 'string' || !bookingId.trim()) return;
      if (!Array.isArray(coordinates) || coordinates.length !== 2) return;
      if (!coordinates.every((value) => Number.isFinite(value))) return;

      const userData = connectedUsers.get(socket.id);
      if (userData) {
        recordSocketEvent('worker:location-update');
        io.to(`booking:${bookingId}`).emit('worker:location-changed', {
          bookingId,
          workerId: userData.userId,
          coordinates,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // ─── Join booking room (for live tracking) ───
    socket.on('booking:join', ({ bookingId }: { bookingId: string }) => {
      if (typeof bookingId !== 'string' || !bookingId.trim()) return;
      socket.join(`booking:${bookingId}`);
    });

    socket.on('booking:leave', ({ bookingId }: { bookingId: string }) => {
      if (typeof bookingId !== 'string' || !bookingId.trim()) return;
      socket.leave(`booking:${bookingId}`);
    });

    // ─── WebRTC eKYC Video Call Signaling ───

    // Worker is preparing for eKYC (30s countdown started) — notify admins
    socket.on('ekyc:worker-preparing', async ({ workerId, workerName, workerPhone, countdownSeconds }: { workerId: string; workerName?: string; workerPhone?: string; countdownSeconds?: number }) => {
      if (typeof workerId !== 'string' || !workerId.trim()) return;

      const retryState = await getVideoKycRetryState(workerId);
      if (retryState.blocked && retryState.retryAvailableAt) {
        emitRetryBlocked(socket, workerId, retryState.retryAvailableAt, retryState.reason);
        return;
      }

      recordSocketEvent('ekyc:worker-preparing');
      const name = workerName || 'Worker';
      const phone = workerPhone || '';
      const seconds = countdownSeconds || 30;
      io.to('role:admin').emit('ekyc:worker-preparing', { workerId, workerName: name, workerPhone: phone, countdownSeconds: seconds });
      console.log(`[eKYC] Worker ${name} (${workerId}) preparing (${seconds}s) — admins notified`);

      // Also send a persistent notification so NotificationBell fires browser notification + toast
      sendAdminNotification({
        type: 'ekyc_preparing',
        title: 'Video KYC Incoming',
        message: `${name} is starting Video KYC in ${seconds} seconds — get ready!`,
        data: { workerId, workerName: name, workerPhone: phone },
      });
    });

    // Worker cancels during countdown (before room creation)
    socket.on('ekyc:cancel-preparing', ({ workerId }: { workerId: string }) => {
      recordSocketEvent('ekyc:cancel-preparing');
      io.to('role:admin').emit('ekyc:call-ended', { workerId, reason: 'worker-cancelled-preparing' });
      deleteEkycNotifications(workerId);
      console.log(`[eKYC] Worker ${workerId} cancelled during preparation`);
    });

    // Worker initiates eKYC call room
    socket.on('ekyc:create-room', async ({ workerId, workerName, workerPhone }: { workerId: string; workerName?: string; workerPhone?: string }) => {
      if (typeof workerId !== 'string' || !workerId.trim()) return;

      const retryState = await getVideoKycRetryState(workerId);
      if (retryState.blocked && retryState.retryAvailableAt) {
        emitRetryBlocked(socket, workerId, retryState.retryAvailableAt, retryState.reason);
        return;
      }

      recordSocketEvent('ekyc:create-room');
      const roomId = `ekyc:${workerId}`;
      const name = workerName || 'Worker';
      const phone = workerPhone || '';
      ekycRooms.set(roomId, {
        workerId, workerName: name, workerPhone: phone,
        createdAt: new Date(), iceCandidates: [], readySockets: new Set(),
      });
      setActiveEkycRooms(ekycRooms.size);
      socket.join(roomId);
      io.to('role:admin').emit('ekyc:worker-waiting', { workerId, roomId, workerName: name, workerPhone: phone });
      console.log(`[eKYC] Room created: ${roomId} by socket ${socket.id}`);

      // Persistent notification for the actual call waiting
      sendAdminNotification({
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
            setActiveEkycRooms(ekycRooms.size);
            deleteEkycNotifications(workerId);
            console.log(`[eKYC] Call timed out (2min): ${roomId}`);
          }
        }, 2 * 60 * 1000);
      }
    });

    // Admin joins eKYC call — clear timeout since call is answered
    socket.on('ekyc:join-room', ({ roomId, adminId }: { roomId: string; adminId: string }) => {
      if (typeof roomId !== 'string' || !roomId.trim()) return;
      if (typeof adminId !== 'string' || !adminId.trim()) return;
      const room = ekycRooms.get(roomId);
      if (room) {
        recordSocketEvent('ekyc:join-room');
        room.adminId = adminId;
        if (room.timeoutId) { clearTimeout(room.timeoutId); room.timeoutId = undefined; }
        socket.join(roomId);
        io.to(roomId).emit('ekyc:admin-joined', { adminId, roomId });
        deleteEkycNotifications(room.workerId);
        console.log(`[eKYC] Admin ${adminId} joined room: ${roomId}, socket: ${socket.id}`);
      }
    });

    // Admin rejects/declines the incoming call
    socket.on('ekyc:reject-call', ({ roomId }: { roomId: string }) => {
      const room = ekycRooms.get(roomId);
      if (room) {
        recordSocketEvent('ekyc:reject-call');
        if (room.timeoutId) { clearTimeout(room.timeoutId); room.timeoutId = undefined; }
        io.to(roomId).emit('ekyc:call-rejected');
        io.to('role:admin').emit('ekyc:call-ended', { roomId, workerId: room.workerId, reason: 'admin-rejected-call' });
        io.in(roomId).socketsLeave(roomId);
        deleteEkycNotifications(room.workerId);
        ekycRooms.delete(roomId);
        setActiveEkycRooms(ekycRooms.size);
        console.log(`[eKYC] Call rejected by admin: ${roomId}`);
      }
    });

    // ── Both sides signal "my VideoCall component is ready" ──
    // Server tracks which sockets are ready; when 2 sockets are ready, tells the initiator to create offer
    socket.on('ekyc:video-ready', ({ roomId }: { roomId: string }) => {
      socket.join(roomId); // Ensure room membership
      const room = ekycRooms.get(roomId);
      if (!room) { console.log(`[eKYC] video-ready: room ${roomId} not found`); return; }

      // A participant came back during the grace window → resume this call.
      // Clear the grace timer, wipe the stale WebRTC handshake, and ask BOTH sides
      // to re-run a clean negotiation so the live call continues from where it left off.
      if (room.interrupted) {
        if (room.graceTimeoutId) { clearTimeout(room.graceTimeoutId); room.graceTimeoutId = undefined; }
        room.interrupted = false;
        room.offer = undefined;
        room.answer = undefined;
        room.iceCandidates = [];
        room.readySockets.clear();
        io.to(roomId).emit('ekyc:reconnect-now', { roomId });
        io.to('role:admin').emit('ekyc:reconnect-now', { roomId });
        console.log(`[eKYC] Reconnect during grace → fresh handshake for room ${roomId}`);
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
    socket.on('ekyc:offer', ({ roomId, offer }: { roomId: string; offer: any }) => {
      const room = ekycRooms.get(roomId);
      if (room) room.offer = offer;
      console.log(`[eKYC] Offer received from ${socket.id}, relaying to room ${roomId}`);
      socket.to(roomId).emit('ekyc:offer', { offer });
    });

    // Admin requests the buffered offer (in case it missed the relay)
    socket.on('ekyc:request-offer', ({ roomId }: { roomId: string }) => {
      const room = ekycRooms.get(roomId);
      if (room?.offer) {
        console.log(`[eKYC] Sending buffered offer to ${socket.id}`);
        socket.emit('ekyc:offer', { offer: room.offer });
      }
    });

    // WebRTC answer — relay
    socket.on('ekyc:answer', ({ roomId, answer }: { roomId: string; answer: any }) => {
      const room = ekycRooms.get(roomId);
      if (room) room.answer = answer;
      console.log(`[eKYC] Answer received from ${socket.id}, relaying to room ${roomId}`);
      socket.to(roomId).emit('ekyc:answer', { answer });
    });

    // Worker requests buffered answer (if relay was missed)
    socket.on('ekyc:request-answer', ({ roomId }: { roomId: string }) => {
      const room = ekycRooms.get(roomId);
      if (room?.answer) {
        console.log(`[eKYC] Sending buffered answer to ${socket.id}`);
        socket.emit('ekyc:answer', { answer: room.answer });
      }
    });

    // ICE candidate — buffer + relay
    socket.on('ekyc:ice-candidate', ({ roomId, candidate }: { roomId: string; candidate: any }) => {
      const room = ekycRooms.get(roomId);
      if (room) room.iceCandidates.push({ from: socket.id, candidate });
      socket.to(roomId).emit('ekyc:ice-candidate', { candidate });
    });

    // Request buffered ICE candidates (in case some were missed)
    socket.on('ekyc:request-candidates', ({ roomId }: { roomId: string }) => {
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
    socket.on('ekyc:end-call', ({ roomId, reason }: { roomId: string; reason?: string }) => {
      if (typeof roomId !== 'string' || !roomId.trim()) return;
      recordSocketEvent('ekyc:end-call');
      const room = ekycRooms.get(roomId);
      if (room) {
        if (room.timeoutId) { clearTimeout(room.timeoutId); room.timeoutId = undefined; }
        if (room.graceTimeoutId) { clearTimeout(room.graceTimeoutId); room.graceTimeoutId = undefined; }
        deleteEkycNotifications(room.workerId);
        // A real call happened (admin had joined) → admin must now decide completed/incomplete.
        if (room.adminId) void markVideoKycAwaitingResult(room.workerId);
      }
      io.to('role:admin').emit('ekyc:call-ended', { roomId, workerId: room?.workerId, reason: reason || 'manual-end-call' });
      io.to(roomId).emit('ekyc:call-ended', { roomId, workerId: room?.workerId, reason: reason || 'manual-end-call' });
      ekycRooms.delete(roomId);
      setActiveEkycRooms(ekycRooms.size);
      io.in(roomId).socketsLeave(roomId);
      console.log(`[eKYC] Call ended: ${roomId}, reason: ${reason || 'manual-end-call'}`);
    });

    // A client's peer connection failed but the socket is still alive (e.g. NAT rebind).
    // Force a clean re-handshake on both sides without ending the call.
    socket.on('ekyc:request-reconnect', ({ roomId }: { roomId: string }) => {
      if (typeof roomId !== 'string' || !roomId.trim()) return;
      const room = ekycRooms.get(roomId);
      if (!room) { socket.emit('ekyc:call-ended', { roomId, reason: 'expired' }); return; }
      recordSocketEvent('ekyc:request-reconnect');
      socket.join(roomId);
      if (room.graceTimeoutId) { clearTimeout(room.graceTimeoutId); room.graceTimeoutId = undefined; }
      room.interrupted = false;
      room.offer = undefined;
      room.answer = undefined;
      room.iceCandidates = [];
      room.readySockets.clear();
      io.to(roomId).emit('ekyc:reconnect-now', { roomId });
      console.log(`[eKYC] Client-requested reconnect → fresh handshake for room ${roomId}`);
    });

    // Admin commands worker to switch camera (front/back)
    socket.on('ekyc:switch-camera', ({ roomId, facing }: { roomId: string; facing: 'user' | 'environment' }) => {
      // Relay to the worker (other side in the room)
      socket.to(roomId).emit('ekyc:switch-camera', { facing });
      console.log(`[eKYC] Camera switch to ${facing} requested in room ${roomId}`);
    });

    // Admin requests worker to capture their camera frame
    socket.on('ekyc:request-capture', ({ roomId }: { roomId: string }) => {
      socket.to(roomId).emit('ekyc:request-capture', { roomId });
      console.log(`[eKYC] Capture requested in room ${roomId}`);
    });

    // Worker sends captured frame back to admin
    socket.on('ekyc:capture-result', ({ roomId, imageData }: { roomId: string; imageData: string }) => {
      socket.to(roomId).emit('ekyc:capture-result', { imageData });
      console.log(`[eKYC] Capture result relayed in room ${roomId}`);
    });

    // ─── Worker ETA / message to customer (real-time) ───
    socket.on('worker:send-message', ({ bookingId, message }: { bookingId: string; message: string }) => {
      if (typeof bookingId !== 'string' || !bookingId.trim()) return;
      if (typeof message !== 'string' || !message.trim()) return;

      const userData = connectedUsers.get(socket.id);
      if (userData) {
        recordSocketEvent('worker:send-message');
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
          } else {
            const [nextSocketId] = socketSet;
            if (nextSocketId) userSocketMap.set(userData.userId, nextSocketId);
          }
        }

        const isUserPresentInRoom = (userId: string, roomId: string): boolean => {
          const userSockets = userSocketsMap.get(userId);
          if (!userSockets || userSockets.size === 0) return false;

          const roomSockets = io.sockets.adapter.rooms.get(roomId);
          if (!roomSockets || roomSockets.size === 0) return false;

          for (const sid of userSockets) {
            if (roomSockets.has(sid)) return true;
          }

          return false;
        };

        // Clean up eKYC rooms only when a participant has actually left the room.
        // This avoids false call-end events when another tab/socket of same user disconnects.
        for (const [roomId, room] of ekycRooms.entries()) {
          const isWorkerRoom = room.workerId === userData.userId;
          const isAdminRoom = room.adminId === userData.userId;
          if (!isWorkerRoom && !isAdminRoom) continue;

          room.readySockets.delete(socket.id);

          const workerStillPresent = isUserPresentInRoom(room.workerId, roomId);
          const adminStillPresent = room.adminId ? isUserPresentInRoom(room.adminId, roomId) : false;

          // A required participant is no longer present in this room.
          const someoneLeft = !workerStillPresent || (Boolean(room.adminId) && !adminStillPresent);
          if (!someoneLeft) continue;

          // Before the admin has joined, there is no live call yet — keep the old
          // behaviour (the 2-min create-room timeout handles an unanswered call).
          if (!room.adminId) {
            if (room.timeoutId) clearTimeout(room.timeoutId);
            io.to(roomId).emit('ekyc:call-ended', { roomId, workerId: room.workerId, reason: 'participant-disconnected' });
            io.in(roomId).socketsLeave(roomId);
            void deleteEkycNotifications(room.workerId);
            ekycRooms.delete(roomId);
            setActiveEkycRooms(ekycRooms.size);
            console.log(`[eKYC] Room cleaned (admin not joined yet): ${roomId}`);
            continue;
          }

          // Live call dropped → DON'T end. Hold the room for a grace window so the
          // dropped side can rejoin the SAME call (network blip / app kill / accidental close).
          if (room.interrupted) continue; // already counting down

          room.interrupted = true;
          const side: 'worker' | 'admin' = !workerStillPresent ? 'worker' : 'admin';
          const payload = { roomId, side, graceSeconds: EKYC_GRACE_MS / 1000 };
          io.to(roomId).emit('ekyc:participant-interrupted', payload);
          io.to('role:admin').emit('ekyc:participant-interrupted', payload);

          if (room.graceTimeoutId) clearTimeout(room.graceTimeoutId);
          room.graceTimeoutId = setTimeout(() => {
            const r = ekycRooms.get(roomId);
            if (!r || !r.interrupted) return; // resumed in time
            io.to(roomId).emit('ekyc:call-ended', { roomId, workerId: r.workerId, reason: 'grace-expired' });
            io.to('role:admin').emit('ekyc:call-ended', { roomId, workerId: r.workerId, reason: 'grace-expired' });
            io.in(roomId).socketsLeave(roomId);
            void deleteEkycNotifications(r.workerId);
            // The call had connected (admin joined) but ended on a drop → admin still decides.
            if (r.adminId) void markVideoKycAwaitingResult(r.workerId);
            ekycRooms.delete(roomId);
            setActiveEkycRooms(ekycRooms.size);
            console.log(`[eKYC] Grace expired (${EKYC_GRACE_MS / 1000}s), call ended: ${roomId}`);
          }, EKYC_GRACE_MS);

          console.log(`[eKYC] ${side} dropped — ${EKYC_GRACE_MS / 1000}s grace started, room held: ${roomId}`);
        }
      }
      connectedUsers.delete(socket.id);
      recordSocketDisconnected(reason || 'unknown');
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = (): SocketIOServer => {
  if (!isSocketInitialized) throw new Error('Socket.IO not initialized');
  return io;
};

// Send notification to specific user
export const notifyUser = (userId: string, event: string, data: unknown): void => {
  if (isSocketInitialized) {
    io.to(`user:${userId}`).emit(event, data);
  }
};

// Send notification to all active workers
export const notifyActiveWorkers = (event: string, data: unknown): void => {
  if (isSocketInitialized) {
    io.to('workers:active').emit(event, data);
  }
};

// Send notification to specific workers by IDs
export const notifyWorkers = (workerIds: string[], event: string, data: unknown): void => {
  if (isSocketInitialized) {
    workerIds.forEach((id) => {
      io.to(`user:${id}`).emit(event, data);
    });
  }
};

// Send notification to a role room
export const notifyRole = (role: string, event: string, data: unknown): void => {
  if (isSocketInitialized) {
    io.to(`role:${role}`).emit(event, data);
  }
};

// Send event to a booking room
export const notifyBookingRoom = (bookingId: string, event: string, data: unknown): void => {
  if (isSocketInitialized) {
    io.to(`booking:${bookingId}`).emit(event, data);
  }
};

// Check if user is online
export const isUserOnline = (userId: string): boolean => {
  return (userSocketsMap.get(userId)?.size || 0) > 0;
};

// Get active eKYC rooms
export const getActiveEKYCRooms = (): Map<string, { workerId: string; adminId?: string; createdAt: Date }> => {
  return ekycRooms;
};

let adminCache: { ids: string[]; expiresAt: number } | null = null;

const getAdminIds = async (): Promise<string[]> => {
  const now = Date.now();
  if (adminCache && adminCache.expiresAt > now) {
    return adminCache.ids;
  }

  const admins = await Admin.find().select('_id').lean();
  const ids = admins.map((admin) => admin._id.toString());
  adminCache = {
    ids,
    expiresAt: now + 15_000,
  };
  return ids;
};

// ─── Create notification in DB + emit via socket in one call ───
export const sendNotification = async (params: {
  recipientId: string;
  recipientModel: 'User' | 'Worker' | 'Admin';
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}): Promise<void> => {
  try {
    const notification = await Notification.create({
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
      sendWebPushNotification(pushPayload),
      sendMobilePushNotification(pushPayload),
    ]);
  } catch (error) {
    console.error('sendNotification error:', error);
  }
};

// ─── Create notification for ALL admins in DB + emit via socket ───
export const sendAdminNotification = async (params: {
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}): Promise<void> => {
  try {
    const adminIds = await getAdminIds();
    await Promise.all(
      adminIds.map((adminId) =>
        sendNotification({
          recipientId: adminId,
          recipientModel: 'Admin',
          type: params.type,
          title: params.title,
          message: params.message,
          data: params.data,
        })
      )
    );
  } catch (error) {
    console.error('sendAdminNotification error:', error);
  }
};

export const closeSocketServer = async (): Promise<void> => {
  for (const room of ekycRooms.values()) {
    if (room.timeoutId) {
      clearTimeout(room.timeoutId);
    }
  }
  ekycRooms.clear();
  setActiveEkycRooms(0);

  if (isSocketInitialized) {
    await new Promise<void>((resolve) => {
      io.close(() => resolve());
    });
    isSocketInitialized = false;
  }

  if (redisPubClient) {
    try {
      await redisPubClient.quit();
    } catch {
      redisPubClient.disconnect();
    }
    redisPubClient = null;
  }

  if (redisSubClient) {
    try {
      await redisSubClient.quit();
    } catch {
      redisSubClient.disconnect();
    }
    redisSubClient = null;
  }
};
