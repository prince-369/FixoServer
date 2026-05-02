import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import multer from 'multer';
import env from '../config/env';

interface AppError extends Error {
  statusCode?: number;
  status?: number;
  code?: number | string;
  keyValue?: Record<string, unknown>;
  type?: string;
}

export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
    return;
  }
  next();
};

export const errorHandler = (err: Error, req: Request, res: Response, _next: NextFunction): void => {
  if (res.headersSent) {
    return;
  }

  const requestId = String(res.locals.requestId || 'unknown-request');
  const appError = err as AppError;

  console.error(JSON.stringify({
    level: 'error',
    requestId,
    method: req.method,
    path: req.originalUrl,
    message: appError.message,
    stack: appError.stack,
  }));

  if (appError.message === 'CORS origin not allowed') {
    res.status(403).json({ message: 'Request origin is not allowed', requestId });
    return;
  }

  if (err instanceof multer.MulterError) {
    const messages: Record<string, string> = {
      LIMIT_FILE_SIZE: 'File too large. Maximum size is 5MB',
      LIMIT_UNEXPECTED_FILE: 'Unexpected file field',
    };
    res.status(400).json({ message: messages[err.code] || err.message, requestId });
    return;
  }

  if (appError.type === 'entity.too.large') {
    res.status(413).json({ message: 'Payload too large', requestId });
    return;
  }

  if (err.message.includes('Only image files')) {
    res.status(400).json({ message: err.message, requestId });
    return;
  }

  if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
    res.status(401).json({ message: 'Authentication token is invalid or expired', requestId });
    return;
  }

  if (err.name === 'ValidationError') {
    res.status(400).json({ message: 'Validation failed', requestId });
    return;
  }

  if (err.name === 'CastError') {
    res.status(400).json({ message: 'Invalid ID format', requestId });
    return;
  }

  if (appError.code === 11000) {
    const field = appError.keyValue ? Object.keys(appError.keyValue)[0] : 'Field';
    res.status(409).json({ message: `${field} already exists`, requestId });
    return;
  }

  const statusCode = typeof appError.statusCode === 'number'
    ? appError.statusCode
    : typeof appError.status === 'number'
      ? appError.status
      : 500;

  const safeMessage = statusCode >= 500
    ? 'Internal server error'
    : (appError.message || 'Request failed');

  res.status(statusCode).json({
    message: safeMessage,
    requestId,
    ...(env.NODE_ENV !== 'production' && statusCode >= 500 ? { stack: appError.stack } : {}),
  });
};
