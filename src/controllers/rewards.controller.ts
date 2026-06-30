import { Request, Response } from 'express';
import mongoose from 'mongoose';
import RewardMilestone from '../models/RewardMilestone';
import RewardClaim from '../models/RewardClaim';
import CouponCampaign from '../models/CouponCampaign';
import CouponRedemption from '../models/CouponRedemption';
import WorkerPromotion from '../models/WorkerPromotion';
import PromotionRedemption from '../models/PromotionRedemption';
import Worker from '../models/Worker';
import Booking from '../models/Booking';
import { sendAdminNotification } from '../socket';
import {
  getCustomerEligibleCount,
  validateAndPriceCoupon,
  claimWorkerBonusTier,
  audit,
} from '../services/incentive.service';

// ─── Default milestones (seeded once) ───
const DEFAULT_MILESTONES = [
  { key: 'm10', bookingsRequired: 10, rewardAmount: 150, label: 'Bronze Reward', order: 1 },
  { key: 'm20', bookingsRequired: 20, rewardAmount: 400, label: 'Silver Reward', order: 2 },
  { key: 'm50', bookingsRequired: 50, rewardAmount: 1500, label: 'Gold Reward', order: 3 },
  { key: 'm100', bookingsRequired: 100, rewardAmount: 4000, label: 'Platinum Reward', order: 4 },
];

export const ensureDefaultMilestones = async (): Promise<void> => {
  try {
    const count = await RewardMilestone.countDocuments();
    if (count > 0) return;
    await RewardMilestone.insertMany(DEFAULT_MILESTONES);
  } catch (error) {
    console.error('ensureDefaultMilestones error:', error);
  }
};

// ═══════════════════════════════════════════════════════════
// CUSTOMER
// ═══════════════════════════════════════════════════════════

// ─── GET /customer/rewards ───
export const getRewards = async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureDefaultMilestones();

    const customerId = req.user!.id;
    const [milestones, claims, completedBookings] = await Promise.all([
      RewardMilestone.find({ isActive: true }).sort({ order: 1, bookingsRequired: 1 }),
      RewardClaim.find({ customer: customerId }),
      getCustomerEligibleCount(customerId),
    ]);

    const claimByKey = new Map(claims.map((c) => [c.milestoneKey, c]));

    const milestoneViews = milestones.map((m) => {
      const claim = claimByKey.get(m.key);
      const achieved = completedBookings >= m.bookingsRequired;
      // A rejected claim does NOT block re-claiming — the customer can fix details and try again.
      const hasActiveClaim = !!claim && claim.status !== 'rejected';
      return {
        _id: m._id,
        key: m.key,
        bookingsRequired: m.bookingsRequired,
        rewardAmount: m.rewardAmount,
        label: m.label,
        achieved,
        claimed: hasActiveClaim,
        claimStatus: claim?.status || null,
        claimRejectionReason: claim?.status === 'rejected' ? (claim.rejectionReason || '') : null,
        claimable: achieved && !hasActiveClaim,
        progressPercent: Math.min(100, Math.round((completedBookings / m.bookingsRequired) * 100)),
      };
    });

    const nextMilestone = milestoneViews.find((m) => !m.achieved) || null;
    const totalClaimedAmount = claims
      .filter((c) => c.status === 'paid')
      .reduce((sum, c) => sum + c.rewardAmount, 0);

    res.json({
      completedBookings,
      milestones: milestoneViews,
      nextMilestone,
      totalClaimedAmount,
    });
  } catch (error) {
    console.error('Get rewards error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── POST /customer/rewards/:milestoneKey/claim ───
export const claimReward = async (req: Request, res: Response): Promise<void> => {
  try {
    const customerId = req.user!.id;
    const milestoneKey = String(req.params.milestoneKey);
    const { method, upiId, bankAccountNumber, ifscCode, bankName, holderName } = req.body || {};

    const milestone = await RewardMilestone.findOne({ key: milestoneKey, isActive: true });
    if (!milestone) {
      res.status(404).json({ message: 'Reward milestone not found' });
      return;
    }

    // Validate payout details
    if (method === 'upi') {
      if (!upiId || !String(upiId).trim()) {
        res.status(400).json({ message: 'UPI ID is required' });
        return;
      }
    } else if (method === 'bank') {
      if (!bankAccountNumber || !ifscCode || !holderName) {
        res.status(400).json({ message: 'Complete bank details are required' });
        return;
      }
    } else {
      res.status(400).json({ message: 'Payout method must be upi or bank' });
      return;
    }

    // Eligibility re-check (server-authoritative)
    const eligibleCount = await getCustomerEligibleCount(customerId);
    if (eligibleCount < milestone.bookingsRequired) {
      res.status(403).json({
        message: `You need ${milestone.bookingsRequired} completed bookings to claim this reward. You have ${eligibleCount}.`,
      });
      return;
    }

    const payoutDetails = { method, upiId, bankAccountNumber, ifscCode, bankName, holderName };
    const existing = await RewardClaim.findOne({ customer: customerId, milestoneKey });

    // Block only if there's an active (non-rejected) claim already.
    if (existing && existing.status !== 'rejected') {
      res.status(409).json({ message: 'You have already claimed this reward milestone' });
      return;
    }

    let claim;
    let isReclaim = false;

    if (existing && existing.status === 'rejected') {
      // Re-claim: reset the previously rejected claim with the new payout details.
      existing.status = 'pending_approval';
      existing.payoutDetails = payoutDetails;
      existing.eligibleCountAtClaim = eligibleCount;
      existing.rejectionReason = undefined;
      existing.reviewedBy = undefined;
      existing.reviewedAt = undefined;
      await existing.save();
      claim = existing;
      isReclaim = true;
    } else {
      try {
        claim = await RewardClaim.create({
          customer: customerId,
          milestone: milestone._id as mongoose.Types.ObjectId,
          milestoneKey,
          bookingsRequired: milestone.bookingsRequired,
          rewardAmount: milestone.rewardAmount,
          eligibleCountAtClaim: eligibleCount,
          payoutDetails,
        });
      } catch (err: unknown) {
        if ((err as { code?: number }).code === 11000) {
          res.status(409).json({ message: 'You have already claimed this reward milestone' });
          return;
        }
        throw err;
      }
    }

    await audit({
      action: isReclaim ? 'reward_claim_resubmitted' : 'reward_claim_created',
      actorId: customerId,
      actorModel: 'User',
      targetType: 'RewardClaim',
      targetId: claim._id as mongoose.Types.ObjectId,
      amount: milestone.rewardAmount,
      meta: { milestoneKey, eligibleCount, isReclaim },
    });

    sendAdminNotification({
      type: 'reward_claim',
      title: 'New Reward Claim',
      message: `A customer claimed ₹${milestone.rewardAmount} (${milestone.bookingsRequired} bookings milestone).`,
      data: { claimId: claim._id, milestoneKey },
    }).catch(() => {});

    res.status(201).json({ message: 'Reward claim submitted for review', claim });
  } catch (error) {
    console.error('Claim reward error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── GET /customer/rewards/claims ───
export const getRewardClaims = async (req: Request, res: Response): Promise<void> => {
  try {
    const claims = await RewardClaim.find({ customer: req.user!.id })
      .populate('milestone', 'label bookingsRequired')
      .sort({ createdAt: -1 });
    res.json({ claims });
  } catch (error) {
    console.error('Get reward claims error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── GET /customer/coupons ───
export const getAvailableCoupons = async (req: Request, res: Response): Promise<void> => {
  try {
    const customerId = req.user!.id;
    const now = new Date();

    const coupons = await CouponCampaign.find({
      isActive: true,
      status: 'active',
      $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }],
    }).sort({ createdAt: -1 });

    // Filter out coupons the user has exhausted + hide internal budget fields
    const usageByCoupon = await CouponRedemption.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(customerId) } },
      { $group: { _id: '$coupon', count: { $sum: 1 } } },
    ]);
    const usageMap = new Map(usageByCoupon.map((u) => [String(u._id), u.count]));

    const available = coupons
      .filter((c) => {
        if (c.usageLimit != null && c.usedCount >= c.usageLimit) return false;
        const userUses = usageMap.get(String(c._id)) || 0;
        return userUses < c.perUserLimit;
      })
      .map((c) => ({
        _id: c._id,
        code: c.code,
        title: c.title,
        description: c.description,
        discountType: c.discountType,
        discountValue: c.discountValue,
        minOrderAmount: c.minOrderAmount,
        maxDiscount: c.maxDiscount,
        expiresAt: c.expiresAt,
      }));

    res.json({ coupons: available });
  } catch (error) {
    console.error('Get available coupons error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── POST /customer/coupons/validate ───
export const validateCoupon = async (req: Request, res: Response): Promise<void> => {
  try {
    const customerId = req.user!.id;
    const { code, bookingId, amount } = req.body || {};

    let orderAmount = Number(amount) || 0;
    if (bookingId) {
      const booking = await Booking.findOne({ _id: bookingId, customer: customerId });
      if (!booking) {
        res.status(404).json({ message: 'Booking not found' });
        return;
      }
      orderAmount = booking.amount;
    }

    if (orderAmount <= 0) {
      res.status(400).json({ message: 'A valid order amount is required' });
      return;
    }

    const result = await validateAndPriceCoupon({ code, customerId, amount: orderAmount });
    if (!result.valid) {
      res.status(400).json({ valid: false, message: result.reason });
      return;
    }

    res.json({
      valid: true,
      code: result.campaign!.code,
      discountAmount: result.discountAmount,
      finalAmount: orderAmount - result.discountAmount,
      orderAmount,
    });
  } catch (error) {
    console.error('Validate coupon error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ═══════════════════════════════════════════════════════════
// WORKER
// ═══════════════════════════════════════════════════════════

// ─── GET /worker/promotions ───
export const getWorkerPromotions = async (req: Request, res: Response): Promise<void> => {
  try {
    const worker = await Worker.findById(req.user!.id);
    if (!worker) {
      res.status(404).json({ message: 'Worker not found' });
      return;
    }

    const now = new Date();
    const promos = await WorkerPromotion.find({
      isActive: true,
      status: 'active',
      startsAt: { $lte: now },
    }).sort({ createdAt: -1 });

    // Only bonus-earning promotions remain — platform is free (no commission).
    const applicable = promos.filter(
      (p) => p.type === 'bonus_earning' &&
        (p.appliesToAllWorkers || p.targetWorkers.some((id) => id.toString() === String(worker._id)))
    );

    // Bonus claim records for this worker
    const redemptions = await PromotionRedemption.find({ worker: worker._id });
    const claimedTiers = new Set(
      redemptions
        .filter((r) => r.kind === 'bonus')
        .map((r) => `${String(r.promotion)}:${r.milestoneJobs}`)
    );

    const bonusEarned = redemptions
      .filter((r) => r.kind === 'bonus')
      .reduce((sum, r) => sum + (r.bonusAmount || 0), 0);

    const promotionViews = applicable.map((p) => {
      const isExpired = p.endsAt ? new Date(p.endsAt).getTime() < now.getTime() : false;
      const base = {
        _id: p._id,
        title: p.title,
        description: p.description,
        type: p.type,
        startsAt: p.startsAt,
        endsAt: p.endsAt,
        expired: isExpired,
      };

      const tiers = (p.bonusTiers || []).map((t) => {
        const claimed = claimedTiers.has(`${String(p._id)}:${t.jobsRequired}`);
        const achieved = worker.totalWorkDone >= t.jobsRequired;
        return {
          jobsRequired: t.jobsRequired,
          bonusAmount: t.bonusAmount,
          progress: Math.min(worker.totalWorkDone, t.jobsRequired),
          progressPercent: Math.min(100, Math.round((worker.totalWorkDone / t.jobsRequired) * 100)),
          claimed,
          claimable: achieved && !claimed && !isExpired,
        };
      });
      return { ...base, bonusTiers: tiers };
    });

    res.json({
      promotions: promotionViews,
      summary: {
        totalWorkDone: worker.totalWorkDone,
        bonusEarnedTotal: bonusEarned,
      },
    });
  } catch (error) {
    console.error('Get worker promotions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── GET /worker/promotions/history ───
export const getPromotionHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const redemptions = await PromotionRedemption.find({ worker: req.user!.id })
      .populate('promotion', 'title type')
      .sort({ createdAt: -1 });
    res.json({ history: redemptions });
  } catch (error) {
    console.error('Get promotion history error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── POST /worker/promotions/:id/claim-bonus ───
export const claimPromotionBonus = async (req: Request, res: Response): Promise<void> => {
  try {
    const jobsRequired = Number(req.body?.jobsRequired);
    if (!jobsRequired || jobsRequired < 1) {
      res.status(400).json({ message: 'jobsRequired is required' });
      return;
    }

    const worker = await Worker.findById(req.user!.id);
    if (!worker) {
      res.status(404).json({ message: 'Worker not found' });
      return;
    }

    const result = await claimWorkerBonusTier({
      worker,
      promotionId: String(req.params.id),
      jobsRequired,
    });

    if (!result.ok) {
      res.status(400).json({ message: result.message });
      return;
    }

    res.json({
      message: result.message,
      bonusAmount: result.bonusAmount,
      newBalance: result.newBalance,
    });
  } catch (error) {
    console.error('Claim promotion bonus error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
