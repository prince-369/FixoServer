import mongoose, { Document } from 'mongoose';
export type BookingStatus = 'finding_workers' | 'bids_received' | 'worker_accepted' | 'worker_approved' | 'payment_done' | 'in_progress' | 'completed' | 'cancelled';
export type PaymentMethod = 'online' | 'cash';
export type PaymentStatus = 'pending' | 'paid' | 'refund_pending' | 'refunded';
export type RefundStatus = 'pending' | 'completed';
export interface IBooking extends Document {
    customer: mongoose.Types.ObjectId;
    category: mongoose.Types.ObjectId;
    workDescription: string;
    customerLocation: {
        type: string;
        coordinates: number[];
        address: string;
    };
    status: BookingStatus;
    acceptedBid?: mongoose.Types.ObjectId;
    assignedWorker?: mongoose.Types.ObjectId;
    paymentMethod?: PaymentMethod;
    paymentStatus: PaymentStatus;
    amount: number;
    cashSurcharge: number;
    completionPin?: string;
    workerMessage?: string;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    cancellation?: {
        cancelledBy: 'customer' | 'worker' | 'admin';
        reason: string;
        cancelledAt: Date;
    };
    refundDetails?: {
        upiId?: string;
        bankAccountNumber?: string;
        ifscCode?: string;
        bankName?: string;
        holderName?: string;
        status: RefundStatus;
        processedAt?: Date;
    };
    review?: {
        rating: number;
        feedback: string;
        createdAt: Date;
    };
    createdAt: Date;
    updatedAt: Date;
}
declare const _default: mongoose.Model<IBooking, {}, {}, {}, mongoose.Document<unknown, {}, IBooking, {}, mongoose.DefaultSchemaOptions> & IBooking & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IBooking>;
export default _default;
//# sourceMappingURL=Booking.d.ts.map