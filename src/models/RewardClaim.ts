import mongoose, { Schema, Document } from 'mongoose';

export type RewardClaimStatus = 'pending_approval' | 'approved' | 'paid' | 'rejected';
export type RewardPayoutMethod = 'upi' | 'bank';

export interface IRewardPayoutDetails {
  method: RewardPayoutMethod;
  upiId?: string;
  bankAccountNumber?: string;
  ifscCode?: string;
  bankName?: string;
  holderName?: string;
}

export interface IRewardClaim extends Document {
  customer: mongoose.Types.ObjectId;
  milestone: mongoose.Types.ObjectId;
  milestoneKey: string;        // denormalized for the unique guard
  bookingsRequired: number;
  rewardAmount: number;
  status: RewardClaimStatus;
  payoutDetails: IRewardPayoutDetails;
  eligibleCountAtClaim: number; // snapshot used for audit / fraud review
  rejectionReason?: string;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  paidAt?: Date;
  adminOverride?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const rewardClaimSchema = new Schema<IRewardClaim>(
  {
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    milestone: { type: Schema.Types.ObjectId, ref: 'RewardMilestone', required: true },
    milestoneKey: { type: String, required: true },
    bookingsRequired: { type: Number, required: true },
    rewardAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending_approval', 'approved', 'paid', 'rejected'],
      default: 'pending_approval',
    },
    payoutDetails: {
      method: { type: String, enum: ['upi', 'bank'], required: true },
      upiId: { type: String },
      bankAccountNumber: { type: String },
      ifscCode: { type: String },
      bankName: { type: String },
      holderName: { type: String },
    },
    eligibleCountAtClaim: { type: Number, required: true },
    rejectionReason: { type: String },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
    reviewedAt: { type: Date },
    paidAt: { type: Date },
    adminOverride: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// CRITICAL anti-fraud: one claim per customer per milestone, ever.
rewardClaimSchema.index({ customer: 1, milestoneKey: 1 }, { unique: true });
rewardClaimSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model<IRewardClaim>('RewardClaim', rewardClaimSchema);
