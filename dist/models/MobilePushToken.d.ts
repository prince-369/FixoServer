import mongoose, { Document } from 'mongoose';
export type MobilePlatform = 'android' | 'ios' | 'unknown';
export interface IMobilePushToken extends Document {
    recipient: mongoose.Types.ObjectId;
    recipientModel: 'User' | 'Worker' | 'Admin';
    token: string;
    platform: MobilePlatform;
    userAgent?: string;
    isActive: boolean;
    lastSeenAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
declare const _default: mongoose.Model<IMobilePushToken, {}, {}, {}, mongoose.Document<unknown, {}, IMobilePushToken, {}, mongoose.DefaultSchemaOptions> & IMobilePushToken & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IMobilePushToken>;
export default _default;
//# sourceMappingURL=MobilePushToken.d.ts.map