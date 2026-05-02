import mongoose, { Schema, Document } from 'mongoose';

export type TransactionType = 'booking_payment' | 'worker_earning' | 'refund' | 'withdrawal' | 'commission' | 'dues_deposit' | 'dues_auto_deduct' | 'dues_wallet_deduct';
export type TransactionMethod = 'online' | 'cash';
export type TransactionStatus = 'pending' | 'completed' | 'failed';

export interface ITransaction extends Document {
  tid: string;
  booking?: mongoose.Types.ObjectId;
  user?: mongoose.Types.ObjectId;
  worker?: mongoose.Types.ObjectId;
  type: TransactionType;
  amount: number;
  method: TransactionMethod;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  status: TransactionStatus;
  createdAt: Date;
}

const transactionSchema = new Schema<ITransaction>(
  {
    tid: { type: String, required: true, unique: true },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking' },
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    worker: { type: Schema.Types.ObjectId, ref: 'Worker' },
    type: {
      type: String,
      enum: ['booking_payment', 'worker_earning', 'refund', 'withdrawal', 'commission', 'dues_deposit', 'dues_auto_deduct', 'dues_wallet_deduct'],
      required: true,
    },
    amount: { type: Number, required: true },
    method: { type: String, enum: ['online', 'cash'], required: true },
    razorpayPaymentId: { type: String },
    razorpayOrderId: { type: String },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

transactionSchema.index({ tid: 1 });
transactionSchema.index({ user: 1, type: 1 });
transactionSchema.index({ worker: 1, type: 1 });

export default mongoose.model<ITransaction>('Transaction', transactionSchema);
