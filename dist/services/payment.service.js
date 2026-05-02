"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDuesPaymentOrder = exports.verifyPayment = exports.createOrder = void 0;
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
//# sourceMappingURL=payment.service.js.map