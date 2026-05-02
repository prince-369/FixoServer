import mongoose, { Document } from 'mongoose';
export interface IPasswordResetToken extends Document {
    userId: mongoose.Types.ObjectId;
    role: 'customer' | 'worker';
    tokenHash: string;
    expiresAt: Date;
    createdAt: Date;
}
declare const _default: mongoose.Model<IPasswordResetToken, {}, {}, {}, mongoose.Document<unknown, {}, IPasswordResetToken, {}, mongoose.DefaultSchemaOptions> & IPasswordResetToken & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IPasswordResetToken>;
export default _default;
//# sourceMappingURL=PasswordResetToken.d.ts.map