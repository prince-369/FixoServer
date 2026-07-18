import mongoose, { Document } from 'mongoose';
import { type IBlockInfo } from './User';
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
    confirmed: boolean;
    status: WorkerSkillStatus;
    experienceBumpsUsed: number;
    rejectionReason?: string;
    callAttempts: number;
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
    aadhaarNumberHash?: string;
    aadhaarNumberLast4?: string;
    aadhaarName?: string;
    aadhaarDob?: string;
    accountStatus: WorkerAccountStatus;
    ekycRejectionReason?: string;
    videoKycIncompleteReason?: string;
    videoKycRetryAvailableAt?: Date | null;
    videoKycAwaitingResult?: boolean;
    videoKycCallEndedAt?: Date | null;
    ekycCaptures: {
        url: string;
        capturedAt: Date;
    }[];
    videoKycConsentAt?: Date | null;
    videoKycAudit?: {
        decidedAt: Date;
        agentId?: mongoose.Types.ObjectId | null;
        agentName?: string;
        result: 'completed' | 'incomplete';
        reason?: string;
        consentAt?: Date | null;
        livenessAsked: string[];
        checklist: {
            liveness: boolean;
            faceMatch: boolean;
            docsMatch: boolean;
            identity: boolean;
        };
    }[];
    profileCompleted: boolean;
    location: {
        type: string;
        coordinates: number[];
        address: string;
    };
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
declare const _default: mongoose.Model<IWorker, {}, {}, {}, mongoose.Document<unknown, {}, IWorker, {}, mongoose.DefaultSchemaOptions> & IWorker & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IWorker>;
export default _default;
//# sourceMappingURL=Worker.d.ts.map