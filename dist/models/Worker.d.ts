import mongoose, { Document } from 'mongoose';
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
    password?: string;
    googleId?: string;
    aadhaarFront: string;
    aadhaarBack: string;
    accountStatus: WorkerAccountStatus;
    ekycRejectionReason?: string;
    ekycCaptures: {
        url: string;
        capturedAt: Date;
    }[];
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
declare const _default: mongoose.Model<IWorker, {}, {}, {}, mongoose.Document<unknown, {}, IWorker, {}, mongoose.DefaultSchemaOptions> & IWorker & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IWorker>;
export default _default;
//# sourceMappingURL=Worker.d.ts.map