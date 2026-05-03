"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bankDetailsValidation = exports.withdrawalValidation = exports.bidValidation = exports.createBookingValidation = exports.resetPasswordValidation = exports.forgotPasswordValidation = exports.workerLoginValidation = exports.loginValidation = exports.registerWorkerValidation = exports.registerCustomerValidation = void 0;
const express_validator_1 = require("express-validator");
exports.registerCustomerValidation = [
    (0, express_validator_1.body)('fullName').trim().notEmpty().withMessage('Full name is required'),
    (0, express_validator_1.body)('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    (0, express_validator_1.body)('phone').trim().notEmpty().withMessage('Phone number is required')
        .matches(/^[6-9]\d{9}$/).withMessage('Valid 10-digit Indian phone number required'),
    (0, express_validator_1.body)('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
        .matches(/[a-z]/).withMessage('Password must include a lowercase letter')
        .matches(/[A-Z]/).withMessage('Password must include an uppercase letter')
        .matches(/\d/).withMessage('Password must include a number')
        .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/).withMessage('Password must include a special character'),
];
exports.registerWorkerValidation = [
    (0, express_validator_1.body)('fullName').trim().notEmpty().withMessage('Full name is required (as per document)'),
    (0, express_validator_1.body)('phone').trim().notEmpty().withMessage('Phone number is required')
        .matches(/^[6-9]\d{9}$/).withMessage('Valid 10-digit Indian phone number required'),
    (0, express_validator_1.body)('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
        .matches(/[a-z]/).withMessage('Password must include a lowercase letter')
        .matches(/[A-Z]/).withMessage('Password must include an uppercase letter')
        .matches(/\d/).withMessage('Password must include a number')
        .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/).withMessage('Password must include a special character'),
];
exports.loginValidation = [
    (0, express_validator_1.body)('identifier').trim().notEmpty().withMessage('Email or phone number is required'),
    (0, express_validator_1.body)('password').notEmpty().withMessage('Password is required'),
];
exports.workerLoginValidation = [
    (0, express_validator_1.body)('phone').trim().notEmpty().withMessage('Phone number is required')
        .matches(/^[6-9]\d{9}$/).withMessage('Valid 10-digit Indian phone number required'),
    (0, express_validator_1.body)('password').notEmpty().withMessage('Password is required'),
];
exports.forgotPasswordValidation = [
    (0, express_validator_1.body)('identifier').trim().notEmpty().withMessage('Email or phone number is required'),
    (0, express_validator_1.body)('role').isIn(['customer', 'worker']).withMessage('Role must be customer or worker'),
];
exports.resetPasswordValidation = [
    (0, express_validator_1.body)('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
        .matches(/[a-z]/).withMessage('Password must include a lowercase letter')
        .matches(/[A-Z]/).withMessage('Password must include an uppercase letter')
        .matches(/\d/).withMessage('Password must include a number')
        .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/).withMessage('Password must include a special character'),
    (0, express_validator_1.body)('token').optional().notEmpty(),
    (0, express_validator_1.body)('phone').optional().trim(),
    (0, express_validator_1.body)('otp').optional().trim(),
];
exports.createBookingValidation = [
    (0, express_validator_1.body)('category').isMongoId().withMessage('Valid category ID is required'),
    (0, express_validator_1.body)('workDescription').trim().notEmpty().withMessage('Work description is required'),
    (0, express_validator_1.body)('timeSlot').optional().isIn(['anytime', 'morning', 'afternoon', 'evening']).withMessage('Invalid time slot'),
    (0, express_validator_1.body)('latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude is required'),
    (0, express_validator_1.body)('longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude is required'),
    (0, express_validator_1.body)('address').trim().notEmpty().withMessage('Address is required'),
];
exports.bidValidation = [
    (0, express_validator_1.param)('bookingId').isMongoId().withMessage('Valid booking ID required'),
    (0, express_validator_1.body)('priceOffered').isFloat({ min: 1 }).withMessage('Price must be at least ₹1'),
];
exports.withdrawalValidation = [
    (0, express_validator_1.body)('amount').isFloat({ min: 1 }).withMessage('Withdrawal amount must be at least ₹1'),
];
exports.bankDetailsValidation = [
    (0, express_validator_1.body)('holderName').trim().notEmpty().withMessage('Account holder name is required'),
    (0, express_validator_1.body)('bankName').trim().notEmpty().withMessage('Bank name is required'),
    (0, express_validator_1.body)('accountNumber').trim().notEmpty().withMessage('Account number is required'),
    (0, express_validator_1.body)('ifscCode').trim().notEmpty().withMessage('IFSC code is required')
        .matches(/^[A-Z]{4}0[A-Z0-9]{6}$/).withMessage('Valid IFSC code required'),
];
//# sourceMappingURL=validators.js.map