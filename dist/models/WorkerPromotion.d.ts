import mongoose, { Document } from 'mongoose';
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
    commissionRate?: number;
    zeroCommissionScope?: ZeroCommissionScope;
    firstOrdersCount?: number;
    bonusTiers?: IBonusTier[];
    appliesToAllWorkers: boolean;
    targetWorkers: mongoose.Types.ObjectId[];
    startsAt: Date;
    endsAt?: Date | null;
    durationDays?: number;
    budgetLimit?: number | null;
    spentBudget: number;
    isActive: boolean;
    status: WorkerPromotionStatus;
    createdBy?: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
declare const _default: mongoose.Model<IWorkerPromotion, {}, {}, {}, mongoose.Document<unknown, {}, IWorkerPromotion, {}, mongoose.DefaultSchemaOptions> & IWorkerPromotion & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IWorkerPromotion>;
export default _default;
//# sourceMappingURL=WorkerPromotion.d.ts.map