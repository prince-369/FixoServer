import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import Redis from 'ioredis';
import type { RedisOptions } from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';
import env from '../config/env';
import Notification from '../models/Notification';
import Admin from '../models/Admin';
import { verifyAccessToken } from '../utils/generateToken';
import { sendWebPushNotification } from '../services/webPush.service';
import { sendMobilePushNotification } from '../services/mobilePush.service';
import {
  recordSocketConnected,
  recordSocketDisconnected,
  recordSocketEvent,
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

export interface SocketAuth {
  id: string;
  role: 'customer' | 'worker' | 'admin';
}

// Authenticate a Socket.IO handshake from its access token.
// Returns the verified identity, or null when no valid token is presented.
// Identity is ONLY ever derived from a verified token here — never from the
// client-supplied `register` payload — which closes the impersonation bypass.
export const authenticateHandshake = (handshake: {
  auth?: { token?: unknown } | null;
  headers?: Record<string, unknown>;
}): SocketAuth | null => {
  try {
    const authToken = typeof handshake.auth?.token === 'string' ? handshake.auth.token : undefined;
    const headerAuthRaw = handshake.headers?.authorization;
    const headerAuth = typeof headerAuthRaw === 'string' ? headerAuthRaw : undefined;
    const headerToken = headerAuth?.startsWith('Bearer ') ? headerAuth.slice(7) : undefined;
    const token = authToken || headerToken;

    if (!token) return null;

    const decoded = verifyAccessToken(token);
    if (!decoded?.id || !decoded?.role) return null;

    return { id: decoded.id, role: decoded.role };
  } catch {
    return null;
  }
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

  void setupSocketRedisAdapter();

  io.use((socket, next) => {
    // Reject any socket that does not present a valid access token. A missing or
    // invalid/expired token is unauthorized — we never fall back to trusting
    // client-supplied identity.
    const auth = authenticateHandshake(socket.handshake);
    if (!auth) {
      next(new Error('unauthorized'));
      return;
    }
    socket.data.auth = auth;
    next();
  });

  io.on('connection', (socket: Socket) => {
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
    };

    const authData = socket.data.auth as SocketAuth | undefined;
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
        recordSocketEvent('register');
      }
    });

    // ─── Worker goes active/inactive ───
    socket.on('worker:toggle-active', ({ isActive }: { isActive?: boolean }) => {
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
