import mongoose, { Document } from 'mongoose';
export interface ICounter extends Document {
    key: string;
    seq: number;
}
declare const _default: mongoose.Model<ICounter, {}, {}, {}, mongoose.Document<unknown, {}, ICounter, {}, mongoose.DefaultSchemaOptions> & ICounter & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, ICounter>;
export default _default;
//# sourceMappingURL=Counter.d.ts.map