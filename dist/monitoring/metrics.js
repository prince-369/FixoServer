"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricsRegistry = exports.setActiveEkycRooms = exports.recordSocketEvent = exports.recordSocketDisconnected = exports.recordSocketConnected = exports.serveMetrics = exports.metricsMiddleware = void 0;
const prom_client_1 = require("prom-client");
const env_1 = __importDefault(require("../config/env"));
const METRICS_PREFIX = 'fixo_';
const metricsRegistry = new prom_client_1.Registry();
exports.metricsRegistry = metricsRegistry;
metricsRegistry.setDefaultLabels({
    service: env_1.default.METRICS_SERVICE_NAME,
    environment: env_1.default.NODE_ENV,
});
(0, prom_client_1.collectDefaultMetrics)({ register: metricsRegistry, prefix: METRICS_PREFIX });
const httpRequestsTotal = new prom_client_1.Counter({
    name: `${METRICS_PREFIX}http_requests_total`,
    help: 'Total HTTP requests served by the API.',
    labelNames: ['method', 'route', 'status_code'],
    registers: [metricsRegistry],
});
const httpRequestDurationSeconds = new prom_client_1.Histogram({
    name: `${METRICS_PREFIX}http_request_duration_seconds`,
    help: 'HTTP request duration in seconds.',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
    registers: [metricsRegistry],
});
const httpRequestsInFlight = new prom_client_1.Gauge({
    name: `${METRICS_PREFIX}http_requests_in_flight`,
    help: 'Number of in-flight HTTP requests currently being processed.',
    registers: [metricsRegistry],
});
const socketConnectedClients = new prom_client_1.Gauge({
    name: `${METRICS_PREFIX}socket_connected_clients`,
    help: 'Current number of connected Socket.IO clients.',
    registers: [metricsRegistry],
});
const socketConnectionsTotal = new prom_client_1.Counter({
    name: `${METRICS_PREFIX}socket_connections_total`,
    help: 'Total Socket.IO connection count.',
    labelNames: ['transport'],
    registers: [metricsRegistry],
});
const socketDisconnectsTotal = new prom_client_1.Counter({
    name: `${METRICS_PREFIX}socket_disconnects_total`,
    help: 'Total Socket.IO disconnect count.',
    labelNames: ['reason'],
    registers: [metricsRegistry],
});
const socketEventsTotal = new prom_client_1.Counter({
    name: `${METRICS_PREFIX}socket_events_total`,
    help: 'Total Socket.IO events handled by the server.',
    labelNames: ['event_name'],
    registers: [metricsRegistry],
});
const socketEkycRoomsActive = new prom_client_1.Gauge({
    name: `${METRICS_PREFIX}socket_ekyc_rooms_active`,
    help: 'Current active eKYC room count.',
    registers: [metricsRegistry],
});
let connectedSocketClientsCount = 0;
const normalizeRoutePath = (path) => {
    return path
        .split('?')[0]
        .replace(/\/[0-9a-fA-F]{24}(?=\/|$)/g, '/:id')
        .replace(/\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}(?=\/|$)/g, '/:uuid')
        .replace(/\/\d+(?=\/|$)/g, '/:number')
        .replace(/\/$/, '') || '/';
};
const getRouteLabel = (req) => {
    if (req.route && typeof req.route.path === 'string') {
        const base = req.baseUrl || '';
        return `${base}${req.route.path}` || '/';
    }
    return normalizeRoutePath(req.originalUrl || req.url || '/');
};
const isAuthorizedMetricsRequest = (req) => {
    if (!env_1.default.METRICS_AUTH_TOKEN)
        return true;
    const authorization = req.header('authorization') || '';
    const bearerToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    const tokenHeader = req.header('x-metrics-token')?.trim() || '';
    return bearerToken === env_1.default.METRICS_AUTH_TOKEN || tokenHeader === env_1.default.METRICS_AUTH_TOKEN;
};
const sanitizeLabelValue = (value, fallback = 'unknown') => {
    const normalized = value.trim().toLowerCase().replace(/[^a-z0-9:_-]/g, '_').slice(0, 80);
    return normalized || fallback;
};
const metricsMiddleware = (req, res, next) => {
    if (!env_1.default.METRICS_ENABLED) {
        next();
        return;
    }
    const startedAt = process.hrtime.bigint();
    httpRequestsInFlight.inc();
    let settled = false;
    const finalize = () => {
        if (settled)
            return;
        settled = true;
        const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1000000000;
        const route = getRouteLabel(req);
        const method = req.method.toUpperCase();
        const statusCode = String(res.statusCode || 500);
        httpRequestDurationSeconds.observe({ method, route, status_code: statusCode }, durationSeconds);
        httpRequestsTotal.inc({ method, route, status_code: statusCode });
        httpRequestsInFlight.dec();
    };
    res.once('finish', finalize);
    res.once('close', finalize);
    next();
};
exports.metricsMiddleware = metricsMiddleware;
const serveMetrics = async (req, res) => {
    if (!env_1.default.METRICS_ENABLED) {
        res.status(404).json({ message: 'Metrics endpoint is disabled.' });
        return;
    }
    if (!isAuthorizedMetricsRequest(req)) {
        res.status(401).json({ message: 'Unauthorized metrics request.' });
        return;
    }
    res.setHeader('Content-Type', metricsRegistry.contentType);
    res.end(await metricsRegistry.metrics());
};
exports.serveMetrics = serveMetrics;
const recordSocketConnected = (transport = 'unknown') => {
    if (!env_1.default.METRICS_ENABLED)
        return;
    connectedSocketClientsCount += 1;
    socketConnectedClients.set(connectedSocketClientsCount);
    socketConnectionsTotal.inc({ transport: sanitizeLabelValue(transport) });
};
exports.recordSocketConnected = recordSocketConnected;
const recordSocketDisconnected = (reason = 'unknown') => {
    if (!env_1.default.METRICS_ENABLED)
        return;
    connectedSocketClientsCount = Math.max(0, connectedSocketClientsCount - 1);
    socketConnectedClients.set(connectedSocketClientsCount);
    socketDisconnectsTotal.inc({ reason: sanitizeLabelValue(reason) });
};
exports.recordSocketDisconnected = recordSocketDisconnected;
const recordSocketEvent = (eventName) => {
    if (!env_1.default.METRICS_ENABLED)
        return;
    socketEventsTotal.inc({ event_name: sanitizeLabelValue(eventName) });
};
exports.recordSocketEvent = recordSocketEvent;
const setActiveEkycRooms = (count) => {
    if (!env_1.default.METRICS_ENABLED)
        return;
    socketEkycRoomsActive.set(Math.max(0, count));
};
exports.setActiveEkycRooms = setActiveEkycRooms;
//# sourceMappingURL=metrics.js.map