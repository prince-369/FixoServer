import mongoose, { Schema, Document } from 'mongoose';

export interface IRewardMilestone extends Document {
  key: string;            // stable identifier e.g. "m10", "m20"
  bookingsRequired: number;
  rewardAmount: number;
  label: string;
  isActive: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const rewardMilestoneSchema = new Schema<IRewardMilestone>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    bookingsRequired: { type: Number, required: true, min: 1 },
    rewardAmount: { type: Number, required: true, min: 0 },
    label: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

rewardMilestoneSchema.index({ isActive: 1, order: 1 });

export default mongoose.model<IRewardMilestone>('RewardMilestone', rewardMilestoneSchema);
