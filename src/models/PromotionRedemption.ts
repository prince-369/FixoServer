import mongoose, { Schema, Document } from 'mongoose';

export type PromotionRedemptionKind = 'bonus';

export interface IPromotionRedemption extends Document {
  promotion: mongoose.Types.ObjectId;
  worker: mongoose.Types.ObjectId;
  kind: PromotionRedemptionKind;

  // bonus payouts
  milestoneJobs?: number;
  bonusAmount?: number;

  createdAt: Date;
  updatedAt: Date;
}

const promotionRedemptionSchema = new Schema<IPromotionRedemption>(
  {
    promotion: { type: Schema.Types.ObjectId, ref: 'WorkerPromotion', required: true },
    worker: { type: Schema.Types.ObjectId, ref: 'Worker', required: true },
    kind: { type: String, enum: ['bonus'], required: true },
    milestoneJobs: { type: Number },
    bonusAmount: { type: Number },
  },
  { timestamps: true }
);

// Idempotent bonus: a worker can claim each bonus tier of a promotion only once.
promotionRedemptionSchema.index(
  { promotion: 1, worker: 1, milestoneJobs: 1 },
  { unique: true, partialFilterExpression: { kind: 'bonus' } }
);
promotionRedemptionSchema.index({ worker: 1, createdAt: -1 });

export default mongoose.model<IPromotionRedemption>('PromotionRedemption', promotionRedemptionSchema);
