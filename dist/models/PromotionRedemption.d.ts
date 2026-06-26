import mongoose, { Document } from 'mongoose';
export type PromotionRedemptionKind = 'bonus';
export interface IPromotionRedemption extends Document {
    promotion: mongoose.Types.ObjectId;
    worker: mongoose.Types.ObjectId;
    kind: PromotionRedemptionKind;
    milestoneJobs?: number;
    bonusAmount?: number;
    createdAt: Date;
    updatedAt: Date;
}
declare const _default: mongoose.Model<IPromotionRedemption, {}, {}, {}, mongoose.Document<unknown, {}, IPromotionRedemption, {}, mongoose.DefaultSchemaOptions> & IPromotionRedemption & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IPromotionRedemption>;
export default _default;
//# sourceMappingURL=PromotionRedemption.d.ts.map