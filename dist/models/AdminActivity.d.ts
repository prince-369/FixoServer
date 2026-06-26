import mongoose, { Document } from 'mongoose';
/**
 * One row per meaningful staff action — used to show "who did how much":
 * tickets resolved, KYC approved/rejected, refunds/withdrawals processed,
 * coupons created, etc. Kept lightweight and append-only.
 */
export interface IAdminActivity extends Document {
    admin: mongoose.Types.ObjectId;
    adminEmail: string;
    role: string;
    action: string;
    category: string;
    targetType?: string;
    targetId?: string;
    amount?: number;
    meta?: Record<string, unknown>;
    createdAt: Date;
}
declare const _default: mongoose.Model<IAdminActivity, {}, {}, {}, mongoose.Document<unknown, {}, IAdminActivity, {}, mongoose.DefaultSchemaOptions> & IAdminActivity & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IAdminActivity>;
export default _default;
//# sourceMappingURL=AdminActivity.d.ts.map