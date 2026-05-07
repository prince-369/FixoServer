import mongoose, { Schema, Document } from 'mongoose';

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

const mobilePushTokenSchema = new Schema<IMobilePushToken>(
  {
    recipient: { type: Schema.Types.ObjectId, required: true, refPath: 'recipientModel' },
    recipientModel: { type: String, required: true, enum: ['User', 'Worker', 'Admin'] },
    token: { type: String, required: true, unique: true, trim: true },
    platform: { type: String, enum: ['android', 'ios', 'unknown'], default: 'unknown' },
    userAgent: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

mobilePushTokenSchema.index({ recipient: 1, recipientModel: 1, isActive: 1 });
mobilePushTokenSchema.index({ updatedAt: -1 });

export default mongoose.model<IMobilePushToken>('MobilePushToken', mobilePushTokenSchema);
