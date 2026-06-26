import mongoose, { Schema, Document } from 'mongoose';

export type WorkerPromotionType = 'bonus_earning';
export type WorkerPromotionStatus = 'active' | 'paused';

export interface IBonusTier {
  jobsRequired: number;
  bonusAmount: number;
}

export interface IWorkerPromotion extends Document {
  title: string;
  description?: string;
  type: WorkerPromotionType;

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
      enum: ['bonus_earning'],
      required: true,
    },
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
