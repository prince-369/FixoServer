import mongoose, { Document } from 'mongoose';
export type AuditActorModel = 'User' | 'Worker' | 'Admin' | 'System';
export interface IIncentiveAuditLog extends Document {
    action: string;
    actorId?: mongoose.Types.ObjectId;
    actorModel: AuditActorModel;
    targetType?: string;
    targetId?: mongoose.Types.ObjectId;
    amount?: number;
    reason?: string;
    meta?: Record<string, unknown>;
    createdAt: Date;
}
declare const _default: mongoose.Model<IIncentiveAuditLog, {}, {}, {}, mongoose.Document<unknown, {}, IIncentiveAuditLog, {}, mongoose.DefaultSchemaOptions> & IIncentiveAuditLog & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IIncentiveAuditLog>;
export default _default;
//# sourceMappingURL=IncentiveAuditLog.d.ts.map