import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  fullName: string;
  email: string;
  phone: string;
  password?: string;
  googleId?: string;
  profileImage?: string;
  bio?: string;
  isActive: boolean;
  deletedAt?: Date;
  deactivationOtpHash?: string;
  deactivationOtpExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

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
