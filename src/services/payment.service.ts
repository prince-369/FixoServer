import crypto from 'crypto';
import razorpay from '../config/razorpay';
import env from '../config/env';

interface RazorpayOrderPayment {
  id: string;
  order_id?: string;
  status?: string;
  created_at?: number;
}

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

export const fetchSuccessfulPaymentForOrder = async (
  orderId: string
): Promise<RazorpayOrderPayment | null> => {
  const paymentsResponse = await (razorpay.orders as any).fetchPayments(orderId);
  const items = Array.isArray(paymentsResponse?.items)
    ? (paymentsResponse.items as RazorpayOrderPayment[])
    : [];

  const successful = items
    .filter((payment) => ['captured', 'authorized'].includes(String(payment.status || '').toLowerCase()))
    .sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0));

  return successful[0] || null;
};
