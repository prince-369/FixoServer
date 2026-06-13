import mongoose, { Document } from 'mongoose';
export type RewardClaimStatus = 'pending_approval' | 'approved' | 'paid' | 'rejected';
export type RewardPayoutMethod = 'upi' | 'bank';
export interface IRewardPayoutDetails {
    method: RewardPayoutMethod;
    upiId?: string;
    bankAccountNumber?: string;
    ifscCode?: string;
    bankName?: string;
    holderName?: string;
}
export interface IRewardClaim extends Document {
    customer: mongoose.Types.ObjectId;
    milestone: mongoose.Types.ObjectId;
    milestoneKey: string;
    bookingsRequired: number;
    rewardAmount: number;
    status: RewardClaimStatus;
    payoutDetails: IRewardPayoutDetails;
    eligibleCountAtClaim: number;
    rejectionReason?: string;
    reviewedBy?: mongoose.Types.ObjectId;
    reviewedAt?: Date;
    paidAt?: Date;
    adminOverride?: boolean;
    createdAt: Date;
    updatedAt: Date;
}
declare const _default: mongoose.Model<IRewardClaim, {}, {}, {}, mongoose.Document<unknown, {}, IRewardClaim, {}, mongoose.DefaultSchemaOptions> & IRewardClaim & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IRewardClaim>;
export default _default;
//# sourceMappingURL=RewardClaim.d.ts.map