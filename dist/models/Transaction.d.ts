import mongoose, { Document } from 'mongoose';
export type TransactionType = 'booking_payment' | 'worker_earning' | 'refund' | 'withdrawal' | 'commission' | 'dues_deposit' | 'dues_auto_deduct' | 'dues_wallet_deduct' | 'reward_payout' | 'worker_bonus';
export type TransactionMethod = 'online' | 'cash';
export type TransactionStatus = 'pending' | 'completed' | 'failed';
export interface ITransaction extends Document {
    tid: string;
    booking?: mongoose.Types.ObjectId;
    user?: mongoose.Types.ObjectId;
    worker?: mongoose.Types.ObjectId;
    type: TransactionType;
    amount: number;
    method: TransactionMethod;
    razorpayPaymentId?: string;
    razorpayOrderId?: string;
    status: TransactionStatus;
    createdAt: Date;
}
declare const _default: mongoose.Model<ITransaction, {}, {}, {}, mongoose.Document<unknown, {}, ITransaction, {}, mongoose.DefaultSchemaOptions> & ITransaction & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, ITransaction>;
export default _default;
//# sourceMappingURL=Transaction.d.ts.map