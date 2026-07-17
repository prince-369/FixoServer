import mongoose, { Schema, Document } from 'mongoose';

/**
 * Pre-launch waitlist from the marketing site (fixoservice.in).
 *
 * Distinct from `Waitlist`, which is an in-app request from a signed-in customer
 * asking Fixo to expand to their location. This one is anonymous: a visitor leaves
 * an email or phone so we can tell them when Fixo goes live.
 */
export type LaunchSignupRole = 'customer' | 'worker';

export interface ILaunchSignup extends Document {
  contact: string;          // exactly what they typed (email or phone)
  email?: string;
  phone?: string;
  role: LaunchSignupRole;
  source: string;           // which form/page it came from
  notified: boolean;        // flipped once we email them at launch
  notifiedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const launchSignupSchema = new Schema<ILaunchSignup>(
  {
    contact: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    role: { type: String, enum: ['customer', 'worker'], default: 'customer', index: true },
    source: { type: String, default: 'landing' },
    notified: { type: Boolean, default: false, index: true },
    notifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// One row per contact — re-submitting the same email just updates the existing entry.
launchSignupSchema.index({ contact: 1 }, { unique: true });
launchSignupSchema.index({ createdAt: -1 });

export default mongoose.model<ILaunchSignup>('LaunchSignup', launchSignupSchema);
