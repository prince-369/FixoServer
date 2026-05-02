"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.handleValidationErrors = void 0;
const express_validator_1 = require("express-validator");
const multer_1 = __importDefault(require("multer"));
const env_1 = __importDefault(require("../config/env"));
const handleValidationErrors = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
        return;
    }
    next();
};
exports.handleValidationErrors = handleValidationErrors;
const errorHandler = (err, req, res, _next) => {
    if (res.headersSent) {
        return;
    }
    const requestId = String(res.locals.requestId || 'unknown-request');
    const appError = err;
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
    if (err instanceof multer_1.default.MulterError) {
        const messages = {
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
        ...(env_1.default.NODE_ENV !== 'production' && statusCode >= 500 ? { stack: appError.stack } : {}),
    });
};
exports.errorHandler = errorHandler;
//# sourceMappingURL=error.middleware.js.map