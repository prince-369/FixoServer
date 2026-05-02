"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const mongoose_1 = __importDefault(require("mongoose"));
const app_1 = __importDefault(require("./app"));
const db_1 = __importDefault(require("./config/db"));
const socket_1 = require("./socket");
const env_1 = __importDefault(require("./config/env"));
const bookingCleanup_1 = require("./jobs/bookingCleanup");
const rateLimit_middleware_1 = require("./middlewares/rateLimit.middleware");
const server = http_1.default.createServer(app_1.default);
let cleanupTimer = null;
let shuttingDown = false;
// Initialize Socket.IO
(0, socket_1.initializeSocket)(server);
server.requestTimeout = env_1.default.REQUEST_TIMEOUT_MS;
server.keepAliveTimeout = env_1.default.KEEP_ALIVE_TIMEOUT_MS;
server.headersTimeout = Math.max(env_1.default.HEADERS_TIMEOUT_MS, env_1.default.KEEP_ALIVE_TIMEOUT_MS + 1000);
server.maxRequestsPerSocket = env_1.default.MAX_REQUESTS_PER_SOCKET;
// Connect to MongoDB and start server
const start = async () => {
    await (0, db_1.default)();
    // Background job: auto-cancel stale 'finding_workers' bookings
    cleanupTimer = setInterval(() => {
        void (0, bookingCleanup_1.cancelStaleBookings)();
    }, env_1.default.JOB_CLEANUP_INTERVAL_MS);
    cleanupTimer.unref();
    server.listen(env_1.default.PORT, () => {
        console.log(`Fixo server running on port ${env_1.default.PORT}`);
        console.log(`Environment: ${env_1.default.NODE_ENV}`);
        console.log(`Trusted origins: ${env_1.default.CLIENT_URLS.join(', ')}`);
    });
};
const gracefulShutdown = async (reason) => {
    if (shuttingDown)
        return;
    shuttingDown = true;
    console.warn(`Shutting down server (${reason})`);
    const hardTimeout = setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
    }, 15000);
    hardTimeout.unref();
    try {
        if (cleanupTimer) {
            clearInterval(cleanupTimer);
            cleanupTimer = null;
        }
        await (0, socket_1.closeSocketServer)();
        await new Promise((resolve) => {
            server.close(() => resolve());
        });
        await (0, rateLimit_middleware_1.closeRateLimiterStore)();
        await mongoose_1.default.disconnect();
        clearTimeout(hardTimeout);
        process.exit(0);
    }
    catch (error) {
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
//# sourceMappingURL=server.js.map