import mongoose, { Schema, Document } from 'mongoose';

export type WorkerAccountStatus = 'test' | 'ekyc_pending' | 'ekyc_done' | 'approved' | 'rejected' | 'live';

export interface IBankDetails {
  holderName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
}

export interface IWorker extends Document {
  fullName: string;
  phone: string;
  email?: string;
  password: string;
  aadhaarFront: string;
  aadhaarBack: string;
  accountStatus: WorkerAccountStatus;
  ekycRejectionReason?: string;
  ekycCaptures: { url: string; capturedAt: Date }[];
  profileCompleted: boolean;
  location: {
    type: string;
    coordinates: number[];
    address: string;
  };
  categories: mongoose.Types.ObjectId[];
  bio: string;
  regularPhone: string;
  extraPhones: string[];
  profileImage: string;
  isActive: boolean;
  balance: number;
  dues: number;
  duesSince?: Date | null;
  bankDetails?: IBankDetails;
  rating: {
    average: number;
    count: number;
  };
  totalWorkDone: number;
  totalEarnings: number;
  totalCommissionPaid: number;
  createdAt: Date;
  updatedAt: Date;
}

const workerSchema = new Schema<IWorker>(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    email: { type: String, lowercase: true, trim: true, sparse: true },
    password: { type: String, required: true, select: false },
    aadhaarFront: { type: String, required: true },
    aadhaarBack: { type: String, required: true },
    accountStatus: {
      type: String,
      enum: ['test', 'ekyc_pending', 'ekyc_done', 'approved', 'rejected', 'live'],
      default: 'test',
    },
    ekycRejectionReason: { type: String },
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
    categories: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    bio: { type: String, default: '', maxlength: 1000 },
    regularPhone: { type: String, default: '' },
    extraPhones: [{ type: String }],
    profileImage: { type: String, default: '' },
    isActive: { type: Boolean, default: false },
    balance: { type: Number, default: 0 },
    dues: { type: Number, default: 0 },
    duesSince: { type: Date, default: null },
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
    totalCommissionPaid: { type: Number, default: 0 },
  },
  { timestamps: true }
);

workerSchema.index({ location: '2dsphere' });
workerSchema.index({ phone: 1 });
workerSchema.index({ accountStatus: 1 });
workerSchema.index({ isActive: 1 });

export default mongoose.model<IWorker>('Worker', workerSchema);
