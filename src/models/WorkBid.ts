import mongoose, { Schema, Document } from 'mongoose';

export type BidStatus = 'pending' | 'accepted' | 'rejected';
export type NegotiationStatus = 'none' | 'customer_offered' | 'worker_offered' | 'agreed' | 'declined';

export interface INegotiationEntry {
  by: 'customer' | 'worker';
  amount: number;
  message: string;
  createdAt: Date;
}

export interface IWorkBid extends Document {
  booking: mongoose.Types.ObjectId;
  worker: mongoose.Types.ObjectId;
  priceOffered: number;
  status: BidStatus;
  negotiationStatus: NegotiationStatus;
  negotiations: INegotiationEntry[];
  agreedAmount?: number;
  createdAt: Date;
}

const workBidSchema = new Schema<IWorkBid>(
  {
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
    worker: { type: Schema.Types.ObjectId, ref: 'Worker', required: true },
    priceOffered: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
    },
    negotiationStatus: {
      type: String,
      enum: ['none', 'customer_offered', 'worker_offered', 'agreed', 'declined'],
      default: 'none',
    },
    negotiations: [
      {
        by: { type: String, enum: ['customer', 'worker'], required: true },
        amount: { type: Number, required: true },
        message: { type: String, default: '' },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    agreedAmount: { type: Number },
  },
  { timestamps: true }
);

workBidSchema.index({ booking: 1, worker: 1 }, { unique: true });
workBidSchema.index({ booking: 1, status: 1 });

export default mongoose.model<IWorkBid>('WorkBid', workBidSchema);
