"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.claimPromotionBonus = exports.getPromotionHistory = exports.getWorkerPromotions = exports.validateCoupon = exports.getAvailableCoupons = exports.getRewardClaims = exports.claimReward = exports.getRewards = exports.ensureDefaultMilestones = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const RewardMilestone_1 = __importDefault(require("../models/RewardMilestone"));
const RewardClaim_1 = __importDefault(require("../models/RewardClaim"));
const CouponCampaign_1 = __importDefault(require("../models/CouponCampaign"));
const CouponRedemption_1 = __importDefault(require("../models/CouponRedemption"));
const WorkerPromotion_1 = __importDefault(require("../models/WorkerPromotion"));
const PromotionRedemption_1 = __importDefault(require("../models/PromotionRedemption"));
const Worker_1 = __importDefault(require("../models/Worker"));
const Booking_1 = __importDefault(require("../models/Booking"));
const socket_1 = require("../socket");
const incentive_service_1 = require("../services/incentive.service");
// ─── Default milestones (seeded once) ───
const DEFAULT_MILESTONES = [
    { key: 'm10', bookingsRequired: 10, rewardAmount: 150, label: 'Bronze Reward', order: 1 },
    { key: 'm20', bookingsRequired: 20, rewardAmount: 400, label: 'Silver Reward', order: 2 },
    { key: 'm50', bookingsRequired: 50, rewardAmount: 1500, label: 'Gold Reward', order: 3 },
    { key: 'm100', bookingsRequired: 100, rewardAmount: 4000, label: 'Platinum Reward', order: 4 },
];
const ensureDefaultMilestones = async () => {
    try {
        const count = await RewardMilestone_1.default.countDocuments();
        if (count > 0)
            return;
        await RewardMilestone_1.default.insertMany(DEFAULT_MILESTONES);
    }
    catch (error) {
        console.error('ensureDefaultMilestones error:', error);
    }
};
exports.ensureDefaultMilestones = ensureDefaultMilestones;
// ═══════════════════════════════════════════════════════════
// CUSTOMER
// ═══════════════════════════════════════════════════════════
// ─── GET /customer/rewards ───
const getRewards = async (req, res) => {
    try {
        await (0, exports.ensureDefaultMilestones)();
        const customerId = req.user.id;
        const [milestones, claims, completedBookings] = await Promise.all([
            RewardMilestone_1.default.find({ isActive: true }).sort({ order: 1, bookingsRequired: 1 }),
            RewardClaim_1.default.find({ customer: customerId }),
            (0, incentive_service_1.getCustomerEligibleCount)(customerId),
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
    }
    catch (error) {
        console.error('Get rewards error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getRewards = getRewards;
// ─── POST /customer/rewards/:milestoneKey/claim ───
const claimReward = async (req, res) => {
    try {
        const customerId = req.user.id;
        const milestoneKey = String(req.params.milestoneKey);
        const { method, upiId, bankAccountNumber, ifscCode, bankName, holderName } = req.body || {};
        const milestone = await RewardMilestone_1.default.findOne({ key: milestoneKey, isActive: true });
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
        }
        else if (method === 'bank') {
            if (!bankAccountNumber || !ifscCode || !holderName) {
                res.status(400).json({ message: 'Complete bank details are required' });
                return;
            }
        }
        else {
            res.status(400).json({ message: 'Payout method must be upi or bank' });
            return;
        }
        // Eligibility re-check (server-authoritative)
        const eligibleCount = await (0, incentive_service_1.getCustomerEligibleCount)(customerId);
        if (eligibleCount < milestone.bookingsRequired) {
            res.status(403).json({
                message: `You need ${milestone.bookingsRequired} completed bookings to claim this reward. You have ${eligibleCount}.`,
            });
            return;
        }
        const payoutDetails = { method, upiId, bankAccountNumber, ifscCode, bankName, holderName };
        const existing = await RewardClaim_1.default.findOne({ customer: customerId, milestoneKey });
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
        }
        else {
            try {
                claim = await RewardClaim_1.default.create({
                    customer: customerId,
                    milestone: milestone._id,
                    milestoneKey,
                    bookingsRequired: milestone.bookingsRequired,
                    rewardAmount: milestone.rewardAmount,
                    eligibleCountAtClaim: eligibleCount,
                    payoutDetails,
                });
            }
            catch (err) {
                if (err.code === 11000) {
                    res.status(409).json({ message: 'You have already claimed this reward milestone' });
                    return;
                }
                throw err;
            }
        }
        await (0, incentive_service_1.audit)({
            action: isReclaim ? 'reward_claim_resubmitted' : 'reward_claim_created',
            actorId: customerId,
            actorModel: 'User',
            targetType: 'RewardClaim',
            targetId: claim._id,
            amount: milestone.rewardAmount,
            meta: { milestoneKey, eligibleCount, isReclaim },
        });
        (0, socket_1.sendAdminNotification)({
            type: 'reward_claim',
            title: 'New Reward Claim',
            message: `A customer claimed ₹${milestone.rewardAmount} (${milestone.bookingsRequired} bookings milestone).`,
            data: { claimId: claim._id, milestoneKey },
        }).catch(() => { });
        res.status(201).json({ message: 'Reward claim submitted for review', claim });
    }
    catch (error) {
        console.error('Claim reward error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.claimReward = claimReward;
// ─── GET /customer/rewards/claims ───
const getRewardClaims = async (req, res) => {
    try {
        const claims = await RewardClaim_1.default.find({ customer: req.user.id })
            .populate('milestone', 'label bookingsRequired')
            .sort({ createdAt: -1 });
        res.json({ claims });
    }
    catch (error) {
        console.error('Get reward claims error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getRewardClaims = getRewardClaims;
// ─── GET /customer/coupons ───
const getAvailableCoupons = async (req, res) => {
    try {
        const customerId = req.user.id;
        const now = new Date();
        const coupons = await CouponCampaign_1.default.find({
            isActive: true,
            status: 'active',
            $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }],
        }).sort({ createdAt: -1 });
        // Filter out coupons the user has exhausted + hide internal budget fields
        const usageByCoupon = await CouponRedemption_1.default.aggregate([
            { $match: { user: new mongoose_1.default.Types.ObjectId(customerId) } },
            { $group: { _id: '$coupon', count: { $sum: 1 } } },
        ]);
        const usageMap = new Map(usageByCoupon.map((u) => [String(u._id), u.count]));
        const available = coupons
            .filter((c) => {
            if (c.usageLimit != null && c.usedCount >= c.usageLimit)
                return false;
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
    }
    catch (error) {
        console.error('Get available coupons error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getAvailableCoupons = getAvailableCoupons;
// ─── POST /customer/coupons/validate ───
const validateCoupon = async (req, res) => {
    try {
        const customerId = req.user.id;
        const { code, bookingId, amount } = req.body || {};
        let orderAmount = Number(amount) || 0;
        if (bookingId) {
            const booking = await Booking_1.default.findOne({ _id: bookingId, customer: customerId });
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
        const result = await (0, incentive_service_1.validateAndPriceCoupon)({ code, customerId, amount: orderAmount });
        if (!result.valid) {
            res.status(400).json({ valid: false, message: result.reason });
            return;
        }
        res.json({
            valid: true,
            code: result.campaign.code,
            discountAmount: result.discountAmount,
            finalAmount: orderAmount - result.discountAmount,
            orderAmount,
        });
    }
    catch (error) {
        console.error('Validate coupon error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.validateCoupon = validateCoupon;
// ═══════════════════════════════════════════════════════════
// WORKER
// ═══════════════════════════════════════════════════════════
// ─── GET /worker/promotions ───
const getWorkerPromotions = async (req, res) => {
    try {
        const worker = await Worker_1.default.findById(req.user.id);
        if (!worker) {
            res.status(404).json({ message: 'Worker not found' });
            return;
        }
        const now = new Date();
        const promos = await WorkerPromotion_1.default.find({
            isActive: true,
            status: 'active',
            startsAt: { $lte: now },
        }).sort({ createdAt: -1 });
        // Only bonus-earning promotions remain — platform is free (no commission).
        const applicable = promos.filter((p) => p.type === 'bonus_earning' &&
            (p.appliesToAllWorkers || p.targetWorkers.some((id) => id.toString() === String(worker._id))));
        // Bonus claim records for this worker
        const redemptions = await PromotionRedemption_1.default.find({ worker: worker._id });
        const claimedTiers = new Set(redemptions
            .filter((r) => r.kind === 'bonus')
            .map((r) => `${String(r.promotion)}:${r.milestoneJobs}`));
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
    }
    catch (error) {
        console.error('Get worker promotions error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getWorkerPromotions = getWorkerPromotions;
// ─── GET /worker/promotions/history ───
const getPromotionHistory = async (req, res) => {
    try {
        const redemptions = await PromotionRedemption_1.default.find({ worker: req.user.id })
            .populate('promotion', 'title type')
            .sort({ createdAt: -1 });
        res.json({ history: redemptions });
    }
    catch (error) {
        console.error('Get promotion history error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getPromotionHistory = getPromotionHistory;
// ─── POST /worker/promotions/:id/claim-bonus ───
const claimPromotionBonus = async (req, res) => {
    try {
        const jobsRequired = Number(req.body?.jobsRequired);
        if (!jobsRequired || jobsRequired < 1) {
            res.status(400).json({ message: 'jobsRequired is required' });
            return;
        }
        const worker = await Worker_1.default.findById(req.user.id);
        if (!worker) {
            res.status(404).json({ message: 'Worker not found' });
            return;
        }
        const result = await (0, incentive_service_1.claimWorkerBonusTier)({
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
    }
    catch (error) {
        console.error('Claim promotion bonus error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.claimPromotionBonus = claimPromotionBonus;
//# sourceMappingURL=rewards.controller.js.map