/**
 * Destructive: wipes every worker + customer and all data they own, so the platform
 * can be rebuilt from scratch.
 *
 * KEPT (config + marketing leads, not user data):
 *   Admin, Category, Banner, ChatbotQA, RewardMilestone, CouponCampaign,
 *   Waitlist, LaunchSignup, PartnerRequest
 *
 * Usage:
 *   npx ts-node src/scripts/wipe-users.ts             → dry run, only prints counts
 *   npx ts-node src/scripts/wipe-users.ts --confirm   → actually deletes
 */
import 'dotenv/config';
import mongoose, { Model } from 'mongoose';

import User from '../models/User';
import Worker from '../models/Worker';
import Booking from '../models/Booking';
import WorkBid from '../models/WorkBid';
import Transaction from '../models/Transaction';
import Withdrawal from '../models/Withdrawal';
import Notification from '../models/Notification';
import HelpTicket from '../models/HelpTicket';
import RefreshToken from '../models/RefreshToken';
import PasswordResetToken from '../models/PasswordResetToken';
import OtpCode from '../models/OtpCode';
import PushSubscription from '../models/PushSubscription';
import MobilePushToken from '../models/MobilePushToken';
import RewardClaim from '../models/RewardClaim';
import CouponRedemption from '../models/CouponRedemption';
import PromotionRedemption from '../models/PromotionRedemption';
import WorkerPromotion from '../models/WorkerPromotion';
import IncentiveAuditLog from '../models/IncentiveAuditLog';
import IdempotencyKey from '../models/IdempotencyKey';
import AdminActivity from '../models/AdminActivity';
import Counter from '../models/Counter';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fixo';

// Everything here is emptied completely.
const TARGETS: { label: string; model: Model<any> }[] = [
  { label: 'Customers (User)', model: User },
  { label: 'Workers', model: Worker },
  { label: 'Bookings', model: Booking },
  { label: 'Work bids', model: WorkBid },
  { label: 'Transactions', model: Transaction },
  { label: 'Withdrawals', model: Withdrawal },
  { label: 'Notifications', model: Notification },
  { label: 'Help tickets', model: HelpTicket },
  { label: 'Refresh tokens', model: RefreshToken },
  { label: 'Password reset tokens', model: PasswordResetToken },
  { label: 'OTP codes', model: OtpCode },
  { label: 'Web push subscriptions', model: PushSubscription },
  { label: 'Mobile push tokens', model: MobilePushToken },
  { label: 'Reward claims', model: RewardClaim },
  { label: 'Coupon redemptions', model: CouponRedemption },
  { label: 'Promotion redemptions', model: PromotionRedemption },
  { label: 'Worker promotions', model: WorkerPromotion },
  { label: 'Incentive audit logs', model: IncentiveAuditLog },
  { label: 'Idempotency keys', model: IdempotencyKey },
  { label: 'Admin activity log', model: AdminActivity },
  { label: 'Counters (TID sequences reset)', model: Counter },
];

const run = async () => {
  const confirmed = process.argv.includes('--confirm');

  await mongoose.connect(MONGODB_URI);
  const dbName = mongoose.connection.db?.databaseName;
  console.log(`\nConnected to: ${dbName}`);
  console.log(confirmed ? '\n*** LIVE RUN — data will be deleted ***\n' : '\n--- DRY RUN (nothing will be deleted) ---\n');

  let total = 0;
  for (const { label, model } of TARGETS) {
    const count = await model.countDocuments();
    total += count;
    if (confirmed && count > 0) {
      await model.deleteMany({});
    }
    console.log(`  ${confirmed && count > 0 ? 'deleted' : 'found  '}  ${String(count).padStart(6)}  ${label}`);
  }

  console.log(`\n  Total documents ${confirmed ? 'deleted' : 'that would be deleted'}: ${total}`);

  // Show what survived, so the kept set is visible and verifiable.
  const kept = ['admins', 'categories', 'banners', 'chatbotqas', 'rewardmilestones', 'couponcampaigns', 'waitlists', 'launchsignups', 'partnerrequests'];
  console.log('\n  Kept:');
  for (const name of kept) {
    try {
      const n = await mongoose.connection.db!.collection(name).countDocuments();
      console.log(`    ${String(n).padStart(6)}  ${name}`);
    } catch {
      console.log(`    ${'—'.padStart(6)}  ${name} (no such collection)`);
    }
  }

  if (!confirmed) {
    console.log('\n  Nothing was changed. Re-run with --confirm to delete.\n');
  } else {
    console.log('\n  Done. Database is ready for a fresh start.\n');
  }

  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('Wipe failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});
