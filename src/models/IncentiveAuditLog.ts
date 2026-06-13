import mongoose, { Schema, Document } from 'mongoose';

export type AuditActorModel = 'User' | 'Worker' | 'Admin' | 'System';

export interface IIncentiveAuditLog extends Document {
  action: string;          // e.g. 'reward_claim_created', 'coupon_redeemed', 'bonus_paid'
  actorId?: mongoose.Types.ObjectId;
  actorModel: AuditActorModel;
  targetType?: string;     // e.g. 'RewardClaim', 'CouponCampaign'
  targetId?: mongoose.Types.ObjectId;
  amount?: number;
  reason?: string;
  meta?: Record<string, unknown>;
  createdAt: Date;
}

const incentiveAuditLogSchema = new Schema<IIncentiveAuditLog>(
  {
    action: { type: String, required: true },
    actorId: { type: Schema.Types.ObjectId },
    actorModel: { type: String, enum: ['User', 'Worker', 'Admin', 'System'], default: 'System' },
    targetType: { type: String },
    targetId: { type: Schema.Types.ObjectId },
    amount: { type: Number },
    reason: { type: String },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

incentiveAuditLogSchema.index({ actorId: 1, createdAt: -1 });
incentiveAuditLogSchema.index({ action: 1, createdAt: -1 });
incentiveAuditLogSchema.index({ targetType: 1, targetId: 1 });

export default mongoose.model<IIncentiveAuditLog>('IncentiveAuditLog', incentiveAuditLogSchema);
