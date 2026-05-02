import { createHash } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import env from '../config/env';
import IdempotencyKey from '../models/IdempotencyKey';

const MAX_REPLAY_BODY_BYTES = 128 * 1024;

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const objectValue = value as Record<string, unknown>;
  const sortedKeys = Object.keys(objectValue).sort();
  const serialized = sortedKeys.map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`);
  return `{${serialized.join(',')}}`;
};

const buildIdempotencyKey = (req: Request): string => {
  const actor = req.user?.id || req.ip;
  const route = `${req.baseUrl}${req.path}`;
  const clientKey = req.header('x-idempotency-key')?.trim();

  if (clientKey) {
    return `${actor}:${req.method}:${route}:${clientKey}`;
  }

  const bodyHash = createHash('sha256').update(stableStringify(req.body || {})).digest('hex');
  return `${actor}:${req.method}:${route}:${bodyHash}`;
};

const serializeReplayBody = (body: unknown): unknown => {
  if (body === undefined || body === null) return body;

  if (Buffer.isBuffer(body)) {
    if (body.byteLength > MAX_REPLAY_BODY_BYTES) return undefined;
    return body.toString('utf8');
  }

  if (typeof body === 'string') {
    if (Buffer.byteLength(body, 'utf8') > MAX_REPLAY_BODY_BYTES) return undefined;
    return body;
  }

  if (typeof body === 'number' || typeof body === 'boolean') {
    return body;
  }

  return body;
};

const replayResponse = (res: Response, statusCode: number, body: unknown): void => {
  if (body === undefined) {
    res.sendStatus(statusCode);
    return;
  }

  if (typeof body === 'string') {
    res.status(statusCode).send(body);
    return;
  }

  res.status(statusCode).json(body);
};

const isDuplicateKeyError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  return (error as { code?: number }).code === 11000;
};

export const idempotencyGuard = (ttlMs = env.IDEMPOTENCY_TTL_MS) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      next();
      return;
    }

    const key = buildIdempotencyKey(req);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);

    await IdempotencyKey.deleteOne({ key, expiresAt: { $lte: now } });

    try {
      await IdempotencyKey.create({
        key,
        state: 'in-progress',
        expiresAt,
      });
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        next(error as Error);
        return;
      }

      const existing = await IdempotencyKey.findOne({ key, expiresAt: { $gt: now } }).lean();
      if (!existing) {
        // Race condition fallback: allow request to proceed when duplicate doc was already expired/deleted.
        next();
        return;
      }

      if (existing.state === 'in-progress') {
        res.setHeader('Retry-After', '1');
        res.status(409).json({ message: 'Duplicate request in progress. Please wait.' });
        return;
      }

      replayResponse(res, existing.statusCode || 200, existing.body);
      return;
    }

    let capturedBody: unknown;
    let finalized = false;

    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    res.json = ((body: unknown) => {
      capturedBody = body;
      return originalJson(body);
    }) as Response['json'];

    res.send = ((body: unknown) => {
      if (capturedBody === undefined) {
        capturedBody = body;
      }
      return originalSend(body as any);
    }) as Response['send'];

    const finalize = async (aborted: boolean): Promise<void> => {
      if (finalized) return;
      finalized = true;

      if (aborted || res.statusCode >= 500) {
        await IdempotencyKey.deleteOne({ key, state: 'in-progress' });
        return;
      }

      const replayBody = serializeReplayBody(capturedBody);
      await IdempotencyKey.updateOne(
        { key, state: 'in-progress' },
        {
          $set: {
            state: 'completed',
            statusCode: res.statusCode,
            body: replayBody,
            expiresAt: new Date(Date.now() + ttlMs),
          },
        }
      );
    };

    res.once('finish', () => {
      void finalize(false);
    });

    res.once('close', () => {
      if (!res.writableEnded) {
        void finalize(true);
      }
    });

    next();
  };
};
