import mongoose, { Document } from 'mongoose';
export type BidStatus = 'pending' | 'accepted' | 'rejected';
export interface IWorkBid extends Document {
    booking: mongoose.Types.ObjectId;
    worker: mongoose.Types.ObjectId;
    priceOffered: number;
    status: BidStatus;
    createdAt: Date;
}
declare const _default: mongoose.Model<IWorkBid, {}, {}, {}, mongoose.Document<unknown, {}, IWorkBid, {}, mongoose.DefaultSchemaOptions> & IWorkBid & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IWorkBid>;
export default _default;
//# sourceMappingURL=WorkBid.d.ts.map