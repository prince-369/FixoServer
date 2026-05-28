import express, { type Request } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import swaggerUi from 'swagger-ui-express';
import env from './config/env';
import { errorHandler } from './middlewares/error.middleware';
import { apiLimiter, authLimiter, mutationLimiter } from './middlewares/rateLimit.middleware';
import { metricsMiddleware, serveMetrics } from './monitoring/metrics';
import swaggerSpec from './docs/swagger';

// Import routes
import authRoutes from './routes/auth.routes';
import customerRoutes from './routes/customer.routes';
import workerRoutes from './routes/worker.routes';
import bookingRoutes from './routes/booking.routes';
import adminRoutes from './routes/admin.routes';
import notificationRoutes from './routes/notification.routes';

const app = express();
const allowedOrigins = new Set(env.CLIENT_URLS);

// Security & parsing middleware
app.use(helmet());
app.disable('x-powered-by');
app.set('trust proxy', env.TRUST_PROXY);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('CORS origin not allowed'));
  },
  credentials: true,
}));

app.use(compression());
app.use(express.json({
  limit: `${env.BODY_LIMIT_MB}mb`,
  verify: (req, _res, buf) => {
    const expressReq = req as Request & { rawBody?: string };
    if (expressReq.originalUrl?.startsWith('/api/booking/webhook/razorpay')) {
      expressReq.rawBody = buf.toString('utf8');
    }
  },
}));
app.use(express.urlencoded({ extended: true, limit: `${env.URL_ENCODED_LIMIT_MB}mb` }));
app.use(cookieParser());

// Request tracing + slow/error request logs
app.use((req, res, next) => {
  const requestId = req.header('x-request-id')?.trim() || randomUUID();
  const startedAt = process.hrtime.bigint();

  res.setHeader('x-request-id', requestId);
  res.locals.requestId = requestId;

  res.on('finish', () => {
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    if (res.statusCode >= 500 || elapsedMs >= env.SLOW_REQUEST_THRESHOLD_MS) {
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

  res.setTimeout(env.REQUEST_TIMEOUT_MS, () => {
    if (!res.headersSent) {
      res.status(503).json({ message: 'Request timed out. Please retry.' });
    }
    req.destroy();
  });

  next();
});

app.use(metricsMiddleware);

app.get(env.METRICS_ROUTE, async (req, res) => {
  await serveMetrics(req, res);
});

// Baseline traffic protection
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/booking', mutationLimiter);
app.use('/api/customer', mutationLimiter);
app.use('/api/worker', mutationLimiter);
app.use('/api/admin', mutationLimiter);
app.use('/api/notifications', mutationLimiter);

// Swagger UI — disable helmet CSP only for this route so inline scripts load
app.use('/api/docs', helmet({ contentSecurityPolicy: false }), swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'FIXO API Docs',
  swaggerOptions: { persistAuthorization: true },
}));

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
  const isDbReady = mongoose.connection.readyState === 1;
  res.status(isDbReady ? 200 : 503).json({
    status: isDbReady ? 'ready' : 'not-ready',
    timestamp: new Date().toISOString(),
    dbState: mongoose.connection.readyState,
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/worker', workerRoutes);
app.use('/api/booking', bookingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);

app.use('/api', (_req, res) => {
  res.status(404).json({ message: 'API route not found' });
});

// Error handler
app.use(errorHandler);

export default app;
