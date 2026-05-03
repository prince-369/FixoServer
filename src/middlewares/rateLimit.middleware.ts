import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Request } from 'express';
import Redis from 'ioredis';
import { RedisStore } from 'rate-limit-redis';
import env from '../config/env';

const RATE_LIMIT_MESSAGE = { message: 'Too many requests. Please try again shortly.' };

let redisClient: Redis | null = null;

const getOrCreateRedisClient = (): Redis | null => {
  if (!env.REDIS_URL) return null;
  if (redisClient) return redisClient;

  redisClient = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  connectTimeout: 10_000,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  tls: env.REDIS_URL.startsWith('rediss://') ? {} : undefined,
});

  redisClient.on('error', (error) => {
    console.error('Rate limit Redis error:', error);
  });

  void redisClient.connect().catch((error) => {
    console.error('Rate limit Redis connect failed. Falling back to local memory store.', error);
  });

  return redisClient;
};

const getRateLimitStore = (prefix: string): RedisStore | undefined => {
  const client = getOrCreateRedisClient();
  if (!client) return undefined;

  return new RedisStore({
    prefix,
    sendCommand: async (...args: string[]): Promise<number> => {
      try {
        const result = await client.call(args[0], ...args.slice(1));
        return Number(result);
      } catch {
        // Fail-open behavior to avoid request meltdown if Redis is temporarily unavailable.
        return 0;
      }
    },
  });
};

const keyByUserOrIp = (req: Request): string => {
  const userId = req.user?.id;
  const role = req.user?.role;
  if (userId && role) return `${role}:${userId}`;
  const ip = req.ip || req.socket.remoteAddress || '0.0.0.0';
  return `ip:${ipKeyGenerator(ip)}`;
};

const skipHealthEndpoints = (req: Request): boolean => {
  const metricsPath = env.METRICS_ROUTE.startsWith('/api')
    ? env.METRICS_ROUTE.slice('/api'.length) || '/'
    : env.METRICS_ROUTE;

  return req.path === '/health' || req.path === '/ready' || req.path === metricsPath;
};

export const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
  skip: skipHealthEndpoints,
  store: getRateLimitStore('fixo:ratelimit:api:'),
  message: RATE_LIMIT_MESSAGE,
});

export const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const identifier =
      (typeof req.body?.identifier === 'string' && req.body.identifier.trim().toLowerCase()) ||
      (typeof req.body?.phone === 'string' && req.body.phone.trim()) ||
      (typeof req.body?.email === 'string' && req.body.email.trim().toLowerCase()) ||
      'unknown-identifier';
    return `${keyByUserOrIp(req)}:${identifier}`;
  },
  skipSuccessfulRequests: true,
  store: getRateLimitStore('fixo:ratelimit:auth:'),
  message: { message: 'Too many authentication attempts. Please try again later.' },
});

export const mutationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: env.MUTATION_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
  skip: (req) => ['GET', 'HEAD', 'OPTIONS'].includes(req.method),
  store: getRateLimitStore('fixo:ratelimit:mutation:'),
  message: { message: 'Too many write requests. Please slow down and retry.' },
});

export const closeRateLimiterStore = async (): Promise<void> => {
  if (!redisClient) return;
  try {
    await redisClient.quit();
  } catch {
    redisClient.disconnect();
  }
  redisClient = null;
};
