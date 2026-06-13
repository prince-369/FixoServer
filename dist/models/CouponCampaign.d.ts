import mongoose, { Document } from 'mongoose';
export type CouponDiscountType = 'percentage' | 'flat';
export type CouponStatus = 'active' | 'paused';
export interface ICouponCampaign extends Document {
    code: string;
    title: string;
    description?: string;
    discountType: CouponDiscountType;
    discountValue: number;
    minOrderAmount: number;
    maxDiscount?: number | null;
    expiresAt?: Date | null;
    usageLimit?: number | null;
    perUserLimit: number;
    usedCount: number;
    budgetLimit?: number | null;
    spentBudget: number;
    isActive: boolean;
    status: CouponStatus;
    createdBy?: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
declare const _default: mongoose.Model<ICouponCampaign, {}, {}, {}, mongoose.Document<unknown, {}, ICouponCampaign, {}, mongoose.DefaultSchemaOptions> & ICouponCampaign & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, ICouponCampaign>;
export default _default;
//# sourceMappingURL=CouponCampaign.d.ts.map