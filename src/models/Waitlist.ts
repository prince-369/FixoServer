import mongoose, { Schema, Document } from 'mongoose';

/**
 * A customer asks Fixo to come to a location where no worker is available yet.
 * Admin reviews these to decide where to expand the service.
 */
export interface IWaitlist extends Document {
  user: mongoose.Types.ObjectId;
  location: {
    type: string;
    coordinates: number[];
    address: string;
  };
  status: 'pending' | 'reached';
  createdAt: Date;
  updatedAt: Date;
}

const waitlistSchema = new Schema<IWaitlist>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true },
      address: { type: String, default: '' },
    },
    status: { type: String, enum: ['pending', 'reached'], default: 'pending', index: true },
  },
  { timestamps: true }
);

waitlistSchema.index({ location: '2dsphere' });
waitlistSchema.index({ createdAt: -1 });

export default mongoose.model<IWaitlist>('Waitlist', waitlistSchema);
