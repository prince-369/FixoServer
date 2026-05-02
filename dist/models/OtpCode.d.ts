import mongoose, { Document } from 'mongoose';
export interface IOtpCode extends Document {
    phone: string;
    purpose: 'password-reset';
    otpHash: string;
    expiresAt: Date;
    createdAt: Date;
}
declare const _default: mongoose.Model<IOtpCode, {}, {}, {}, mongoose.Document<unknown, {}, IOtpCode, {}, mongoose.DefaultSchemaOptions> & IOtpCode & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IOtpCode>;
export default _default;
//# sourceMappingURL=OtpCode.d.ts.map