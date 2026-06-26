"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordCouponRedemption = exports.validateAndPriceCoupon = exports.claimWorkerBonusTier = exports.notifyUnlockedBonusTiers = exports.getCustomerEligibleCount = exports.audit = void 0;
const Booking_1 = __importDefault(require("../models/Booking"));
const Transaction_1 = __importDefault(require("../models/Transaction"));
const CouponCampaign_1 = __importDefault(require("../models/CouponCampaign"));
const CouponRedemption_1 = __importDefault(require("../models/CouponRedemption"));
const WorkerPromotion_1 = __importDefault(require("../models/WorkerPromotion"));
const PromotionRedemption_1 = __importDefault(require("../models/PromotionRedemption"));
const IncentiveAuditLog_1 = __importDefault(require("../models/IncentiveAuditLog"));
const generateTID_1 = require("../utils/generateTID");
const socket_1 = require("../socket");
// ───────────────────────────────────────────────────────────
// Audit
// ───────────────────────────────────────────────────────────
const audit = async (params) => {
    try {
        await IncentiveAuditLog_1.default.create({
            action: params.action,
            actorId: params.actorId,
            actorModel: params.actorModel || 'System',
            targetType: params.targetType,
            targetId: params.targetId,
            amount: params.amount,
            reason: params.reason,
            meta: params.meta,
        });
    }
    catch (error) {
        // Audit must never break a business flow.
        console.error('Incentive audit error:', error);
    }
};
exports.audit = audit;
// ───────────────────────────────────────────────────────────
// Customer reward eligibility
// Counts ONLY successfully completed + paid bookings.
// Refunded / cancelled / unpaid are excluded.
// ───────────────────────────────────────────────────────────
const getCustomerEligibleCount = async (customerId) => {
    return Booking_1.default.countDocuments({
        customer: customerId,
        status: 'completed',
        paymentStatus: 'paid',
    });
};
exports.getCustomerEligibleCount = getCustomerEligibleCount;
// ───────────────────────────────────────────────────────────
// Worker promotion targeting helper
// ───────────────────────────────────────────────────────────
const promotionAppliesToWorker = (promo, worker) => {
    if (promo.appliesToAllWorkers)
        return true;
    return promo.targetWorkers.some((id) => id.toString() === worker._id.toString());
};
const isWithinBudget = (promo, addAmount) => {
    if (promo.budgetLimit == null)
        return true;
    return promo.spentBudget + addAmount <= promo.budgetLimit;
};
// ───────────────────────────────────────────────────────────
// Bonus tiers are CLAIM-BASED: the worker presses "Claim" on the
// Offers page. After a job completes, this notifies the worker if
// the job just unlocked an unclaimed tier (no money moves here).
// ───────────────────────────────────────────────────────────
const notifyUnlockedBonusTiers = async (worker) => {
    try {
        const now = new Date();
        const promos = await WorkerPromotion_1.default.find({
            type: 'bonus_earning',
            isActive: true,
            status: 'active',
            startsAt: { $lte: now },
            $or: [{ endsAt: null }, { endsAt: { $gte: now } }],
        });
        for (const promo of promos) {
            if (!promotionAppliesToWorker(promo, worker))
                continue;
            for (const tier of promo.bonusTiers || []) {
                // Only fire on the exact job that crossed the threshold.
                if (worker.totalWorkDone !== tier.jobsRequired)
                    continue;
                const alreadyClaimed = await PromotionRedemption_1.default.findOne({
                    promotion: promo._id,
                    worker: worker._id,
                    kind: 'bonus',
                    milestoneJobs: tier.jobsRequired,
                });
                if (alreadyClaimed)
                    continue;
                await (0, socket_1.sendNotification)({
                    recipientId: String(worker._id),
                    recipientModel: 'Worker',
                    type: 'bonus_unlocked',
                    title: 'Bonus Unlocked! 🎉',
                    message: `You completed ${tier.jobsRequired} jobs and earned a ₹${tier.bonusAmount} bonus. Claim it from the Offers page!`,
                    data: { promotionId: promo._id, jobsRequired: tier.jobsRequired },
                });
            }
        }
    }
    catch (error) {
        console.error('notifyUnlockedBonusTiers error:', error);
    }
};
exports.notifyUnlockedBonusTiers = notifyUnlockedBonusTiers;
// ───────────────────────────────────────────────────────────
// Worker claims a bonus tier → credit wallet + ledger entry.
// Idempotent via the unique index on PromotionRedemption.
// ───────────────────────────────────────────────────────────
const claimWorkerBonusTier = async (params) => {
    const { worker, promotionId, jobsRequired } = params;
    const now = new Date();
    const promo = await WorkerPromotion_1.default.findOne({
        _id: promotionId,
        type: 'bonus_earning',
        isActive: true,
        status: 'active',
        startsAt: { $lte: now },
        $or: [{ endsAt: null }, { endsAt: { $gte: now } }],
    });
    if (!promo)
        return { ok: false, message: 'This promotion is no longer active' };
    if (!promotionAppliesToWorker(promo, worker))
        return { ok: false, message: 'This promotion does not apply to you' };
    const tier = (promo.bonusTiers || []).find((t) => t.jobsRequired === jobsRequired);
    if (!tier)
        return { ok: false, message: 'Bonus tier not found' };
    if (worker.totalWorkDone < tier.jobsRequired) {
        return { ok: false, message: `Complete ${tier.jobsRequired - worker.totalWorkDone} more job(s) to claim this bonus` };
    }
    if (!isWithinBudget(promo, tier.bonusAmount)) {
        return { ok: false, message: 'This promotion budget has been exhausted' };
    }
    // Idempotent: unique index {promotion, worker, milestoneJobs} blocks double claims.
    try {
        await PromotionRedemption_1.default.create({
            promotion: promo._id,
            worker: worker._id,
            kind: 'bonus',
            milestoneJobs: tier.jobsRequired,
            bonusAmount: tier.bonusAmount,
        });
    }
    catch (err) {
        if (err.code === 11000) {
            return { ok: false, message: 'You have already claimed this bonus' };
        }
        throw err;
    }
    worker.balance += tier.bonusAmount;
    worker.totalEarnings += tier.bonusAmount;
    await worker.save();
    promo.spentBudget += tier.bonusAmount;
    await promo.save();
    await Transaction_1.default.create({
        tid: (0, generateTID_1.generateTID)(),
        worker: worker._id,
        type: 'worker_bonus',
        amount: tier.bonusAmount,
        method: 'online',
        status: 'completed',
    });
    await (0, exports.audit)({
        action: 'bonus_claimed',
        actorId: worker._id,
        actorModel: 'Worker',
        targetType: 'WorkerPromotion',
        targetId: promo._id,
        amount: tier.bonusAmount,
        meta: { jobsRequired: tier.jobsRequired, totalWorkDone: worker.totalWorkDone },
    });
    return {
        ok: true,
        message: `₹${tier.bonusAmount} bonus credited to your wallet!`,
        bonusAmount: tier.bonusAmount,
        newBalance: worker.balance,
    };
};
exports.claimWorkerBonusTier = claimWorkerBonusTier;
// ───────────────────────────────────────────────────────────
// Validate + price a coupon for a customer. Read-only (no mutation).
// ───────────────────────────────────────────────────────────
const validateAndPriceCoupon = async (params) => {
    const fail = (reason) => ({ valid: false, discountAmount: 0, campaign: null, reason });
    if (!params.code || !params.code.trim())
        return fail('Coupon code is required');
    const coupon = await CouponCampaign_1.default.findOne({ code: params.code.toUpperCase().trim() });
    if (!coupon)
        return fail('Invalid coupon code');
    if (!coupon.isActive || coupon.status !== 'active')
        return fail('This coupon is not active');
    if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now())
        return fail('This coupon has expired');
    if (params.amount < coupon.minOrderAmount) {
        return fail(`Minimum order amount is ₹${coupon.minOrderAmount}`);
    }
    if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
        return fail('This coupon has reached its usage limit');
    }
    const userUses = await CouponRedemption_1.default.countDocuments({ coupon: coupon._id, user: params.customerId });
    if (userUses >= coupon.perUserLimit)
        return fail('You have already used this coupon');
    let discount = coupon.discountType === 'percentage'
        ? Math.round((params.amount * coupon.discountValue) / 100)
        : coupon.discountValue;
    if (coupon.maxDiscount != null)
        discount = Math.min(discount, coupon.maxDiscount);
    discount = Math.min(discount, params.amount); // never exceed the order
    discount = Math.max(0, discount);
    if (coupon.budgetLimit != null && coupon.spentBudget + discount > coupon.budgetLimit) {
        return fail('This coupon is no longer available');
    }
    return { valid: true, discountAmount: discount, campaign: coupon };
};
exports.validateAndPriceCoupon = validateAndPriceCoupon;
// ───────────────────────────────────────────────────────────
// Record a coupon redemption once payment is confirmed.
// Idempotent via the unique index on booking.
// ───────────────────────────────────────────────────────────
const recordCouponRedemption = async (params) => {
    if (!params.discountAmount || params.discountAmount <= 0)
        return;
    try {
        await CouponRedemption_1.default.create({
            coupon: params.couponId,
            couponCode: params.couponCode,
            user: params.userId,
            booking: params.bookingId,
            discountAmount: params.discountAmount,
            orderAmount: params.orderAmount,
        });
        await CouponCampaign_1.default.updateOne({ _id: params.couponId }, { $inc: { usedCount: 1, spentBudget: params.discountAmount } });
        await (0, exports.audit)({
            action: 'coupon_redeemed',
            actorId: params.userId,
            actorModel: 'User',
            targetType: 'CouponCampaign',
            targetId: params.couponId,
            amount: params.discountAmount,
            meta: { bookingId: String(params.bookingId), code: params.couponCode },
        });
    }
    catch (err) {
        if (err.code === 11000)
            return; // already recorded
        console.error('recordCouponRedemption error:', err);
    }
};
exports.recordCouponRedemption = recordCouponRedemption;
//# sourceMappingURL=incentive.service.js.map