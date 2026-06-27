import mongoose, { Schema, Document } from 'mongoose';
import { blockSchemaDefinition, type IBlockInfo } from './User';

export type WorkerAccountStatus = 'test' | 'ekyc_pending' | 'ekyc_done' | 'approved' | 'rejected' | 'live';

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
  accountStatus: WorkerAccountStatus;
  ekycRejectionReason?: string;
  videoKycIncompleteReason?: string;
  videoKycRetryAvailableAt?: Date | null;
  // After a live video-KYC call ends, the admin must mark it completed/incomplete.
  // This flag survives admin page reloads/drops so the decision is never lost.
  videoKycAwaitingResult?: boolean;
  videoKycCallEndedAt?: Date | null;
  ekycCaptures: { url: string; capturedAt: Date }[];
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

const workerSchema = new Schema<IWorker>(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    email: { type: String, lowercase: true, trim: true, sparse: true },
    password: { type: String, select: false },
    googleId: { type: String, sparse: true },
    aadhaarFront: { type: String, required: true },
    aadhaarBack: { type: String, required: true },
    accountStatus: {
      type: String,
      enum: ['test', 'ekyc_pending', 'ekyc_done', 'approved', 'rejected', 'live'],
      default: 'test',
    },
    ekycRejectionReason: { type: String },
    videoKycIncompleteReason: { type: String, default: '' },
    videoKycRetryAvailableAt: { type: Date, default: null },
    videoKycAwaitingResult: { type: Boolean, default: false },
    videoKycCallEndedAt: { type: Date, default: null },
    ekycCaptures: [{
      url: { type: String, required: true },
      capturedAt: { type: Date, default: Date.now },
    }],
    profileCompleted: { type: Boolean, default: false },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] },
      address: { type: String, default: '' },
    },
    currentLocation: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: undefined },
      address: { type: String, default: '' },
      updatedAt: { type: Date, default: null },
    },
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

workerSchema.index({ location: '2dsphere' });
workerSchema.index({ currentLocation: '2dsphere' });
workerSchema.index({ phone: 1 });
workerSchema.index({ googleId: 1 });
workerSchema.index({ accountStatus: 1 });
workerSchema.index({ isActive: 1 });

export default mongoose.model<IWorker>('Worker', workerSchema);
