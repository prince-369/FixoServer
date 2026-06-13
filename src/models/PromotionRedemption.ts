import mongoose, { Schema, Document } from 'mongoose';

export type PromotionRedemptionKind = 'commission_saving' | 'bonus';

export interface IPromotionRedemption extends Document {
  promotion: mongoose.Types.ObjectId;
  worker: mongoose.Types.ObjectId;
  kind: PromotionRedemptionKind;

  // bonus payouts
  milestoneJobs?: number;
  bonusAmount?: number;

  // commission savings (per booking)
  booking?: mongoose.Types.ObjectId;
  commissionSaved?: number;
  appliedRate?: number;

  createdAt: Date;
  updatedAt: Date;
}

const promotionRedemptionSchema = new Schema<IPromotionRedemption>(
  {
    promotion: { type: Schema.Types.ObjectId, ref: 'WorkerPromotion', required: true },
    worker: { type: Schema.Types.ObjectId, ref: 'Worker', required: true },
    kind: { type: String, enum: ['commission_saving', 'bonus'], required: true },
    milestoneJobs: { type: Number },
    bonusAmount: { type: Number },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking' },
    commissionSaved: { type: Number },
    appliedRate: { type: Number },
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
