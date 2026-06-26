import { Request, Response } from 'express';
import mongoose from 'mongoose';
import CouponCampaign from '../models/CouponCampaign';
import CouponRedemption from '../models/CouponRedemption';
import WorkerPromotion from '../models/WorkerPromotion';
import PromotionRedemption from '../models/PromotionRedemption';
import RewardMilestone from '../models/RewardMilestone';
import RewardClaim from '../models/RewardClaim';
import Transaction from '../models/Transaction';
import { sendNotification } from '../socket';
import { logAdminActivity } from '../utils/adminActivity';
import { audit } from '../services/incentive.service';
import { generateTID } from '../utils/generateTID';

// ═══════════════════════════════════════════════════════════
// COUPONS
// ═══════════════════════════════════════════════════════════

export const adminListCoupons = async (_req: Request, res: Response): Promise<void> => {
  try {
    const coupons = await CouponCampaign.find().sort({ createdAt: -1 });
    res.json({ coupons });
  } catch (error) {
    console.error('adminListCoupons error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const adminCreateCoupon = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      code, title, description, discountType, discountValue,
      minOrderAmount, maxDiscount, expiresAt, usageLimit, perUserLimit, budgetLimit,
    } = req.body;

    if (!code || !title || !discountType || discountValue == null) {
      res.status(400).json({ message: 'code, title, discountType and discountValue are required' });
      return;
    }
    if (!['percentage', 'flat'].includes(discountType)) {
      res.status(400).json({ message: 'discountType must be percentage or flat' });
      return;
    }

    const exists = await CouponCampaign.findOne({ code: String(code).toUpperCase().trim() });
    if (exists) {
      res.status(409).json({ message: 'A coupon with this code already exists' });
      return;
    }

    const coupon = await CouponCampaign.create({
      code: String(code).toUpperCase().trim(),
      title,
      description,
      discountType,
      discountValue: Number(discountValue),
      minOrderAmount: Number(minOrderAmount) || 0,
      maxDiscount: maxDiscount != null ? Number(maxDiscount) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      usageLimit: usageLimit != null ? Number(usageLimit) : null,
      perUserLimit: perUserLimit != null ? Number(perUserLimit) : 1,
      budgetLimit: budgetLimit != null ? Number(budgetLimit) : null,
      createdBy: req.user!.id,
    });

    await audit({
      action: 'coupon_created', actorId: req.user!.id, actorModel: 'Admin',
      targetType: 'CouponCampaign', targetId: coupon._id as mongoose.Types.ObjectId,
      meta: { code: coupon.code },
    });

    await logAdminActivity(req, { action: 'coupon.create', category: 'coupons', targetType: 'coupon', targetId: String(coupon._id) });
    res.status(201).json({ coupon });
  } catch (error) {
    console.error('adminCreateCoupon error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const adminUpdateCoupon = async (req: Request, res: Response): Promise<void> => {
  try {
    const allowed = ['title', 'description', 'discountValue', 'minOrderAmount', 'maxDiscount',
      'expiresAt', 'usageLimit', 'perUserLimit', 'budgetLimit', 'discountType'];
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    if (update.expiresAt) update.expiresAt = new Date(update.expiresAt as string);

    const coupon = await CouponCampaign.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!coupon) {
      res.status(404).json({ message: 'Coupon not found' });
      return;
    }
    res.json({ coupon });
  } catch (error) {
    console.error('adminUpdateCoupon error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const adminToggleCoupon = async (req: Request, res: Response): Promise<void> => {
  try {
    const { action } = req.body; // 'pause' | 'resume'
    const status = action === 'pause' ? 'paused' : 'active';
    const coupon = await CouponCampaign.findByIdAndUpdate(
      req.params.id,
      { status, isActive: status === 'active' },
      { new: true }
    );
    if (!coupon) {
      res.status(404).json({ message: 'Coupon not found' });
      return;
    }
    await audit({
      action: `coupon_${status}`, actorId: req.user!.id, actorModel: 'Admin',
      targetType: 'CouponCampaign', targetId: coupon._id as mongoose.Types.ObjectId,
    });
    res.json({ coupon });
  } catch (error) {
    console.error('adminToggleCoupon error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const adminDeleteCoupon = async (req: Request, res: Response): Promise<void> => {
  try {
    const coupon = await CouponCampaign.findByIdAndDelete(req.params.id);
    if (!coupon) {
      res.status(404).json({ message: 'Coupon not found' });
      return;
    }
    res.json({ message: 'Coupon deleted' });
  } catch (error) {
    console.error('adminDeleteCoupon error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ═══════════════════════════════════════════════════════════
// WORKER PROMOTIONS
// ═══════════════════════════════════════════════════════════

export const adminListPromotions = async (_req: Request, res: Response): Promise<void> => {
  try {
    const promotions = await WorkerPromotion.find().sort({ createdAt: -1 });
    res.json({ promotions });
  } catch (error) {
    console.error('adminListPromotions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const adminCreatePromotion = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      title, description, type,
      bonusTiers, appliesToAllWorkers, targetWorkers, startsAt, endsAt, durationDays, budgetLimit,
    } = req.body;

    if (!title || !type) {
      res.status(400).json({ message: 'title and type are required' });
      return;
    }
    // Platform is free — only bonus-earning promotions are supported.
    if (type !== 'bonus_earning') {
      res.status(400).json({ message: 'Only bonus_earning promotions are supported' });
      return;
    }
    if (!Array.isArray(bonusTiers) || bonusTiers.length === 0) {
      res.status(400).json({ message: 'bonusTiers are required for bonus_earning' });
      return;
    }

    let resolvedEndsAt = endsAt ? new Date(endsAt) : null;
    if (!resolvedEndsAt && durationDays) {
      resolvedEndsAt = new Date(Date.now() + Number(durationDays) * 24 * 60 * 60 * 1000);
    }

    const promotion = await WorkerPromotion.create({
      title, description, type,
      bonusTiers,
      appliesToAllWorkers: appliesToAllWorkers !== false,
      targetWorkers: Array.isArray(targetWorkers) ? targetWorkers : [],
      startsAt: startsAt ? new Date(startsAt) : new Date(),
      endsAt: resolvedEndsAt,
      durationDays: durationDays ? Number(durationDays) : undefined,
      budgetLimit: budgetLimit != null ? Number(budgetLimit) : null,
      createdBy: req.user!.id,
    });

    await audit({
      action: 'promotion_created', actorId: req.user!.id, actorModel: 'Admin',
      targetType: 'WorkerPromotion', targetId: promotion._id as mongoose.Types.ObjectId,
      meta: { type },
    });

    await logAdminActivity(req, { action: 'promotion.create', category: 'promotions', targetType: 'promotion', targetId: String(promotion._id) });
    res.status(201).json({ promotion });
  } catch (error) {
    console.error('adminCreatePromotion error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const adminUpdatePromotion = async (req: Request, res: Response): Promise<void> => {
  try {
    const allowed = ['title', 'description',
      'bonusTiers', 'appliesToAllWorkers', 'targetWorkers', 'startsAt', 'endsAt', 'budgetLimit'];
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    if (update.startsAt) update.startsAt = new Date(update.startsAt as string);
    if (update.endsAt) update.endsAt = new Date(update.endsAt as string);

    const promotion = await WorkerPromotion.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!promotion) {
      res.status(404).json({ message: 'Promotion not found' });
      return;
    }
    res.json({ promotion });
  } catch (error) {
    console.error('adminUpdatePromotion error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const adminTogglePromotion = async (req: Request, res: Response): Promise<void> => {
  try {
    const { action } = req.body;
    const status = action === 'pause' ? 'paused' : 'active';
    const promotion = await WorkerPromotion.findByIdAndUpdate(
      req.params.id,
      { status, isActive: status === 'active' },
      { new: true }
    );
    if (!promotion) {
      res.status(404).json({ message: 'Promotion not found' });
      return;
    }
    await audit({
      action: `promotion_${status}`, actorId: req.user!.id, actorModel: 'Admin',
      targetType: 'WorkerPromotion', targetId: promotion._id as mongoose.Types.ObjectId,
    });
    res.json({ promotion });
  } catch (error) {
    console.error('adminTogglePromotion error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const adminDeletePromotion = async (req: Request, res: Response): Promise<void> => {
  try {
    const promotion = await WorkerPromotion.findByIdAndDelete(req.params.id);
    if (!promotion) {
      res.status(404).json({ message: 'Promotion not found' });
      return;
    }
    res.json({ message: 'Promotion deleted' });
  } catch (error) {
    console.error('adminDeletePromotion error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ═══════════════════════════════════════════════════════════
// REWARD MILESTONES
// ═══════════════════════════════════════════════════════════

export const adminListMilestones = async (_req: Request, res: Response): Promise<void> => {
  try {
    const milestones = await RewardMilestone.find().sort({ order: 1, bookingsRequired: 1 });
    res.json({ milestones });
  } catch (error) {
    console.error('adminListMilestones error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const adminUpsertMilestone = async (req: Request, res: Response): Promise<void> => {
  try {
    const { key, bookingsRequired, rewardAmount, label, order, isActive } = req.body;
    if (!key || bookingsRequired == null || rewardAmount == null) {
      res.status(400).json({ message: 'key, bookingsRequired and rewardAmount are required' });
      return;
    }
    const milestone = await RewardMilestone.findOneAndUpdate(
      { key: String(key).trim() },
      {
        key: String(key).trim(),
        bookingsRequired: Number(bookingsRequired),
        rewardAmount: Number(rewardAmount),
        label: label || '',
        order: order != null ? Number(order) : 0,
        isActive: isActive !== false,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json({ milestone });
  } catch (error) {
    console.error('adminUpsertMilestone error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const adminUpdateMilestone = async (req: Request, res: Response): Promise<void> => {
  try {
    const allowed = ['bookingsRequired', 'rewardAmount', 'label', 'order', 'isActive'];
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    const milestone = await RewardMilestone.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!milestone) {
      res.status(404).json({ message: 'Milestone not found' });
      return;
    }
    res.json({ milestone });
  } catch (error) {
    console.error('adminUpdateMilestone error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ═══════════════════════════════════════════════════════════
// REWARD CLAIMS REVIEW
// ═══════════════════════════════════════════════════════════

export const adminListRewardClaims = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.query;
    const filter: Record<string, unknown> = {};
    if (status && status !== 'all') filter.status = status;

    const claims = await RewardClaim.find(filter)
      .populate('customer', 'fullName email phone')
      .populate('milestone', 'label bookingsRequired')
      .sort({ createdAt: -1 });
    res.json({ claims });
  } catch (error) {
    console.error('adminListRewardClaims error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const adminApproveRewardClaim = async (req: Request, res: Response): Promise<void> => {
  try {
    const claim = await RewardClaim.findById(req.params.id);
    if (!claim) {
      res.status(404).json({ message: 'Claim not found' });
      return;
    }
    if (claim.status === 'paid') {
      res.status(400).json({ message: 'Claim already paid' });
      return;
    }

    claim.status = 'paid';
    claim.reviewedBy = req.user!.id as unknown as mongoose.Types.ObjectId;
    claim.reviewedAt = new Date();
    claim.paidAt = new Date();
    await claim.save();

    // Record payout in the unified ledger for analytics.
    await Transaction.create({
      tid: generateTID(),
      user: claim.customer,
      type: 'reward_payout',
      amount: claim.rewardAmount,
      method: 'online',
      status: 'completed',
    });

    await audit({
      action: 'reward_claim_approved', actorId: req.user!.id, actorModel: 'Admin',
      targetType: 'RewardClaim', targetId: claim._id as mongoose.Types.ObjectId,
      amount: claim.rewardAmount,
    });

    sendNotification({
      recipientId: claim.customer.toString(),
      recipientModel: 'User',
      type: 'reward_paid',
      title: 'Reward Paid! 🎉',
      message: `Your reward of ₹${claim.rewardAmount} has been approved and paid.`,
      data: { claimId: claim._id },
    }).catch(() => {});

    res.json({ message: 'Reward claim approved and marked paid', claim });
  } catch (error) {
    console.error('adminApproveRewardClaim error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const adminRejectRewardClaim = async (req: Request, res: Response): Promise<void> => {
  try {
    const { reason } = req.body;
    const claim = await RewardClaim.findById(req.params.id);
    if (!claim) {
      res.status(404).json({ message: 'Claim not found' });
      return;
    }
    if (claim.status === 'paid') {
      res.status(400).json({ message: 'Cannot reject a paid claim' });
      return;
    }

    claim.status = 'rejected';
    claim.rejectionReason = reason || 'Not eligible';
    claim.reviewedBy = req.user!.id as unknown as mongoose.Types.ObjectId;
    claim.reviewedAt = new Date();
    await claim.save();

    await audit({
      action: 'reward_claim_rejected', actorId: req.user!.id, actorModel: 'Admin',
      targetType: 'RewardClaim', targetId: claim._id as mongoose.Types.ObjectId,
      reason: claim.rejectionReason,
    });

    sendNotification({
      recipientId: claim.customer.toString(),
      recipientModel: 'User',
      type: 'reward_rejected',
      title: 'Reward Claim Update',
      message: `Your reward claim was not approved: ${claim.rejectionReason}`,
      data: { claimId: claim._id },
    }).catch(() => {});

    res.json({ message: 'Reward claim rejected', claim });
  } catch (error) {
    console.error('adminRejectRewardClaim error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ═══════════════════════════════════════════════════════════
// COUPON REDEMPTIONS LEDGER (financial impact, per use)
// ═══════════════════════════════════════════════════════════

export const adminListCouponRedemptions = async (_req: Request, res: Response): Promise<void> => {
  try {
    const redemptions = await CouponRedemption.find()
      .populate('user', 'fullName phone')
      .populate({ path: 'booking', select: 'workDescription category amount', populate: { path: 'category', select: 'name' } })
      .sort({ createdAt: -1 })
      .limit(100);

    // Each row: orderAmount = full service value (worker's bid, unaffected),
    // discountAmount = what the platform absorbed, customerPaid = what customer actually paid.
    const rows = redemptions.map((r) => ({
      _id: r._id,
      couponCode: r.couponCode,
      customer: r.user,
      booking: r.booking,
      orderAmount: r.orderAmount,
      discountAmount: r.discountAmount,
      customerPaid: r.orderAmount - r.discountAmount,
      platformBorne: r.discountAmount,
      createdAt: r.createdAt,
    }));

    const totalPlatformCost = rows.reduce((sum, r) => sum + r.platformBorne, 0);

    res.json({ redemptions: rows, totalPlatformCost });
  } catch (error) {
    console.error('adminListCouponRedemptions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ═══════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════

export const adminIncentiveAnalytics = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [
      couponAgg,
      rewardClaimsAgg,
      bonusAgg,
      workerParticipation,
      activeCoupons,
      activePromotions,
    ] = await Promise.all([
      CouponRedemption.aggregate([
        { $group: { _id: null, count: { $sum: 1 }, totalDiscount: { $sum: '$discountAmount' } } },
      ]),
      RewardClaim.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$rewardAmount' } } },
      ]),
      PromotionRedemption.aggregate([
        { $match: { kind: 'bonus' } },
        { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$bonusAmount' } } },
      ]),
      PromotionRedemption.distinct('worker'),
      CouponCampaign.countDocuments({ isActive: true, status: 'active' }),
      WorkerPromotion.countDocuments({ isActive: true, status: 'active' }),
    ]);

    const couponsUsed = couponAgg[0]?.count || 0;
    const couponDiscountTotal = couponAgg[0]?.totalDiscount || 0;
    const bonusPaidTotal = bonusAgg[0]?.total || 0;

    const rewardsByStatus: Record<string, { count: number; total: number }> = {};
    let rewardsPaidTotal = 0;
    for (const r of rewardClaimsAgg) {
      rewardsByStatus[r._id] = { count: r.count, total: r.total };
      if (r._id === 'paid') rewardsPaidTotal = r.total;
    }

    const totalIncentiveCost =
      couponDiscountTotal + rewardsPaidTotal + bonusPaidTotal;

    res.json({
      coupons: { used: couponsUsed, discountTotal: couponDiscountTotal, activeCount: activeCoupons },
      rewards: { byStatus: rewardsByStatus, paidTotal: rewardsPaidTotal },
      workerPromotions: {
        bonusPaidTotal,
        participatingWorkers: workerParticipation.length,
        activeCount: activePromotions,
      },
      totalIncentiveCost,
    });
  } catch (error) {
    console.error('adminIncentiveAnalytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
