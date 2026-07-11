import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Integration test for the coupon over-redemption race (finding #4). Proves that
// a burst of concurrent redemptions can never push usedCount past usageLimit or
// spentBudget past budgetLimit. Works on any MongoDB (no transaction needed).
//
// Set MONGODB_TEST_URI to run it; skips cleanly otherwise.
const TEST_DB = process.env.MONGODB_TEST_URI;
const describeIfDb = TEST_DB ? describe : describe.skip;

describeIfDb('recordCouponRedemption — concurrency (race #4)', () => {
  let CouponCampaign: typeof import('../models/CouponCampaign').default;
  let CouponRedemption: typeof import('../models/CouponRedemption').default;
  let recordCouponRedemption: typeof import('./incentive.service').recordCouponRedemption;
  let couponId = '';

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'ci-test-jwt-secret';
    await mongoose.connect(TEST_DB as string);
    CouponCampaign = (await import('../models/CouponCampaign')).default;
    CouponRedemption = (await import('../models/CouponRedemption')).default;
    ({ recordCouponRedemption } = await import('./incentive.service'));
  });

  afterAll(async () => {
    if (couponId) {
      await CouponCampaign.deleteOne({ _id: couponId });
      await CouponRedemption.deleteMany({ coupon: couponId });
    }
    await mongoose.disconnect();
  });

  it('usageLimit=1 with 6 concurrent redemptions → usedCount stays 1', async () => {
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
    await Promise.all(
      Array.from({ length: 6 }).map(() =>
        recordCouponRedemption({
          couponId,
          couponCode: coupon.code,
          userId: new mongoose.Types.ObjectId(),
          bookingId: new mongoose.Types.ObjectId(),
          discountAmount: 50,
          orderAmount: 200,
        })
      )
    );

    const fresh = await CouponCampaign.findById(couponId);
    expect(fresh?.usedCount).toBe(1); // hard-capped at usageLimit
    expect(fresh?.spentBudget).toBeLessThanOrEqual(50); // never over budget

    // Rolled-back redemptions are removed, so records match the counter.
    const redemptions = await CouponRedemption.countDocuments({ coupon: couponId });
    expect(redemptions).toBe(1);
  });
});
