import mongoose, { Schema, Document } from 'mongoose';

export type BidStatus = 'pending' | 'accepted' | 'rejected';

export interface IWorkBid extends Document {
  booking: mongoose.Types.ObjectId;
  worker: mongoose.Types.ObjectId;
  priceOffered: number;
  status: BidStatus;
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
  },
  { timestamps: true }
);

workBidSchema.index({ booking: 1, worker: 1 }, { unique: true });
workBidSchema.index({ booking: 1, status: 1 });

export default mongoose.model<IWorkBid>('WorkBid', workBidSchema);
