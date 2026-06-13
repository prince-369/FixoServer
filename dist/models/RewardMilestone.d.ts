import mongoose, { Document } from 'mongoose';
export interface IRewardMilestone extends Document {
    key: string;
    bookingsRequired: number;
    rewardAmount: number;
    label: string;
    isActive: boolean;
    order: number;
    createdAt: Date;
    updatedAt: Date;
}
declare const _default: mongoose.Model<IRewardMilestone, {}, {}, {}, mongoose.Document<unknown, {}, IRewardMilestone, {}, mongoose.DefaultSchemaOptions> & IRewardMilestone & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IRewardMilestone>;
export default _default;
//# sourceMappingURL=RewardMilestone.d.ts.map