"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
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
require("dotenv/config");
const mongoose_1 = __importDefault(require("mongoose"));
const User_1 = __importDefault(require("../models/User"));
const Worker_1 = __importDefault(require("../models/Worker"));
const Booking_1 = __importDefault(require("../models/Booking"));
const WorkBid_1 = __importDefault(require("../models/WorkBid"));
const Transaction_1 = __importDefault(require("../models/Transaction"));
const Withdrawal_1 = __importDefault(require("../models/Withdrawal"));
const Notification_1 = __importDefault(require("../models/Notification"));
const HelpTicket_1 = __importDefault(require("../models/HelpTicket"));
const RefreshToken_1 = __importDefault(require("../models/RefreshToken"));
const PasswordResetToken_1 = __importDefault(require("../models/PasswordResetToken"));
const OtpCode_1 = __importDefault(require("../models/OtpCode"));
const PushSubscription_1 = __importDefault(require("../models/PushSubscription"));
const MobilePushToken_1 = __importDefault(require("../models/MobilePushToken"));
const RewardClaim_1 = __importDefault(require("../models/RewardClaim"));
const CouponRedemption_1 = __importDefault(require("../models/CouponRedemption"));
const PromotionRedemption_1 = __importDefault(require("../models/PromotionRedemption"));
const WorkerPromotion_1 = __importDefault(require("../models/WorkerPromotion"));
const IncentiveAuditLog_1 = __importDefault(require("../models/IncentiveAuditLog"));
const IdempotencyKey_1 = __importDefault(require("../models/IdempotencyKey"));
const AdminActivity_1 = __importDefault(require("../models/AdminActivity"));
const Counter_1 = __importDefault(require("../models/Counter"));
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fixo';
// Everything here is emptied completely.
const TARGETS = [
    { label: 'Customers (User)', model: User_1.default },
    { label: 'Workers', model: Worker_1.default },
    { label: 'Bookings', model: Booking_1.default },
    { label: 'Work bids', model: WorkBid_1.default },
    { label: 'Transactions', model: Transaction_1.default },
    { label: 'Withdrawals', model: Withdrawal_1.default },
    { label: 'Notifications', model: Notification_1.default },
    { label: 'Help tickets', model: HelpTicket_1.default },
    { label: 'Refresh tokens', model: RefreshToken_1.default },
    { label: 'Password reset tokens', model: PasswordResetToken_1.default },
    { label: 'OTP codes', model: OtpCode_1.default },
    { label: 'Web push subscriptions', model: PushSubscription_1.default },
    { label: 'Mobile push tokens', model: MobilePushToken_1.default },
    { label: 'Reward claims', model: RewardClaim_1.default },
    { label: 'Coupon redemptions', model: CouponRedemption_1.default },
    { label: 'Promotion redemptions', model: PromotionRedemption_1.default },
    { label: 'Worker promotions', model: WorkerPromotion_1.default },
    { label: 'Incentive audit logs', model: IncentiveAuditLog_1.default },
    { label: 'Idempotency keys', model: IdempotencyKey_1.default },
    { label: 'Admin activity log', model: AdminActivity_1.default },
    { label: 'Counters (TID sequences reset)', model: Counter_1.default },
];
const run = async () => {
    const confirmed = process.argv.includes('--confirm');
    await mongoose_1.default.connect(MONGODB_URI);
    const dbName = mongoose_1.default.connection.db?.databaseName;
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
            const n = await mongoose_1.default.connection.db.collection(name).countDocuments();
            console.log(`    ${String(n).padStart(6)}  ${name}`);
        }
        catch {
            console.log(`    ${'—'.padStart(6)}  ${name} (no such collection)`);
        }
    }
    if (!confirmed) {
        console.log('\n  Nothing was changed. Re-run with --confirm to delete.\n');
    }
    else {
        console.log('\n  Done. Database is ready for a fresh start.\n');
    }
    await mongoose_1.default.disconnect();
};
run().catch(async (err) => {
    console.error('Wipe failed:', err);
    await mongoose_1.default.disconnect();
    process.exit(1);
});
//# sourceMappingURL=wipe-users.js.map