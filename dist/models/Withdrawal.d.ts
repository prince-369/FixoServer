import mongoose, { Document } from 'mongoose';
export type WithdrawalStatus = 'pending' | 'completed' | 'declined';
export interface IWithdrawal extends Document {
    worker: mongoose.Types.ObjectId;
    amount: number;
    bankDetails: {
        holderName: string;
        bankName: string;
        accountNumber: string;
        ifscCode: string;
    };
    status: WithdrawalStatus;
    declineReason?: string;
    requestedAt: Date;
    processedAt?: Date;
}
declare const _default: mongoose.Model<IWithdrawal, {}, {}, {}, mongoose.Document<unknown, {}, IWithdrawal, {}, mongoose.DefaultSchemaOptions> & IWithdrawal & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IWithdrawal>;
export default _default;
//# sourceMappingURL=Withdrawal.d.ts.map