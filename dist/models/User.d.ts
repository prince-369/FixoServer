import mongoose, { Schema, Document } from 'mongoose';
export interface IBlockInfo {
    isBlocked: boolean;
    reason?: string;
    blockedAt?: Date | null;
    blockedUntil?: Date | null;
    blockedBy?: mongoose.Types.ObjectId | null;
    blockCount: number;
}
export interface IUser extends Document {
    fullName: string;
    email: string;
    phone: string;
    password?: string;
    googleId?: string;
    profileImage?: string;
    bio?: string;
    isActive: boolean;
    block?: IBlockInfo;
    deletedAt?: Date;
    deactivationOtpHash?: string;
    deactivationOtpExpiresAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const blockSchemaDefinition: {
    isBlocked: {
        type: BooleanConstructor;
        default: boolean;
    };
    reason: {
        type: StringConstructor;
        default: string;
    };
    blockedAt: {
        type: DateConstructor;
        default: null;
    };
    blockedUntil: {
        type: DateConstructor;
        default: null;
    };
    blockedBy: {
        type: typeof Schema.Types.ObjectId;
        ref: string;
        default: null;
    };
    blockCount: {
        type: NumberConstructor;
        default: number;
    };
};
declare const _default: mongoose.Model<IUser, {}, {}, {}, mongoose.Document<unknown, {}, IUser, {}, mongoose.DefaultSchemaOptions> & IUser & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IUser>;
export default _default;
//# sourceMappingURL=User.d.ts.map