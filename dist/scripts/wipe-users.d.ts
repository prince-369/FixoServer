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
//# sourceMappingURL=wipe-users.d.ts.map