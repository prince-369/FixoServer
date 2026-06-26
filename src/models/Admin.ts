import mongoose, { Schema, Document } from 'mongoose';
import { ROLE_KEYS } from '../config/adminPermissions';

export interface IAdmin extends Document {
  name: string;
  email: string;
  password: string;
  role: string;
  permissions: string[];
  isActive: boolean;
  createdBy?: mongoose.Types.ObjectId | null;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const adminSchema = new Schema<IAdmin>(
  {
    name: { type: String, default: 'Admin', trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    // 'super_admin' + the 9 staff roles (see config/adminPermissions). Legacy
    // records may still carry 'superadmin'; the auth layer normalises that.
    role: { type: String, enum: [...ROLE_KEYS, 'superadmin'], default: 'super_admin' },
    // Explicit permission grants. Empty → fall back to the role defaults.
    permissions: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model<IAdmin>('Admin', adminSchema);
