import mongoose, { Document } from 'mongoose';
/**
 * A customer asks Fixo to come to a location where no worker is available yet.
 * Admin reviews these to decide where to expand the service.
 */
export interface IWaitlist extends Document {
    user: mongoose.Types.ObjectId;
    location: {
        type: string;
        coordinates: number[];
        address: string;
    };
    status: 'pending' | 'reached';
    createdAt: Date;
    updatedAt: Date;
}
declare const _default: mongoose.Model<IWaitlist, {}, {}, {}, mongoose.Document<unknown, {}, IWaitlist, {}, mongoose.DefaultSchemaOptions> & IWaitlist & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IWaitlist>;
export default _default;
//# sourceMappingURL=Waitlist.d.ts.map