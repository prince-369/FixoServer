import mongoose, { Schema, Document } from 'mongoose';

export type WorkerPromotionType = 'reduced_commission' | 'zero_commission' | 'bonus_earning';
export type WorkerPromotionStatus = 'active' | 'paused';
export type ZeroCommissionScope = 'first_orders' | 'date_range';

export interface IBonusTier {
  jobsRequired: number;
  bonusAmount: number;
}

export interface IWorkerPromotion extends Document {
  title: string;
  description?: string;
  type: WorkerPromotionType;

  // reduced_commission
  commissionRate?: number;          // e.g. 0.10 (10%)

  // zero_commission
  zeroCommissionScope?: ZeroCommissionScope;
  firstOrdersCount?: number;        // for 'first_orders' scope

  // bonus_earning
  bonusTiers?: IBonusTier[];

  // targeting
  appliesToAllWorkers: boolean;
  targetWorkers: mongoose.Types.ObjectId[];

  // schedule
  startsAt: Date;
  endsAt?: Date | null;
  durationDays?: number;

  // budget
  budgetLimit?: number | null;
  spentBudget: number;

  isActive: boolean;
  status: WorkerPromotionStatus;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const workerPromotionSchema = new Schema<IWorkerPromotion>(
  {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    type: {
      type: String,
      enum: ['reduced_commission', 'zero_commission', 'bonus_earning'],
      required: true,
    },
    commissionRate: { type: Number, min: 0, max: 1 },
    zeroCommissionScope: { type: String, enum: ['first_orders', 'date_range'] },
    firstOrdersCount: { type: Number, min: 1 },
    bonusTiers: [{
      jobsRequired: { type: Number, required: true, min: 1 },
      bonusAmount: { type: Number, required: true, min: 0 },
    }],
    appliesToAllWorkers: { type: Boolean, default: true },
    targetWorkers: [{ type: Schema.Types.ObjectId, ref: 'Worker' }],
    startsAt: { type: Date, default: Date.now },
    endsAt: { type: Date, default: null },
    durationDays: { type: Number },
    budgetLimit: { type: Number, default: null },
    spentBudget: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    status: { type: String, enum: ['active', 'paused'], default: 'active' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true }
);

workerPromotionSchema.index({ status: 1, isActive: 1, startsAt: 1, endsAt: 1 });
workerPromotionSchema.index({ type: 1, isActive: 1 });

export default mongoose.model<IWorkerPromotion>('WorkerPromotion', workerPromotionSchema);
