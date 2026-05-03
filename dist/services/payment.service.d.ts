export declare const createOrder: (amount: number, bookingId: string) => Promise<import("razorpay/dist/types/orders").Orders.RazorpayOrder>;
export declare const verifyPayment: (orderId: string, paymentId: string, signature: string) => boolean;
export declare const verifyWebhookSignature: (rawBody: string, signature: string) => boolean;
export declare const createDuesPaymentOrder: (amount: number, workerId: string) => Promise<import("razorpay/dist/types/orders").Orders.RazorpayOrder>;
//# sourceMappingURL=payment.service.d.ts.map