import mongoose, { Document } from 'mongoose';
export interface IUser extends Document {
    fullName: string;
    email: string;
    phone: string;
    password?: string;
    googleId?: string;
    profileImage?: string;
    bio?: string;
    isActive: boolean;
    deletedAt?: Date;
    deactivationOtpHash?: string;
    deactivationOtpExpiresAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
declare const _default: mongoose.Model<IUser, {}, {}, {}, mongoose.Document<unknown, {}, IUser, {}, mongoose.DefaultSchemaOptions> & IUser & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IUser>;
export default _default;
//# sourceMappingURL=User.d.ts.map