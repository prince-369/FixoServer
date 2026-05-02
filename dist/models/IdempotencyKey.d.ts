import mongoose, { Document } from 'mongoose';
export type IdempotencyState = 'in-progress' | 'completed';
export interface IIdempotencyKey extends Document {
    key: string;
    state: IdempotencyState;
    statusCode?: number;
    body?: unknown;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
declare const _default: mongoose.Model<IIdempotencyKey, {}, {}, {}, mongoose.Document<unknown, {}, IIdempotencyKey, {}, mongoose.DefaultSchemaOptions> & IIdempotencyKey & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IIdempotencyKey>;
export default _default;
//# sourceMappingURL=IdempotencyKey.d.ts.map