import mongoose, { Schema, Document } from 'mongoose';

export type BookingStatus =
  | 'finding_workers'
  | 'bids_received'
  | 'worker_accepted'
  | 'worker_approved'
  | 'payment_done'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type PaymentMethod = 'online' | 'cash';
export type PaymentStatus = 'pending' | 'paid' | 'refund_pending' | 'refunded';
export type RefundStatus = 'pending' | 'completed';
export type BookingTimeSlot = 'anytime' | 'morning' | 'afternoon' | 'evening';

export interface IBooking extends Document {
  customer: mongoose.Types.ObjectId;
  category: mongoose.Types.ObjectId;
  workDescription: string;
  voiceNote?: {
    url: string;
    publicId: string;
    mimeType?: string;
    durationSec?: number;
    language?: string;
    transcript?: string;
    createdAt: Date;
  };
  customerLocation: {
    type: string;
    coordinates: number[];
    address: string;
  };
  timeSlot?: BookingTimeSlot;
  status: BookingStatus;
  acceptedBid?: mongoose.Types.ObjectId;
  assignedWorker?: mongoose.Types.ObjectId;
  paymentMethod?: PaymentMethod;
  paymentStatus: PaymentStatus;
  amount: number;
  cashSurcharge: number;
  couponCode?: string;
  couponCampaign?: mongoose.Types.ObjectId;
  discountAmount: number;
  completionPin?: string;
  completionRequestedByWorkerAt?: Date;
  completionCodeRevealedAt?: Date;
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

const bookingSchema = new Schema<IBooking>(
  {
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    workDescription: { type: String, required: true },
    voiceNote: {
      url: { type: String },
      publicId: { type: String },
      mimeType: { type: String },
      durationSec: { type: Number },
      language: { type: String },
      transcript: { type: String },
      createdAt: { type: Date },
    },
    customerLocation: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true },
      address: { type: String, required: true },
    },
    timeSlot: {
      type: String,
      enum: ['anytime', 'morning', 'afternoon', 'evening'],
      default: 'anytime',
    },
    status: {
      type: String,
      enum: ['finding_workers', 'bids_received', 'worker_accepted', 'worker_approved', 'payment_done', 'in_progress', 'completed', 'cancelled'],
      default: 'finding_workers',
    },
    acceptedBid: { type: Schema.Types.ObjectId, ref: 'WorkBid' },
    assignedWorker: { type: Schema.Types.ObjectId, ref: 'Worker' },
    paymentMethod: { type: String, enum: ['online', 'cash'] },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'refund_pending', 'refunded'],
      default: 'pending',
    },
    amount: { type: Number, default: 0 },
    cashSurcharge: { type: Number, default: 0 },
    couponCode: { type: String },
    couponCampaign: { type: Schema.Types.ObjectId, ref: 'CouponCampaign' },
    discountAmount: { type: Number, default: 0 },
    completionPin: { type: String },
    completionRequestedByWorkerAt: { type: Date },
    completionCodeRevealedAt: { type: Date },
    workerMessage: { type: String },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    cancellation: {
      cancelledBy: { type: String, enum: ['customer', 'worker', 'admin'] },
      reason: { type: String },
      cancelledAt: { type: Date },
    },
    refundDetails: {
      upiId: { type: String },
      bankAccountNumber: { type: String },
      ifscCode: { type: String },
      bankName: { type: String },
      holderName: { type: String },
      status: { type: String, enum: ['pending', 'completed'] },
      processedAt: { type: Date },
    },
    review: {
      rating: { type: Number, min: 1, max: 5 },
      feedback: { type: String },
      createdAt: { type: Date },
    },
  },
  { timestamps: true }
);

bookingSchema.index({ customer: 1, status: 1 });
bookingSchema.index({ assignedWorker: 1, status: 1 });
bookingSchema.index({ customer: 1, createdAt: -1 });
bookingSchema.index({ assignedWorker: 1, createdAt: -1 });
bookingSchema.index({ customerLocation: '2dsphere' });
bookingSchema.index({ status: 1 });
bookingSchema.index({ status: 1, createdAt: 1 });

export default mongoose.model<IBooking>('Booking', bookingSchema);
