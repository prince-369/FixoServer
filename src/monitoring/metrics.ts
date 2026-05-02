import type { NextFunction, Request, Response } from 'express';
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';
import env from '../config/env';

const METRICS_PREFIX = 'fixo_';

const metricsRegistry = new Registry();
metricsRegistry.setDefaultLabels({
  service: env.METRICS_SERVICE_NAME,
  environment: env.NODE_ENV,
});
collectDefaultMetrics({ register: metricsRegistry, prefix: METRICS_PREFIX });

const httpRequestsTotal = new Counter({
  name: `${METRICS_PREFIX}http_requests_total`,
  help: 'Total HTTP requests served by the API.',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [metricsRegistry],
});

const httpRequestDurationSeconds = new Histogram({
  name: `${METRICS_PREFIX}http_request_duration_seconds`,
  help: 'HTTP request duration in seconds.',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
  registers: [metricsRegistry],
});

const httpRequestsInFlight = new Gauge({
  name: `${METRICS_PREFIX}http_requests_in_flight`,
  help: 'Number of in-flight HTTP requests currently being processed.',
  registers: [metricsRegistry],
});

const socketConnectedClients = new Gauge({
  name: `${METRICS_PREFIX}socket_connected_clients`,
  help: 'Current number of connected Socket.IO clients.',
  registers: [metricsRegistry],
});

const socketConnectionsTotal = new Counter({
  name: `${METRICS_PREFIX}socket_connections_total`,
  help: 'Total Socket.IO connection count.',
  labelNames: ['transport'] as const,
  registers: [metricsRegistry],
});

const socketDisconnectsTotal = new Counter({
  name: `${METRICS_PREFIX}socket_disconnects_total`,
  help: 'Total Socket.IO disconnect count.',
  labelNames: ['reason'] as const,
  registers: [metricsRegistry],
});

const socketEventsTotal = new Counter({
  name: `${METRICS_PREFIX}socket_events_total`,
  help: 'Total Socket.IO events handled by the server.',
  labelNames: ['event_name'] as const,
  registers: [metricsRegistry],
});

const socketEkycRoomsActive = new Gauge({
  name: `${METRICS_PREFIX}socket_ekyc_rooms_active`,
  help: 'Current active eKYC room count.',
  registers: [metricsRegistry],
});

let connectedSocketClientsCount = 0;

const normalizeRoutePath = (path: string): string => {
  return path
    .split('?')[0]
    .replace(/\/[0-9a-fA-F]{24}(?=\/|$)/g, '/:id')
    .replace(/\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}(?=\/|$)/g, '/:uuid')
    .replace(/\/\d+(?=\/|$)/g, '/:number')
    .replace(/\/$/, '') || '/';
};

const getRouteLabel = (req: Request): string => {
  if (req.route && typeof req.route.path === 'string') {
    const base = req.baseUrl || '';
    return `${base}${req.route.path}` || '/';
  }

  return normalizeRoutePath(req.originalUrl || req.url || '/');
};

const isAuthorizedMetricsRequest = (req: Request): boolean => {
  if (!env.METRICS_AUTH_TOKEN) return true;

  const authorization = req.header('authorization') || '';
  const bearerToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  const tokenHeader = req.header('x-metrics-token')?.trim() || '';

  return bearerToken === env.METRICS_AUTH_TOKEN || tokenHeader === env.METRICS_AUTH_TOKEN;
};

const sanitizeLabelValue = (value: string, fallback = 'unknown'): string => {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9:_-]/g, '_').slice(0, 80);
  return normalized || fallback;
};

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (!env.METRICS_ENABLED) {
    next();
    return;
  }

  const startedAt = process.hrtime.bigint();
  httpRequestsInFlight.inc();

  let settled = false;
  const finalize = () => {
    if (settled) return;
    settled = true;

    const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
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

export const serveMetrics = async (req: Request, res: Response): Promise<void> => {
  if (!env.METRICS_ENABLED) {
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

export const recordSocketConnected = (transport = 'unknown'): void => {
  if (!env.METRICS_ENABLED) return;

  connectedSocketClientsCount += 1;
  socketConnectedClients.set(connectedSocketClientsCount);
  socketConnectionsTotal.inc({ transport: sanitizeLabelValue(transport) });
};

export const recordSocketDisconnected = (reason = 'unknown'): void => {
  if (!env.METRICS_ENABLED) return;

  connectedSocketClientsCount = Math.max(0, connectedSocketClientsCount - 1);
  socketConnectedClients.set(connectedSocketClientsCount);
  socketDisconnectsTotal.inc({ reason: sanitizeLabelValue(reason) });
};

export const recordSocketEvent = (eventName: string): void => {
  if (!env.METRICS_ENABLED) return;
  socketEventsTotal.inc({ event_name: sanitizeLabelValue(eventName) });
};

export const setActiveEkycRooms = (count: number): void => {
  if (!env.METRICS_ENABLED) return;
  socketEkycRoomsActive.set(Math.max(0, count));
};

export { metricsRegistry };
