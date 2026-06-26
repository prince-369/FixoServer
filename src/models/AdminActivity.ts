import mongoose, { Schema, Document } from 'mongoose';

/**
 * One row per meaningful staff action — used to show "who did how much":
 * tickets resolved, KYC approved/rejected, refunds/withdrawals processed,
 * coupons created, etc. Kept lightweight and append-only.
 */
export interface IAdminActivity extends Document {
  admin: mongoose.Types.ObjectId;
  adminEmail: string;
  role: string;
  action: string; // e.g. 'kyc.approve', 'refund.approve', 'ticket.resolve', 'coupon.create'
  category: string; // grouping: 'kyc' | 'refunds' | 'withdrawals' | 'support' | 'coupons' | ...
  targetType?: string; // 'worker' | 'customer' | 'booking' | 'ticket' | 'coupon' ...
  targetId?: string;
  amount?: number; // for money actions (refund/withdrawal amount)
  meta?: Record<string, unknown>;
  createdAt: Date;
}

const adminActivitySchema = new Schema<IAdminActivity>(
  {
    admin: { type: Schema.Types.ObjectId, ref: 'Admin', required: true, index: true },
    adminEmail: { type: String, default: '' },
    role: { type: String, default: '' },
    action: { type: String, required: true },
    category: { type: String, default: 'general', index: true },
    targetType: { type: String },
    targetId: { type: String },
    amount: { type: Number },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

adminActivitySchema.index({ createdAt: -1 });

export default mongoose.model<IAdminActivity>('AdminActivity', adminActivitySchema);
