"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const mongoose_1 = __importDefault(require("mongoose"));
const crypto_1 = require("crypto");
const env_1 = __importDefault(require("./config/env"));
const error_middleware_1 = require("./middlewares/error.middleware");
const rateLimit_middleware_1 = require("./middlewares/rateLimit.middleware");
const metrics_1 = require("./monitoring/metrics");
// Import routes
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const customer_routes_1 = __importDefault(require("./routes/customer.routes"));
const worker_routes_1 = __importDefault(require("./routes/worker.routes"));
const booking_routes_1 = __importDefault(require("./routes/booking.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const notification_routes_1 = __importDefault(require("./routes/notification.routes"));
const app = (0, express_1.default)();
const allowedOrigins = new Set(env_1.default.CLIENT_URLS);
// Security & parsing middleware
app.use((0, helmet_1.default)());
app.disable('x-powered-by');
app.set('trust proxy', env_1.default.TRUST_PROXY);
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.has(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error('CORS origin not allowed'));
    },
    credentials: true,
}));
app.use((0, compression_1.default)());
app.use(express_1.default.json({ limit: `${env_1.default.BODY_LIMIT_MB}mb` }));
app.use(express_1.default.urlencoded({ extended: true, limit: `${env_1.default.URL_ENCODED_LIMIT_MB}mb` }));
app.use((0, cookie_parser_1.default)());
// Request tracing + slow/error request logs
app.use((req, res, next) => {
    const requestId = req.header('x-request-id')?.trim() || (0, crypto_1.randomUUID)();
    const startedAt = process.hrtime.bigint();
    res.setHeader('x-request-id', requestId);
    res.locals.requestId = requestId;
    res.on('finish', () => {
        const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1000000;
        if (res.statusCode >= 500 || elapsedMs >= env_1.default.SLOW_REQUEST_THRESHOLD_MS) {
            console.log(JSON.stringify({
                level: res.statusCode >= 500 ? 'error' : 'warn',
                requestId,
                method: req.method,
                path: req.originalUrl,
                statusCode: res.statusCode,
                durationMs: Math.round(elapsedMs * 100) / 100,
                ip: req.ip,
            }));
        }
    });
    res.setTimeout(env_1.default.REQUEST_TIMEOUT_MS, () => {
        if (!res.headersSent) {
            res.status(503).json({ message: 'Request timed out. Please retry.' });
        }
        req.destroy();
    });
    next();
});
app.use(metrics_1.metricsMiddleware);
app.get(env_1.default.METRICS_ROUTE, async (req, res) => {
    await (0, metrics_1.serveMetrics)(req, res);
});
// Baseline traffic protection
app.use('/api', rateLimit_middleware_1.apiLimiter);
app.use('/api/auth', rateLimit_middleware_1.authLimiter);
app.use('/api/booking', rateLimit_middleware_1.mutationLimiter);
app.use('/api/customer', rateLimit_middleware_1.mutationLimiter);
app.use('/api/worker', rateLimit_middleware_1.mutationLimiter);
app.use('/api/admin', rateLimit_middleware_1.mutationLimiter);
app.use('/api/notifications', rateLimit_middleware_1.mutationLimiter);
// Health check
app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.round(process.uptime()),
    });
});
// Readiness check
app.get('/api/ready', (_req, res) => {
    const isDbReady = mongoose_1.default.connection.readyState === 1;
    res.status(isDbReady ? 200 : 503).json({
        status: isDbReady ? 'ready' : 'not-ready',
        timestamp: new Date().toISOString(),
        dbState: mongoose_1.default.connection.readyState,
    });
});
// Routes
app.use('/api/auth', auth_routes_1.default);
app.use('/api/customer', customer_routes_1.default);
app.use('/api/worker', worker_routes_1.default);
app.use('/api/booking', booking_routes_1.default);
app.use('/api/admin', admin_routes_1.default);
app.use('/api/notifications', notification_routes_1.default);
app.use('/api', (_req, res) => {
    res.status(404).json({ message: 'API route not found' });
});
// Error handler
app.use(error_middleware_1.errorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map