import mongoose, { Document } from 'mongoose';
export interface IPushSubscription extends Document {
    recipient: mongoose.Types.ObjectId;
    recipientModel: 'User' | 'Worker' | 'Admin';
    endpoint: string;
    expirationTime?: number | null;
    keys: {
        p256dh: string;
        auth: string;
    };
    userAgent?: string;
    isActive: boolean;
    lastSeenAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
declare const _default: mongoose.Model<IPushSubscription, {}, {}, {}, mongoose.Document<unknown, {}, IPushSubscription, {}, mongoose.DefaultSchemaOptions> & IPushSubscription & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IPushSubscription>;
export default _default;
//# sourceMappingURL=PushSubscription.d.ts.map