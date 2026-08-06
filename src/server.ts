import http from 'http';
import mongoose from 'mongoose';
import app from './app';
import connectDB from './config/db';
import { closeSocketServer, initializeSocket } from './socket';
import env from './config/env';
import { cancelStaleBookings, cleanupClosedBookingVoiceNotes, notifyDueScheduledBookings } from './jobs/bookingCleanup';
import { closeRateLimiterStore } from './middlewares/rateLimit.middleware';
import { syncSeedAdminCredentials } from './services/adminBootstrap.service';
import { verifyEmailTransport } from './services/email.service';
import logger from './utils/logger';

const server = http.createServer(app);
let cleanupTimer: NodeJS.Timeout | null = null;
let shuttingDown = false;

// Initialize Socket.IO
initializeSocket(server);

server.requestTimeout = env.REQUEST_TIMEOUT_MS;
server.keepAliveTimeout = env.KEEP_ALIVE_TIMEOUT_MS;
server.headersTimeout = Math.max(env.HEADERS_TIMEOUT_MS, env.KEEP_ALIVE_TIMEOUT_MS + 1_000);
(server as any).maxRequestsPerSocket = env.MAX_REQUESTS_PER_SOCKET;

// Connect to MongoDB and start server
const start = async () => {
  await connectDB();
  await syncSeedAdminCredentials();

  // Background job: auto-cancel stale 'finding_workers' bookings
  cleanupTimer = setInterval(() => {
    void cancelStaleBookings();
    void cleanupClosedBookingVoiceNotes();
    void notifyDueScheduledBookings();
  }, env.JOB_CLEANUP_INTERVAL_MS);
  cleanupTimer.unref();
  
  // Probe SMTP once at boot. Deliberately not awaited and never fatal: a revoked app password
  // must not stop the API from serving, but it should be visible in the startup logs rather
  // than only surfacing as users failing to receive OTPs.
  void verifyEmailTransport();

  server.listen(env.PORT, () => {
    logger.info('Fixo server started', { port: env.PORT, env: env.NODE_ENV });
    logger.debug('Startup config', {
      trustedOrigins: env.CLIENT_URLS,
      googleClientIdCount: env.GOOGLE_CLIENT_IDS.length,
    });
  });
};

const gracefulShutdown = async (reason: string): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.warn('Server shutting down', { reason });

  const hardTimeout = setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 15_000);
  hardTimeout.unref();

  try {
    if (cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }

    await closeSocketServer();

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });

    await closeRateLimiterStore();
    await mongoose.disconnect();
    clearTimeout(hardTimeout);
    process.exit(0);
  } catch (error) {
    logger.error('Graceful shutdown failed', { err: error });
    clearTimeout(hardTimeout);
    process.exit(1);
  }
};

start().catch((error) => {
  logger.error('Failed to start server', { err: error });
  process.exit(1);
});

process.on('SIGINT', () => {
  void gracefulShutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void gracefulShutdown('SIGTERM');
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { err: reason });
  void gracefulShutdown('unhandledRejection');
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { err: error });
  void gracefulShutdown('uncaughtException');
});
