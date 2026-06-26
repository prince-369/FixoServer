import mongoose from 'mongoose';
import Booking from '../models/Booking';
import Transaction from '../models/Transaction';
import CouponCampaign, { ICouponCampaign } from '../models/CouponCampaign';
import CouponRedemption from '../models/CouponRedemption';
import WorkerPromotion, { IWorkerPromotion } from '../models/WorkerPromotion';
import PromotionRedemption from '../models/PromotionRedemption';
import IncentiveAuditLog, { AuditActorModel } from '../models/IncentiveAuditLog';
import { IWorker } from '../models/Worker';
import { generateTID } from '../utils/generateTID';
import { sendNotification } from '../socket';

// ───────────────────────────────────────────────────────────
// Audit
// ───────────────────────────────────────────────────────────
export const audit = async (params: {
  action: string;
  actorId?: mongoose.Types.ObjectId | string;
  actorModel?: AuditActorModel;
  targetType?: string;
  targetId?: mongoose.Types.ObjectId | string;
  amount?: number;
  reason?: string;
  meta?: Record<string, unknown>;
}): Promise<void> => {
  try {
    await IncentiveAuditLog.create({
      action: params.action,
      actorId: params.actorId,
      actorModel: params.actorModel || 'System',
      targetType: params.targetType,
      targetId: params.targetId,
      amount: params.amount,
      reason: params.reason,
      meta: params.meta,
    });
  } catch (error) {
    // Audit must never break a business flow.
    console.error('Incentive audit error:', error);
  }
};

// ───────────────────────────────────────────────────────────
// Customer reward eligibility
// Counts ONLY successfully completed + paid bookings.
// Refunded / cancelled / unpaid are excluded.
// ───────────────────────────────────────────────────────────
export const getCustomerEligibleCount = async (
  customerId: mongoose.Types.ObjectId | string
): Promise<number> => {
  return Booking.countDocuments({
    customer: customerId,
    status: 'completed',
    paymentStatus: 'paid',
  });
};

// ───────────────────────────────────────────────────────────
// Worker promotion targeting helper
// ───────────────────────────────────────────────────────────
const promotionAppliesToWorker = (promo: IWorkerPromotion, worker: IWorker): boolean => {
  if (promo.appliesToAllWorkers) return true;
  return promo.targetWorkers.some((id) => id.toString() === (worker._id as mongoose.Types.ObjectId).toString());
};

const isWithinBudget = (promo: IWorkerPromotion, addAmount: number): boolean => {
  if (promo.budgetLimit == null) return true;
  return promo.spentBudget + addAmount <= promo.budgetLimit;
};

// ───────────────────────────────────────────────────────────
// Bonus tiers are CLAIM-BASED: the worker presses "Claim" on the
// Offers page. After a job completes, this notifies the worker if
// the job just unlocked an unclaimed tier (no money moves here).
// ───────────────────────────────────────────────────────────
export const notifyUnlockedBonusTiers = async (worker: IWorker): Promise<void> => {
  try {
    const now = new Date();
    const promos = await WorkerPromotion.find({
      type: 'bonus_earning',
      isActive: true,
      status: 'active',
      startsAt: { $lte: now },
      $or: [{ endsAt: null }, { endsAt: { $gte: now } }],
    });

    for (const promo of promos) {
      if (!promotionAppliesToWorker(promo, worker)) continue;

      for (const tier of promo.bonusTiers || []) {
        // Only fire on the exact job that crossed the threshold.
        if (worker.totalWorkDone !== tier.jobsRequired) continue;

        const alreadyClaimed = await PromotionRedemption.findOne({
          promotion: promo._id,
          worker: worker._id,
          kind: 'bonus',
          milestoneJobs: tier.jobsRequired,
        });
        if (alreadyClaimed) continue;

        await sendNotification({
          recipientId: String(worker._id),
          recipientModel: 'Worker',
          type: 'bonus_unlocked',
          title: 'Bonus Unlocked! 🎉',
          message: `You completed ${tier.jobsRequired} jobs and earned a ₹${tier.bonusAmount} bonus. Claim it from the Offers page!`,
          data: { promotionId: promo._id, jobsRequired: tier.jobsRequired },
        });
      }
    }
  } catch (error) {
    console.error('notifyUnlockedBonusTiers error:', error);
  }
};

// ───────────────────────────────────────────────────────────
// Worker claims a bonus tier → credit wallet + ledger entry.
// Idempotent via the unique index on PromotionRedemption.
// ───────────────────────────────────────────────────────────
export const claimWorkerBonusTier = async (params: {
  worker: IWorker;
  promotionId: string;
  jobsRequired: number;
}): Promise<{ ok: boolean; message: string; bonusAmount?: number; newBalance?: number }> => {
  const { worker, promotionId, jobsRequired } = params;

  const now = new Date();
  const promo = await WorkerPromotion.findOne({
    _id: promotionId,
    type: 'bonus_earning',
    isActive: true,
    status: 'active',
    startsAt: { $lte: now },
    $or: [{ endsAt: null }, { endsAt: { $gte: now } }],
  });
  if (!promo) return { ok: false, message: 'This promotion is no longer active' };
  if (!promotionAppliesToWorker(promo, worker)) return { ok: false, message: 'This promotion does not apply to you' };

  const tier = (promo.bonusTiers || []).find((t) => t.jobsRequired === jobsRequired);
  if (!tier) return { ok: false, message: 'Bonus tier not found' };

  if (worker.totalWorkDone < tier.jobsRequired) {
    return { ok: false, message: `Complete ${tier.jobsRequired - worker.totalWorkDone} more job(s) to claim this bonus` };
  }

  if (!isWithinBudget(promo, tier.bonusAmount)) {
    return { ok: false, message: 'This promotion budget has been exhausted' };
  }

  // Idempotent: unique index {promotion, worker, milestoneJobs} blocks double claims.
  try {
    await PromotionRedemption.create({
      promotion: promo._id,
      worker: worker._id,
      kind: 'bonus',
      milestoneJobs: tier.jobsRequired,
      bonusAmount: tier.bonusAmount,
    });
  } catch (err: unknown) {
    if ((err as { code?: number }).code === 11000) {
      return { ok: false, message: 'You have already claimed this bonus' };
    }
    throw err;
  }

  worker.balance += tier.bonusAmount;
  worker.totalEarnings += tier.bonusAmount;
  await worker.save();

  promo.spentBudget += tier.bonusAmount;
  await promo.save();

  await Transaction.create({
    tid: generateTID(),
    worker: worker._id,
    type: 'worker_bonus',
    amount: tier.bonusAmount,
    method: 'online',
    status: 'completed',
  });

  await audit({
    action: 'bonus_claimed',
    actorId: worker._id as mongoose.Types.ObjectId,
    actorModel: 'Worker',
    targetType: 'WorkerPromotion',
    targetId: promo._id as mongoose.Types.ObjectId,
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

// ───────────────────────────────────────────────────────────
// Validate + price a coupon for a customer. Read-only (no mutation).
// ───────────────────────────────────────────────────────────
export const validateAndPriceCoupon = async (params: {
  code: string;
  customerId: mongoose.Types.ObjectId | string;
  amount: number;
}): Promise<{ valid: boolean; discountAmount: number; campaign: ICouponCampaign | null; reason?: string }> => {
  const fail = (reason: string) => ({ valid: false, discountAmount: 0, campaign: null, reason });

  if (!params.code || !params.code.trim()) return fail('Coupon code is required');

  const coupon = await CouponCampaign.findOne({ code: params.code.toUpperCase().trim() });
  if (!coupon) return fail('Invalid coupon code');
  if (!coupon.isActive || coupon.status !== 'active') return fail('This coupon is not active');
  if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) return fail('This coupon has expired');
  if (params.amount < coupon.minOrderAmount) {
    return fail(`Minimum order amount is ₹${coupon.minOrderAmount}`);
  }
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    return fail('This coupon has reached its usage limit');
  }

  const userUses = await CouponRedemption.countDocuments({ coupon: coupon._id, user: params.customerId });
  if (userUses >= coupon.perUserLimit) return fail('You have already used this coupon');

  let discount = coupon.discountType === 'percentage'
    ? Math.round((params.amount * coupon.discountValue) / 100)
    : coupon.discountValue;

  if (coupon.maxDiscount != null) discount = Math.min(discount, coupon.maxDiscount);
  discount = Math.min(discount, params.amount); // never exceed the order
  discount = Math.max(0, discount);

  if (coupon.budgetLimit != null && coupon.spentBudget + discount > coupon.budgetLimit) {
    return fail('This coupon is no longer available');
  }

  return { valid: true, discountAmount: discount, campaign: coupon };
};

// ───────────────────────────────────────────────────────────
// Record a coupon redemption once payment is confirmed.
// Idempotent via the unique index on booking.
// ───────────────────────────────────────────────────────────
export const recordCouponRedemption = async (params: {
  couponId: mongoose.Types.ObjectId | string;
  couponCode: string;
  userId: mongoose.Types.ObjectId | string;
  bookingId: mongoose.Types.ObjectId | string;
  discountAmount: number;
  orderAmount: number;
}): Promise<void> => {
  if (!params.discountAmount || params.discountAmount <= 0) return;
  try {
    await CouponRedemption.create({
      coupon: params.couponId,
      couponCode: params.couponCode,
      user: params.userId,
      booking: params.bookingId,
      discountAmount: params.discountAmount,
      orderAmount: params.orderAmount,
    });

    await CouponCampaign.updateOne(
      { _id: params.couponId },
      { $inc: { usedCount: 1, spentBudget: params.discountAmount } }
    );

    await audit({
      action: 'coupon_redeemed',
      actorId: params.userId as mongoose.Types.ObjectId,
      actorModel: 'User',
      targetType: 'CouponCampaign',
      targetId: params.couponId as mongoose.Types.ObjectId,
      amount: params.discountAmount,
      meta: { bookingId: String(params.bookingId), code: params.couponCode },
    });
  } catch (err: unknown) {
    if ((err as { code?: number }).code === 11000) return; // already recorded
    console.error('recordCouponRedemption error:', err);
  }
};
