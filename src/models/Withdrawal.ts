import mongoose, { Schema, Document } from 'mongoose';

export type WithdrawalStatus = 'pending' | 'completed' | 'declined';

export interface IWithdrawal extends Document {
  worker: mongoose.Types.ObjectId;
  amount: number;
  bankDetails: {
    holderName: string;
    bankName: string;
    accountNumber: string;
    ifscCode: string;
  };
  status: WithdrawalStatus;
  declineReason?: string;
  requestedAt: Date;
  processedAt?: Date;
}

const withdrawalSchema = new Schema<IWithdrawal>(
  {
    worker: { type: Schema.Types.ObjectId, ref: 'Worker', required: true },
    amount: { type: Number, required: true, min: 1 },
    bankDetails: {
      holderName: { type: String, required: true },
      bankName: { type: String, required: true },
      accountNumber: { type: String, required: true },
      ifscCode: { type: String, required: true },
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'declined'],
      default: 'pending',
    },
    declineReason: { type: String },
    requestedAt: { type: Date, default: Date.now },
    processedAt: { type: Date },
  },
  { timestamps: true }
);

withdrawalSchema.index({ worker: 1, status: 1 });
withdrawalSchema.index({ status: 1 });

export default mongoose.model<IWithdrawal>('Withdrawal', withdrawalSchema);
