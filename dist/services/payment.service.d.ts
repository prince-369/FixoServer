interface RazorpayOrderPayment {
    id: string;
    order_id?: string;
    status?: string;
    created_at?: number;
}
export declare const createOrder: (amount: number, bookingId: string) => Promise<import("razorpay/dist/types/orders").Orders.RazorpayOrder>;
export declare const verifyPayment: (orderId: string, paymentId: string, signature: string) => boolean;
export declare const verifyWebhookSignature: (rawBody: string, signature: string) => boolean;
export declare const fetchSuccessfulPaymentForOrder: (orderId: string) => Promise<RazorpayOrderPayment | null>;
export {};
//# sourceMappingURL=payment.service.d.ts.map