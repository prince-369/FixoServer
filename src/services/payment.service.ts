import crypto from 'crypto';
import razorpay from '../config/razorpay';
import env from '../config/env';

export const createOrder = async (amount: number, bookingId: string) => {
  const options = {
    amount: amount * 100, // Razorpay expects amount in paise
    currency: 'INR',
    receipt: `booking_${bookingId}`,
  };

  const order = await razorpay.orders.create(options);
  return order;
};

export const verifyPayment = (
  orderId: string,
  paymentId: string,
  signature: string
): boolean => {
  const body = orderId + '|' + paymentId;
  const expectedSignature = crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  return expectedSignature === signature;
};

export const verifyWebhookSignature = (rawBody: string, signature: string): boolean => {
  const expectedSignature = crypto
    .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  return expectedSignature === signature;
};

export const createDuesPaymentOrder = async (amount: number, workerId: string) => {
  const options = {
    amount: amount * 100,
    currency: 'INR',
    receipt: `dues_${workerId}`,
  };

  const order = await razorpay.orders.create(options);
  return order;
};
