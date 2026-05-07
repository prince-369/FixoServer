import http from 'http';
import mongoose from 'mongoose';
import app from './app';
import connectDB from './config/db';
import { closeSocketServer, initializeSocket } from './socket';
import env from './config/env';
import { cancelStaleBookings } from './jobs/bookingCleanup';
import { closeRateLimiterStore } from './middlewares/rateLimit.middleware';
import { syncSeedAdminCredentials } from './services/adminBootstrap.service';

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
  }, env.JOB_CLEANUP_INTERVAL_MS);
  cleanupTimer.unref();
  
  server.listen(env.PORT, () => {
    console.log(`Fixo server running on port ${env.PORT}`);
    console.log(`Environment: ${env.NODE_ENV}`);
    console.log(`Trusted origins: ${env.CLIENT_URLS.join(', ')}`);
    console.log(`Google OAuth client IDs loaded: ${env.GOOGLE_CLIENT_IDS.length ? env.GOOGLE_CLIENT_IDS.join(', ') : '(none)'}`);
  });
};

const gracefulShutdown = async (reason: string): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;

  console.warn(`Shutting down server (${reason})`);

  const hardTimeout = setTimeout(() => {
    console.error('Forced shutdown after timeout');
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
    console.error('Graceful shutdown failed:', error);
    clearTimeout(hardTimeout);
    process.exit(1);
  }
};

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

process.on('SIGINT', () => {
  void gracefulShutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void gracefulShutdown('SIGTERM');
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
  void gracefulShutdown('unhandledRejection');
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  void gracefulShutdown('uncaughtException');
});
