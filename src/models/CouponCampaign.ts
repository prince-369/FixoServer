import mongoose, { Schema, Document } from 'mongoose';

export type CouponDiscountType = 'percentage' | 'flat';
export type CouponStatus = 'active' | 'paused';

export interface ICouponCampaign extends Document {
  code: string;            // uppercase, unique
  title: string;
  description?: string;
  discountType: CouponDiscountType;
  discountValue: number;   // percent (e.g. 20) or flat rupees (e.g. 100)
  minOrderAmount: number;
  maxDiscount?: number | null;    // cap for percentage coupons
  expiresAt?: Date | null;
  usageLimit?: number | null;  // global cap, null = unlimited
  perUserLimit: number;
  usedCount: number;       // denormalized counter
  budgetLimit?: number | null; // max total discount spend
  spentBudget: number;
  isActive: boolean;
  status: CouponStatus;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const couponCampaignSchema = new Schema<ICouponCampaign>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    discountType: { type: String, enum: ['percentage', 'flat'], required: true },
    discountValue: { type: Number, required: true, min: 0 },
    minOrderAmount: { type: Number, default: 0 },
    maxDiscount: { type: Number, default: null },
    expiresAt: { type: Date, default: null },
    usageLimit: { type: Number, default: null },
    perUserLimit: { type: Number, default: 1 },
    usedCount: { type: Number, default: 0 },
    budgetLimit: { type: Number, default: null },
    spentBudget: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    status: { type: String, enum: ['active', 'paused'], default: 'active' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true }
);

couponCampaignSchema.index({ isActive: 1, status: 1, expiresAt: 1 });

export default mongoose.model<ICouponCampaign>('CouponCampaign', couponCampaignSchema);
