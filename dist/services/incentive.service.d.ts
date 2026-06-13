import mongoose from 'mongoose';
import { ICouponCampaign } from '../models/CouponCampaign';
import { IWorkerPromotion } from '../models/WorkerPromotion';
import { AuditActorModel } from '../models/IncentiveAuditLog';
import { IWorker } from '../models/Worker';
export declare const DEFAULT_COMMISSION_RATE = 0.2;
export declare const audit: (params: {
    action: string;
    actorId?: mongoose.Types.ObjectId | string;
    actorModel?: AuditActorModel;
    targetType?: string;
    targetId?: mongoose.Types.ObjectId | string;
    amount?: number;
    reason?: string;
    meta?: Record<string, unknown>;
}) => Promise<void>;
export declare const getCustomerEligibleCount: (customerId: mongoose.Types.ObjectId | string) => Promise<number>;
export declare const resolveActiveWorkerCommissionRate: (worker: IWorker, completedJobsBefore: number) => Promise<{
    rate: number;
    promotion: IWorkerPromotion | null;
}>;
export declare const recordCommissionSaving: (params: {
    promotion: IWorkerPromotion;
    worker: IWorker;
    booking: mongoose.Types.ObjectId | string;
    appliedRate: number;
    fullCommission: number;
    actualCommission: number;
}) => Promise<void>;
export declare const notifyUnlockedBonusTiers: (worker: IWorker) => Promise<void>;
export declare const claimWorkerBonusTier: (params: {
    worker: IWorker;
    promotionId: string;
    jobsRequired: number;
}) => Promise<{
    ok: boolean;
    message: string;
    bonusAmount?: number;
    newBalance?: number;
}>;
export declare const validateAndPriceCoupon: (params: {
    code: string;
    customerId: mongoose.Types.ObjectId | string;
    amount: number;
}) => Promise<{
    valid: boolean;
    discountAmount: number;
    campaign: ICouponCampaign | null;
    reason?: string;
}>;
export declare const recordCouponRedemption: (params: {
    couponId: mongoose.Types.ObjectId | string;
    couponCode: string;
    userId: mongoose.Types.ObjectId | string;
    bookingId: mongoose.Types.ObjectId | string;
    discountAmount: number;
    orderAmount: number;
}) => Promise<void>;
//# sourceMappingURL=incentive.service.d.ts.map