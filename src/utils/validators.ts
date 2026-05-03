import { body, param } from 'express-validator';

export const registerCustomerValidation = [
  body('fullName').trim().notEmpty().withMessage('Full name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('phone').trim().notEmpty().withMessage('Phone number is required')
    .matches(/^[6-9]\d{9}$/).withMessage('Valid 10-digit Indian phone number required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[a-z]/).withMessage('Password must include a lowercase letter')
    .matches(/[A-Z]/).withMessage('Password must include an uppercase letter')
    .matches(/\d/).withMessage('Password must include a number')
    .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/).withMessage('Password must include a special character'),
];

export const registerWorkerValidation = [
  body('fullName').trim().notEmpty().withMessage('Full name is required (as per document)'),
  body('phone').trim().notEmpty().withMessage('Phone number is required')
    .matches(/^[6-9]\d{9}$/).withMessage('Valid 10-digit Indian phone number required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[a-z]/).withMessage('Password must include a lowercase letter')
    .matches(/[A-Z]/).withMessage('Password must include an uppercase letter')
    .matches(/\d/).withMessage('Password must include a number')
    .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/).withMessage('Password must include a special character'),
];

export const loginValidation = [
  body('identifier').trim().notEmpty().withMessage('Email or phone number is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

export const workerLoginValidation = [
  body('phone').trim().notEmpty().withMessage('Phone number is required')
    .matches(/^[6-9]\d{9}$/).withMessage('Valid 10-digit Indian phone number required'),
  body('password').notEmpty().withMessage('Password is required'),
];

export const forgotPasswordValidation = [
  body('identifier').trim().notEmpty().withMessage('Email or phone number is required'),
  body('role').isIn(['customer', 'worker']).withMessage('Role must be customer or worker'),
];

export const resetPasswordValidation = [
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[a-z]/).withMessage('Password must include a lowercase letter')
    .matches(/[A-Z]/).withMessage('Password must include an uppercase letter')
    .matches(/\d/).withMessage('Password must include a number')
    .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/).withMessage('Password must include a special character'),
  body('token').optional().notEmpty(),
  body('phone').optional().trim(),
  body('otp').optional().trim(),
];

export const createBookingValidation = [
  body('category').isMongoId().withMessage('Valid category ID is required'),
  body('workDescription').trim().notEmpty().withMessage('Work description is required'),
  body('timeSlot').optional().isIn(['anytime', 'morning', 'afternoon', 'evening']).withMessage('Invalid time slot'),
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude is required'),
  body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude is required'),
  body('address').trim().notEmpty().withMessage('Address is required'),
];

export const bidValidation = [
  param('bookingId').isMongoId().withMessage('Valid booking ID required'),
  body('priceOffered').isFloat({ min: 1 }).withMessage('Price must be at least ₹1'),
];

export const withdrawalValidation = [
  body('amount').isFloat({ min: 1 }).withMessage('Withdrawal amount must be at least ₹1'),
];

export const bankDetailsValidation = [
  body('holderName').trim().notEmpty().withMessage('Account holder name is required'),
  body('bankName').trim().notEmpty().withMessage('Bank name is required'),
  body('accountNumber').trim().notEmpty().withMessage('Account number is required'),
  body('ifscCode').trim().notEmpty().withMessage('IFSC code is required')
    .matches(/^[A-Z]{4}0[A-Z0-9]{6}$/).withMessage('Valid IFSC code required'),
];
