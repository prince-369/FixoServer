import mongoose, { Schema, Document } from 'mongoose';

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

const pushSubscriptionSchema = new Schema<IPushSubscription>(
  {
    recipient: { type: Schema.Types.ObjectId, required: true, refPath: 'recipientModel' },
    recipientModel: { type: String, required: true, enum: ['User', 'Worker', 'Admin'] },
    endpoint: { type: String, required: true, unique: true, trim: true },
    expirationTime: { type: Number, default: null },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    userAgent: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

pushSubscriptionSchema.index({ recipient: 1, recipientModel: 1, isActive: 1 });
pushSubscriptionSchema.index({ updatedAt: -1 });

export default mongoose.model<IPushSubscription>('PushSubscription', pushSubscriptionSchema);
