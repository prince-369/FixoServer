"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchSuccessfulPaymentForOrder = exports.createDuesPaymentOrder = exports.verifyWebhookSignature = exports.verifyPayment = exports.createOrder = void 0;
const crypto_1 = __importDefault(require("crypto"));
const razorpay_1 = __importDefault(require("../config/razorpay"));
const env_1 = __importDefault(require("../config/env"));
const createOrder = async (amount, bookingId) => {
    const options = {
        amount: amount * 100, // Razorpay expects amount in paise
        currency: 'INR',
        receipt: `booking_${bookingId}`,
    };
    const order = await razorpay_1.default.orders.create(options);
    return order;
};
exports.createOrder = createOrder;
const verifyPayment = (orderId, paymentId, signature) => {
    const body = orderId + '|' + paymentId;
    const expectedSignature = crypto_1.default
        .createHmac('sha256', env_1.default.RAZORPAY_KEY_SECRET)
        .update(body)
        .digest('hex');
    return expectedSignature === signature;
};
exports.verifyPayment = verifyPayment;
const verifyWebhookSignature = (rawBody, signature) => {
    const expectedSignature = crypto_1.default
        .createHmac('sha256', env_1.default.RAZORPAY_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');
    return expectedSignature === signature;
};
exports.verifyWebhookSignature = verifyWebhookSignature;
const createDuesPaymentOrder = async (amount, workerId) => {
    const options = {
        amount: amount * 100,
        currency: 'INR',
        receipt: `dues_${workerId}`,
    };
    const order = await razorpay_1.default.orders.create(options);
    return order;
};
exports.createDuesPaymentOrder = createDuesPaymentOrder;
const fetchSuccessfulPaymentForOrder = async (orderId) => {
    const paymentsResponse = await razorpay_1.default.orders.fetchPayments(orderId);
    const items = Array.isArray(paymentsResponse?.items)
        ? paymentsResponse.items
        : [];
    const successful = items
        .filter((payment) => ['captured', 'authorized'].includes(String(payment.status || '').toLowerCase()))
        .sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0));
    return successful[0] || null;
};
exports.fetchSuccessfulPaymentForOrder = fetchSuccessfulPaymentForOrder;
//# sourceMappingURL=payment.service.js.map