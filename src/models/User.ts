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

// Shared temporary-block sub-document (used by User and Worker).
export const blockSchemaDefinition = {
  isBlocked: { type: Boolean, default: false },
  reason: { type: String, default: '' },
  blockedAt: { type: Date, default: null },
  blockedUntil: { type: Date, default: null },
  blockedBy: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
  blockCount: { type: Number, default: 0 },
};

const userSchema = new Schema<IUser>(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    password: { type: String, select: false },
    googleId: { type: String, sparse: true },
    profileImage: { type: String, default: '' },
    bio: { type: String, default: '', maxlength: 500 },
    isActive: { type: Boolean, default: true },
    block: { type: blockSchemaDefinition, default: () => ({}) },
    deletedAt: { type: Date },
    deactivationOtpHash: { type: String, select: false },
    deactivationOtpExpiresAt: { type: Date, select: false },
  },
  { timestamps: true }
);

userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ isActive: 1 });

export default mongoose.model<IUser>('User', userSchema);
