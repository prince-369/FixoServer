import mongoose, { Document, Schema } from 'mongoose';

export interface IOtpCode extends Document {
  phone: string;
  purpose: 'password-reset';
  otpHash: string;
  expiresAt: Date;
  createdAt: Date;
}

const otpCodeSchema = new Schema<IOtpCode>(
  {
    phone: { type: String, required: true },
    purpose: { type: String, enum: ['password-reset'], required: true, default: 'password-reset' },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

otpCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpCodeSchema.index({ phone: 1, purpose: 1 }, { unique: true });

export default mongoose.model<IOtpCode>('OtpCode', otpCodeSchema);
