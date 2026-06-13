"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminIncentiveAnalytics = exports.adminListCouponRedemptions = exports.adminRejectRewardClaim = exports.adminApproveRewardClaim = exports.adminListRewardClaims = exports.adminUpdateMilestone = exports.adminUpsertMilestone = exports.adminListMilestones = exports.adminDeletePromotion = exports.adminTogglePromotion = exports.adminUpdatePromotion = exports.adminCreatePromotion = exports.adminListPromotions = exports.adminDeleteCoupon = exports.adminToggleCoupon = exports.adminUpdateCoupon = exports.adminCreateCoupon = exports.adminListCoupons = void 0;
const CouponCampaign_1 = __importDefault(require("../models/CouponCampaign"));
const CouponRedemption_1 = __importDefault(require("../models/CouponRedemption"));
const WorkerPromotion_1 = __importDefault(require("../models/WorkerPromotion"));
const PromotionRedemption_1 = __importDefault(require("../models/PromotionRedemption"));
const RewardMilestone_1 = __importDefault(require("../models/RewardMilestone"));
const RewardClaim_1 = __importDefault(require("../models/RewardClaim"));
const Transaction_1 = __importDefault(require("../models/Transaction"));
const socket_1 = require("../socket");
const incentive_service_1 = require("../services/incentive.service");
const generateTID_1 = require("../utils/generateTID");
// ═══════════════════════════════════════════════════════════
// COUPONS
// ═══════════════════════════════════════════════════════════
const adminListCoupons = async (_req, res) => {
    try {
        const coupons = await CouponCampaign_1.default.find().sort({ createdAt: -1 });
        res.json({ coupons });
    }
    catch (error) {
        console.error('adminListCoupons error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.adminListCoupons = adminListCoupons;
const adminCreateCoupon = async (req, res) => {
    try {
        const { code, title, description, discountType, discountValue, minOrderAmount, maxDiscount, expiresAt, usageLimit, perUserLimit, budgetLimit, } = req.body;
        if (!code || !title || !discountType || discountValue == null) {
            res.status(400).json({ message: 'code, title, discountType and discountValue are required' });
            return;
        }
        if (!['percentage', 'flat'].includes(discountType)) {
            res.status(400).json({ message: 'discountType must be percentage or flat' });
            return;
        }
        const exists = await CouponCampaign_1.default.findOne({ code: String(code).toUpperCase().trim() });
        if (exists) {
            res.status(409).json({ message: 'A coupon with this code already exists' });
            return;
        }
        const coupon = await CouponCampaign_1.default.create({
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
            createdBy: req.user.id,
        });
        await (0, incentive_service_1.audit)({
            action: 'coupon_created', actorId: req.user.id, actorModel: 'Admin',
            targetType: 'CouponCampaign', targetId: coupon._id,
            meta: { code: coupon.code },
        });
        res.status(201).json({ coupon });
    }
    catch (error) {
        console.error('adminCreateCoupon error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.adminCreateCoupon = adminCreateCoupon;
const adminUpdateCoupon = async (req, res) => {
    try {
        const allowed = ['title', 'description', 'discountValue', 'minOrderAmount', 'maxDiscount',
            'expiresAt', 'usageLimit', 'perUserLimit', 'budgetLimit', 'discountType'];
        const update = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined)
                update[key] = req.body[key];
        }
        if (update.expiresAt)
            update.expiresAt = new Date(update.expiresAt);
        const coupon = await CouponCampaign_1.default.findByIdAndUpdate(req.params.id, update, { new: true });
        if (!coupon) {
            res.status(404).json({ message: 'Coupon not found' });
            return;
        }
        res.json({ coupon });
    }
    catch (error) {
        console.error('adminUpdateCoupon error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.adminUpdateCoupon = adminUpdateCoupon;
const adminToggleCoupon = async (req, res) => {
    try {
        const { action } = req.body; // 'pause' | 'resume'
        const status = action === 'pause' ? 'paused' : 'active';
        const coupon = await CouponCampaign_1.default.findByIdAndUpdate(req.params.id, { status, isActive: status === 'active' }, { new: true });
        if (!coupon) {
            res.status(404).json({ message: 'Coupon not found' });
            return;
        }
        await (0, incentive_service_1.audit)({
            action: `coupon_${status}`, actorId: req.user.id, actorModel: 'Admin',
            targetType: 'CouponCampaign', targetId: coupon._id,
        });
        res.json({ coupon });
    }
    catch (error) {
        console.error('adminToggleCoupon error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.adminToggleCoupon = adminToggleCoupon;
const adminDeleteCoupon = async (req, res) => {
    try {
        const coupon = await CouponCampaign_1.default.findByIdAndDelete(req.params.id);
        if (!coupon) {
            res.status(404).json({ message: 'Coupon not found' });
            return;
        }
        res.json({ message: 'Coupon deleted' });
    }
    catch (error) {
        console.error('adminDeleteCoupon error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.adminDeleteCoupon = adminDeleteCoupon;
// ═══════════════════════════════════════════════════════════
// WORKER PROMOTIONS
// ═══════════════════════════════════════════════════════════
const adminListPromotions = async (_req, res) => {
    try {
        const promotions = await WorkerPromotion_1.default.find().sort({ createdAt: -1 });
        res.json({ promotions });
    }
    catch (error) {
        console.error('adminListPromotions error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.adminListPromotions = adminListPromotions;
const adminCreatePromotion = async (req, res) => {
    try {
        const { title, description, type, commissionRate, zeroCommissionScope, firstOrdersCount, bonusTiers, appliesToAllWorkers, targetWorkers, startsAt, endsAt, durationDays, budgetLimit, } = req.body;
        if (!title || !type) {
            res.status(400).json({ message: 'title and type are required' });
            return;
        }
        if (!['reduced_commission', 'zero_commission', 'bonus_earning'].includes(type)) {
            res.status(400).json({ message: 'Invalid promotion type' });
            return;
        }
        if (type === 'reduced_commission' && (commissionRate == null || commissionRate < 0 || commissionRate > 1)) {
            res.status(400).json({ message: 'commissionRate (0–1) is required for reduced_commission' });
            return;
        }
        if (type === 'bonus_earning' && (!Array.isArray(bonusTiers) || bonusTiers.length === 0)) {
            res.status(400).json({ message: 'bonusTiers are required for bonus_earning' });
            return;
        }
        let resolvedEndsAt = endsAt ? new Date(endsAt) : null;
        if (!resolvedEndsAt && durationDays) {
            resolvedEndsAt = new Date(Date.now() + Number(durationDays) * 24 * 60 * 60 * 1000);
        }
        const promotion = await WorkerPromotion_1.default.create({
            title, description, type,
            commissionRate: type === 'reduced_commission' ? Number(commissionRate) : undefined,
            zeroCommissionScope: type === 'zero_commission' ? zeroCommissionScope : undefined,
            firstOrdersCount: type === 'zero_commission' ? firstOrdersCount : undefined,
            bonusTiers: type === 'bonus_earning' ? bonusTiers : undefined,
            appliesToAllWorkers: appliesToAllWorkers !== false,
            targetWorkers: Array.isArray(targetWorkers) ? targetWorkers : [],
            startsAt: startsAt ? new Date(startsAt) : new Date(),
            endsAt: resolvedEndsAt,
            durationDays: durationDays ? Number(durationDays) : undefined,
            budgetLimit: budgetLimit != null ? Number(budgetLimit) : null,
            createdBy: req.user.id,
        });
        await (0, incentive_service_1.audit)({
            action: 'promotion_created', actorId: req.user.id, actorModel: 'Admin',
            targetType: 'WorkerPromotion', targetId: promotion._id,
            meta: { type },
        });
        res.status(201).json({ promotion });
    }
    catch (error) {
        console.error('adminCreatePromotion error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.adminCreatePromotion = adminCreatePromotion;
const adminUpdatePromotion = async (req, res) => {
    try {
        const allowed = ['title', 'description', 'commissionRate', 'zeroCommissionScope', 'firstOrdersCount',
            'bonusTiers', 'appliesToAllWorkers', 'targetWorkers', 'startsAt', 'endsAt', 'budgetLimit'];
        const update = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined)
                update[key] = req.body[key];
        }
        if (update.startsAt)
            update.startsAt = new Date(update.startsAt);
        if (update.endsAt)
            update.endsAt = new Date(update.endsAt);
        const promotion = await WorkerPromotion_1.default.findByIdAndUpdate(req.params.id, update, { new: true });
        if (!promotion) {
            res.status(404).json({ message: 'Promotion not found' });
            return;
        }
        res.json({ promotion });
    }
    catch (error) {
        console.error('adminUpdatePromotion error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.adminUpdatePromotion = adminUpdatePromotion;
const adminTogglePromotion = async (req, res) => {
    try {
        const { action } = req.body;
        const status = action === 'pause' ? 'paused' : 'active';
        const promotion = await WorkerPromotion_1.default.findByIdAndUpdate(req.params.id, { status, isActive: status === 'active' }, { new: true });
        if (!promotion) {
            res.status(404).json({ message: 'Promotion not found' });
            return;
        }
        await (0, incentive_service_1.audit)({
            action: `promotion_${status}`, actorId: req.user.id, actorModel: 'Admin',
            targetType: 'WorkerPromotion', targetId: promotion._id,
        });
        res.json({ promotion });
    }
    catch (error) {
        console.error('adminTogglePromotion error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.adminTogglePromotion = adminTogglePromotion;
const adminDeletePromotion = async (req, res) => {
    try {
        const promotion = await WorkerPromotion_1.default.findByIdAndDelete(req.params.id);
        if (!promotion) {
            res.status(404).json({ message: 'Promotion not found' });
            return;
        }
        res.json({ message: 'Promotion deleted' });
    }
    catch (error) {
        console.error('adminDeletePromotion error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.adminDeletePromotion = adminDeletePromotion;
// ═══════════════════════════════════════════════════════════
// REWARD MILESTONES
// ═══════════════════════════════════════════════════════════
const adminListMilestones = async (_req, res) => {
    try {
        const milestones = await RewardMilestone_1.default.find().sort({ order: 1, bookingsRequired: 1 });
        res.json({ milestones });
    }
    catch (error) {
        console.error('adminListMilestones error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.adminListMilestones = adminListMilestones;
const adminUpsertMilestone = async (req, res) => {
    try {
        const { key, bookingsRequired, rewardAmount, label, order, isActive } = req.body;
        if (!key || bookingsRequired == null || rewardAmount == null) {
            res.status(400).json({ message: 'key, bookingsRequired and rewardAmount are required' });
            return;
        }
        const milestone = await RewardMilestone_1.default.findOneAndUpdate({ key: String(key).trim() }, {
            key: String(key).trim(),
            bookingsRequired: Number(bookingsRequired),
            rewardAmount: Number(rewardAmount),
            label: label || '',
            order: order != null ? Number(order) : 0,
            isActive: isActive !== false,
        }, { new: true, upsert: true, setDefaultsOnInsert: true });
        res.json({ milestone });
    }
    catch (error) {
        console.error('adminUpsertMilestone error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.adminUpsertMilestone = adminUpsertMilestone;
const adminUpdateMilestone = async (req, res) => {
    try {
        const allowed = ['bookingsRequired', 'rewardAmount', 'label', 'order', 'isActive'];
        const update = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined)
                update[key] = req.body[key];
        }
        const milestone = await RewardMilestone_1.default.findByIdAndUpdate(req.params.id, update, { new: true });
        if (!milestone) {
            res.status(404).json({ message: 'Milestone not found' });
            return;
        }
        res.json({ milestone });
    }
    catch (error) {
        console.error('adminUpdateMilestone error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.adminUpdateMilestone = adminUpdateMilestone;
// ═══════════════════════════════════════════════════════════
// REWARD CLAIMS REVIEW
// ═══════════════════════════════════════════════════════════
const adminListRewardClaims = async (req, res) => {
    try {
        const { status } = req.query;
        const filter = {};
        if (status && status !== 'all')
            filter.status = status;
        const claims = await RewardClaim_1.default.find(filter)
            .populate('customer', 'fullName email phone')
            .populate('milestone', 'label bookingsRequired')
            .sort({ createdAt: -1 });
        res.json({ claims });
    }
    catch (error) {
        console.error('adminListRewardClaims error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.adminListRewardClaims = adminListRewardClaims;
const adminApproveRewardClaim = async (req, res) => {
    try {
        const claim = await RewardClaim_1.default.findById(req.params.id);
        if (!claim) {
            res.status(404).json({ message: 'Claim not found' });
            return;
        }
        if (claim.status === 'paid') {
            res.status(400).json({ message: 'Claim already paid' });
            return;
        }
        claim.status = 'paid';
        claim.reviewedBy = req.user.id;
        claim.reviewedAt = new Date();
        claim.paidAt = new Date();
        await claim.save();
        // Record payout in the unified ledger for analytics.
        await Transaction_1.default.create({
            tid: (0, generateTID_1.generateTID)(),
            user: claim.customer,
            type: 'reward_payout',
            amount: claim.rewardAmount,
            method: 'online',
            status: 'completed',
        });
        await (0, incentive_service_1.audit)({
            action: 'reward_claim_approved', actorId: req.user.id, actorModel: 'Admin',
            targetType: 'RewardClaim', targetId: claim._id,
            amount: claim.rewardAmount,
        });
        (0, socket_1.sendNotification)({
            recipientId: claim.customer.toString(),
            recipientModel: 'User',
            type: 'reward_paid',
            title: 'Reward Paid! 🎉',
            message: `Your reward of ₹${claim.rewardAmount} has been approved and paid.`,
            data: { claimId: claim._id },
        }).catch(() => { });
        res.json({ message: 'Reward claim approved and marked paid', claim });
    }
    catch (error) {
        console.error('adminApproveRewardClaim error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.adminApproveRewardClaim = adminApproveRewardClaim;
const adminRejectRewardClaim = async (req, res) => {
    try {
        const { reason } = req.body;
        const claim = await RewardClaim_1.default.findById(req.params.id);
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
        claim.reviewedBy = req.user.id;
        claim.reviewedAt = new Date();
        await claim.save();
        await (0, incentive_service_1.audit)({
            action: 'reward_claim_rejected', actorId: req.user.id, actorModel: 'Admin',
            targetType: 'RewardClaim', targetId: claim._id,
            reason: claim.rejectionReason,
        });
        (0, socket_1.sendNotification)({
            recipientId: claim.customer.toString(),
            recipientModel: 'User',
            type: 'reward_rejected',
            title: 'Reward Claim Update',
            message: `Your reward claim was not approved: ${claim.rejectionReason}`,
            data: { claimId: claim._id },
        }).catch(() => { });
        res.json({ message: 'Reward claim rejected', claim });
    }
    catch (error) {
        console.error('adminRejectRewardClaim error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.adminRejectRewardClaim = adminRejectRewardClaim;
// ═══════════════════════════════════════════════════════════
// COUPON REDEMPTIONS LEDGER (financial impact, per use)
// ═══════════════════════════════════════════════════════════
const adminListCouponRedemptions = async (_req, res) => {
    try {
        const redemptions = await CouponRedemption_1.default.find()
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
    }
    catch (error) {
        console.error('adminListCouponRedemptions error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.adminListCouponRedemptions = adminListCouponRedemptions;
// ═══════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════
const adminIncentiveAnalytics = async (_req, res) => {
    try {
        const [couponAgg, rewardClaimsAgg, bonusAgg, commissionSavingAgg, workerParticipation, activeCoupons, activePromotions,] = await Promise.all([
            CouponRedemption_1.default.aggregate([
                { $group: { _id: null, count: { $sum: 1 }, totalDiscount: { $sum: '$discountAmount' } } },
            ]),
            RewardClaim_1.default.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$rewardAmount' } } },
            ]),
            PromotionRedemption_1.default.aggregate([
                { $match: { kind: 'bonus' } },
                { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$bonusAmount' } } },
            ]),
            PromotionRedemption_1.default.aggregate([
                { $match: { kind: 'commission_saving' } },
                { $group: { _id: null, total: { $sum: '$commissionSaved' } } },
            ]),
            PromotionRedemption_1.default.distinct('worker'),
            CouponCampaign_1.default.countDocuments({ isActive: true, status: 'active' }),
            WorkerPromotion_1.default.countDocuments({ isActive: true, status: 'active' }),
        ]);
        const couponsUsed = couponAgg[0]?.count || 0;
        const couponDiscountTotal = couponAgg[0]?.totalDiscount || 0;
        const bonusPaidTotal = bonusAgg[0]?.total || 0;
        const commissionSavingTotal = commissionSavingAgg[0]?.total || 0;
        const rewardsByStatus = {};
        let rewardsPaidTotal = 0;
        for (const r of rewardClaimsAgg) {
            rewardsByStatus[r._id] = { count: r.count, total: r.total };
            if (r._id === 'paid')
                rewardsPaidTotal = r.total;
        }
        const totalIncentiveCost = couponDiscountTotal + rewardsPaidTotal + bonusPaidTotal + commissionSavingTotal;
        res.json({
            coupons: { used: couponsUsed, discountTotal: couponDiscountTotal, activeCount: activeCoupons },
            rewards: { byStatus: rewardsByStatus, paidTotal: rewardsPaidTotal },
            workerPromotions: {
                bonusPaidTotal,
                commissionSavingTotal,
                participatingWorkers: workerParticipation.length,
                activeCount: activePromotions,
            },
            totalIncentiveCost,
        });
    }
    catch (error) {
        console.error('adminIncentiveAnalytics error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.adminIncentiveAnalytics = adminIncentiveAnalytics;
//# sourceMappingURL=incentiveAdmin.controller.js.map