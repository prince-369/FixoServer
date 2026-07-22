import mongoose, { Schema, Document } from 'mongoose';
import { blockSchemaDefinition, type IBlockInfo } from './User';

// Account lifecycle only. Verification lives in `verificationStatus` — a worker goes
// 'live' once they are verification-approved AND have completed their profile.
export type WorkerAccountStatus = 'test' | 'live';

// The single source of truth for the manual verification workflow.
//  unsubmitted → worker is still onboarding (hasn't submitted for verification yet)
//  pending     → submitted, waiting for an admin to contact + decide
//  approved    → admin verified the worker over a call
//  rejected    → admin rejected with a mandatory reason
//  resubmitted → worker fixed the rejection reason and submitted again
export type WorkerVerificationStatus = 'unsubmitted' | 'pending' | 'approved' | 'rejected' | 'resubmitted';

// Preferred window for the admin's manual verification call.
export type VerificationSlot = '10:00-13:00' | '13:00-16:00' | '16:00-20:00';

export const VERIFICATION_SLOTS: VerificationSlot[] = ['10:00-13:00', '13:00-16:00', '16:00-20:00'];

export const VERIFICATION_SLOT_LABELS: Record<VerificationSlot, string> = {
  '10:00-13:00': '10:00 AM – 1:00 PM',
  '13:00-16:00': '1:00 PM – 4:00 PM',
  '16:00-20:00': '4:00 PM – 8:00 PM',
};

export interface IBankDetails {
  holderName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
}

export type WorkerSkillStatus = 'pending_kyc' | 'approved' | 'pending_review' | 'rejected';

export interface IWorkerSkill {
  category: mongoose.Types.ObjectId;
  experienceYears: number;
  confirmed: boolean; // worker clicked "Yes, I can do this work"
  status: WorkerSkillStatus;
  experienceBumpsUsed: number; // each bump = +6 months, gated by account age
  rejectionReason?: string;
  callAttempts: number; // admin call attempts during skill review
  requestedAt?: Date;
  decidedAt?: Date | null;
}

export interface IWorker extends Document {
  fullName: string;
  phone: string;
  email?: string;
  password?: string;
  googleId?: string;
  aadhaarFront: string;
  aadhaarBack: string;
  // Extracted at onboarding for duplicate detection. The number itself is stored
  // only as a one-way hash (never plaintext); last4 + name + dob are for display.
  aadhaarNumberHash?: string;
  aadhaarNumberLast4?: string;
  aadhaarName?: string;
  aadhaarDob?: string;
  accountStatus: WorkerAccountStatus;
  // ── Manual verification workflow ──
  verificationStatus: WorkerVerificationStatus;
  // Worker's preferred window for the admin's verification call.
  verificationSlot?: VerificationSlot | null;
  // Active WhatsApp number the admin will use to reach the worker (10-digit Indian).
  whatsappNumber?: string;
  // Mandatory when the admin rejects — shown to the worker so they can fix and resubmit.
  rejectionReason?: string;
  verifiedBy?: mongoose.Types.ObjectId | null;
  verifiedAt?: Date | null;
  verificationSubmittedAt?: Date | null;
  resubmittedAt?: Date | null;
  profileCompleted: boolean;
  location: {
    type: string;
    coordinates: number[];
    address: string;
  };
  // Live/dynamic location for job matching — updates as the worker moves.
  // Falls back to `location` (the static signup location) when not set.
  currentLocation?: {
    type: string;
    coordinates: number[];
    address?: string;
    updatedAt?: Date;
  };
  categories: mongoose.Types.ObjectId[];
  skills?: IWorkerSkill[];
  bio: string;
  regularPhone: string;
  extraPhones: string[];
  profileImage: string;
  isActive: boolean;
  balance: number;
  bankDetails?: IBankDetails;
  rating: {
    average: number;
    count: number;
  };
  totalWorkDone: number;
  totalEarnings: number;
  block?: IBlockInfo;
  createdAt: Date;
  updatedAt: Date;
}

// Live/dynamic worker location. `coordinates` is required so the subdocument can never
// exist as an incomplete GeoJSON Point — the whole field is simply absent until the
// worker reports a position (see `currentLocation` below).
const currentLocationSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true },
    address: { type: String, default: '' },
    updatedAt: { type: Date, default: null },
  },
  { _id: false },
);

const workerSchema = new Schema<IWorker>(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    email: { type: String, lowercase: true, trim: true, sparse: true },
    password: { type: String, select: false },
    googleId: { type: String, sparse: true },
    // Aadhaar is uploaded during onboarding (after the account is created), so it
    // is optional at creation time and defaults to empty until the worker submits it.
    aadhaarFront: { type: String, default: '' },
    aadhaarBack: { type: String, default: '' },
    aadhaarNumberHash: { type: String, default: '' },
    aadhaarNumberLast4: { type: String, default: '' },
    aadhaarName: { type: String, default: '' },
    aadhaarDob: { type: String, default: '' },
    accountStatus: {
      type: String,
      enum: ['test', 'live'],
      default: 'test',
    },
    verificationStatus: {
      type: String,
      enum: ['unsubmitted', 'pending', 'approved', 'rejected', 'resubmitted'],
      default: 'unsubmitted',
    },
    verificationSlot: {
      type: String,
      enum: [...VERIFICATION_SLOTS, null],
      default: null,
    },
    whatsappNumber: { type: String, default: '', trim: true },
    rejectionReason: { type: String, default: '' },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
    verifiedAt: { type: Date, default: null },
    verificationSubmittedAt: { type: Date, default: null },
    resubmittedAt: { type: Date, default: null },
    profileCompleted: { type: Boolean, default: false },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] },
      address: { type: String, default: '' },
    },
    // Defined as a sub-schema with `default: undefined` so the field stays ABSENT
    // until the worker actually reports a live location. Declaring it inline would
    // materialise `{ type: 'Point' }` with no coordinates on every insert, which the
    // 2dsphere index rejects ("Can't extract geo keys … Point must be an array").
    currentLocation: { type: currentLocationSchema, default: undefined },
    categories: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    skills: [{
      category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
      experienceYears: { type: Number, default: 0 },
      confirmed: { type: Boolean, default: false },
      status: { type: String, enum: ['pending_kyc', 'approved', 'pending_review', 'rejected'], default: 'pending_kyc' },
      experienceBumpsUsed: { type: Number, default: 0 },
      rejectionReason: { type: String, default: '' },
      callAttempts: { type: Number, default: 0 },
      requestedAt: { type: Date, default: Date.now },
      decidedAt: { type: Date, default: null },
    }],
    bio: { type: String, default: '', maxlength: 1000 },
    regularPhone: { type: String, default: '' },
    extraPhones: [{ type: String }],
    profileImage: { type: String, default: '' },
    isActive: { type: Boolean, default: false },
    balance: { type: Number, default: 0 },
    bankDetails: {
      holderName: { type: String },
      bankName: { type: String },
      accountNumber: { type: String },
      ifscCode: { type: String },
    },
    rating: {
      average: { type: Number, default: 0 },
      count: { type: Number, default: 0 },
    },
    totalWorkDone: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    block: { type: blockSchemaDefinition, default: () => ({}) },
  },
  { timestamps: true }
);

workerSchema.index({ aadhaarNumberHash: 1 }, { sparse: true });
workerSchema.index({ location: '2dsphere' });
workerSchema.index({ currentLocation: '2dsphere' });
// NOTE: `phone` (unique) and `googleId` (sparse) are already indexed by their field
// definitions above — re-declaring them here created duplicate index definitions that
// broke `syncIndexes()` with an IndexKeySpecsConflict and spammed startup warnings.
workerSchema.index({ accountStatus: 1 });
workerSchema.index({ isActive: 1 });
// Admin verification queue: filter by status, oldest submission first.
workerSchema.index({ verificationStatus: 1, verificationSubmittedAt: 1 });

export default mongoose.model<IWorker>('Worker', workerSchema);
