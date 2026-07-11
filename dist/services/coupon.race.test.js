"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const vitest_1 = require("vitest");
// Integration test for the coupon over-redemption race (finding #4). Proves that
// a burst of concurrent redemptions can never push usedCount past usageLimit or
// spentBudget past budgetLimit. Works on any MongoDB (no transaction needed).
//
// Set MONGODB_TEST_URI to run it; skips cleanly otherwise.
const TEST_DB = process.env.MONGODB_TEST_URI;
const describeIfDb = TEST_DB ? vitest_1.describe : vitest_1.describe.skip;
describeIfDb('recordCouponRedemption — concurrency (race #4)', () => {
    let CouponCampaign;
    let CouponRedemption;
    let recordCouponRedemption;
    let couponId = '';
    (0, vitest_1.beforeAll)(async () => {
        process.env.JWT_SECRET = process.env.JWT_SECRET || 'ci-test-jwt-secret';
        await mongoose_1.default.connect(TEST_DB);
        CouponCampaign = (await Promise.resolve().then(() => __importStar(require('../models/CouponCampaign')))).default;
        CouponRedemption = (await Promise.resolve().then(() => __importStar(require('../models/CouponRedemption')))).default;
        ({ recordCouponRedemption } = await Promise.resolve().then(() => __importStar(require('./incentive.service'))));
    });
    (0, vitest_1.afterAll)(async () => {
        if (couponId) {
            await CouponCampaign.deleteOne({ _id: couponId });
            await CouponRedemption.deleteMany({ coupon: couponId });
        }
        await mongoose_1.default.disconnect();
    });
    (0, vitest_1.it)('usageLimit=1 with 6 concurrent redemptions → usedCount stays 1', async () => {
        const coupon = await CouponCampaign.create({
            code: `RACE${Date.now()}`,
            title: 'Race Test',
            discountType: 'flat',
            discountValue: 50,
            usageLimit: 1,
            budgetLimit: 50, // only one ₹50 discount fits the budget
            perUserLimit: 10,
        });
        couponId = String(coupon._id);
        // 6 distinct bookings/users all try to redeem at once.
        await Promise.all(Array.from({ length: 6 }).map(() => recordCouponRedemption({
            couponId,
            couponCode: coupon.code,
            userId: new mongoose_1.default.Types.ObjectId(),
            bookingId: new mongoose_1.default.Types.ObjectId(),
            discountAmount: 50,
            orderAmount: 200,
        })));
        const fresh = await CouponCampaign.findById(couponId);
        (0, vitest_1.expect)(fresh?.usedCount).toBe(1); // hard-capped at usageLimit
        (0, vitest_1.expect)(fresh?.spentBudget).toBeLessThanOrEqual(50); // never over budget
        // Rolled-back redemptions are removed, so records match the counter.
        const redemptions = await CouponRedemption.countDocuments({ coupon: couponId });
        (0, vitest_1.expect)(redemptions).toBe(1);
    });
});
//# sourceMappingURL=coupon.race.test.js.map