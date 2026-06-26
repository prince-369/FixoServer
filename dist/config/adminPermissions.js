"use strict";
/**
 * Admin RBAC configuration — the single source of truth for staff roles,
 * the permission catalogue, and per-role default permissions.
 *
 * A "permission" is a feature area of the admin panel. Each permission belongs
 * to a scope: 'customer' (customer-side panel), 'worker' (worker-side panel),
 * or 'both' (shared / platform-wide). The admin UI uses scope to split the
 * panel into Customer / Worker tabs; `staff` lives in its own Staff tab and is
 * super-admin only.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.effectivePermissions = exports.isSuperAdminEmail = exports.SUPER_ADMIN_EMAIL = exports.defaultPermissionsForRole = exports.isValidRole = exports.ROLE_KEYS = exports.ROLES = exports.permissionScope = exports.isValidPermission = exports.ALL_PERMISSIONS = exports.PERMISSION_KEYS = exports.PERMISSIONS = void 0;
// ─── Permission catalogue ───
exports.PERMISSIONS = [
    // Shared / platform
    { key: 'dashboard', label: 'Dashboard & Overview', scope: 'platform', route: '/admin/dashboard' },
    { key: 'analytics', label: 'Analytics & Reports', scope: 'platform' },
    { key: 'categories', label: 'Categories', scope: 'platform', route: '/admin/categories' },
    { key: 'chatbot', label: 'Chatbot Config', scope: 'platform', route: '/admin/chatbot-qa' },
    // Customer side
    { key: 'customers', label: 'Customers', scope: 'customer', route: '/admin/customers' },
    { key: 'moderation_customer', label: 'Cancellation Watch (Customers)', scope: 'customer', route: '/admin/moderation' },
    { key: 'notify_customer', label: 'Send Notifications (Customers)', scope: 'customer', route: '/admin/push' },
    { key: 'bookings', label: 'Bookings', scope: 'customer' },
    { key: 'support_customer', label: 'Customer Support', scope: 'customer', route: '/admin/help-support' },
    { key: 'refunds', label: 'Refunds', scope: 'customer', route: '/admin/refunds' },
    { key: 'coupons', label: 'Coupons', scope: 'customer', route: '/admin/coupons' },
    { key: 'banners', label: 'Banners', scope: 'customer', route: '/admin/banners' },
    { key: 'reward_claims', label: 'Reward Claims', scope: 'customer', route: '/admin/reward-claims' },
    // Worker side
    { key: 'workers', label: 'Workers', scope: 'worker', route: '/admin/workers' },
    { key: 'kyc', label: 'KYC Verification', scope: 'worker', route: '/admin/ekyc' },
    { key: 'withdrawals', label: 'Withdrawals', scope: 'worker', route: '/admin/withdrawals' },
    { key: 'worker_dues', label: 'Cash Tracking / Dues', scope: 'worker', route: '/admin/worker-dues' },
    { key: 'support_worker', label: 'Worker Support', scope: 'worker' },
    { key: 'commissions', label: 'Commissions & Revenue', scope: 'worker', route: '/admin/commissions' },
    { key: 'promotions', label: 'Promotions', scope: 'worker', route: '/admin/promotions' },
    { key: 'incentives', label: 'Incentive Stats', scope: 'worker', route: '/admin/incentives' },
    { key: 'moderation_worker', label: 'Cancellation Watch (Workers)', scope: 'worker', route: '/admin/moderation' },
    { key: 'notify_worker', label: 'Send Notifications (Workers)', scope: 'worker', route: '/admin/push' },
    // Super-admin only
    { key: 'staff', label: 'Staff Management', scope: 'platform', route: '/admin/staff' },
];
exports.PERMISSION_KEYS = exports.PERMISSIONS.map((p) => p.key);
exports.ALL_PERMISSIONS = [...exports.PERMISSION_KEYS];
const isValidPermission = (key) => exports.PERMISSION_KEYS.includes(key);
exports.isValidPermission = isValidPermission;
const permissionScope = (key) => exports.PERMISSIONS.find((p) => p.key === key)?.scope || 'platform';
exports.permissionScope = permissionScope;
exports.ROLES = [
    {
        role: 'super_admin',
        label: 'Super Admin',
        description: 'Full access — manages everything including staff.',
        defaults: [...exports.PERMISSION_KEYS],
    },
    {
        role: 'operations_manager',
        label: 'Operations Manager',
        description: 'Monitors the platform — bookings, customers, workers, support.',
        defaults: ['dashboard', 'analytics', 'bookings', 'customers', 'workers', 'support_customer', 'support_worker', 'moderation_customer', 'moderation_worker'],
    },
    {
        role: 'customer_support',
        label: 'Customer Support Executive',
        description: 'Handles customer tickets, chats, booking issues and complaints.',
        defaults: ['support_customer', 'customers', 'bookings', 'moderation_customer'],
    },
    {
        role: 'worker_support',
        label: 'Worker Support Executive',
        description: 'Handles worker tickets, complaints, account and availability issues.',
        defaults: ['support_worker', 'workers', 'moderation_worker'],
    },
    {
        role: 'kyc_officer',
        label: 'KYC Verification Officer',
        description: 'Reviews Aadhaar / PAN / selfie / video KYC and approves or rejects.',
        defaults: ['kyc', 'workers'],
    },
    {
        role: 'finance_manager',
        label: 'Finance Manager',
        description: 'Handles withdrawals, refunds, revenue and commission reports.',
        defaults: ['withdrawals', 'refunds', 'commissions', 'worker_dues', 'analytics'],
    },
    {
        role: 'refund_officer',
        label: 'Refund Officer',
        description: 'Dedicated refund approvals and rejections.',
        defaults: ['refunds'],
    },
    {
        role: 'withdrawal_officer',
        label: 'Withdrawal Officer',
        description: 'Worker payout team — reviews, approves and rejects withdrawals.',
        defaults: ['withdrawals'],
    },
    {
        role: 'marketing_manager',
        label: 'Marketing Manager',
        description: 'Growth — banners, coupons, offers, promotions and notifications.',
        defaults: ['banners', 'coupons', 'promotions', 'incentives', 'notify_customer', 'notify_worker'],
    },
    {
        role: 'analytics_manager',
        label: 'Analytics Manager',
        description: 'Data — reports, charts, growth metrics and revenue analytics.',
        defaults: ['analytics', 'dashboard', 'commissions'],
    },
];
exports.ROLE_KEYS = exports.ROLES.map((r) => r.role);
const isValidRole = (role) => exports.ROLE_KEYS.includes(role);
exports.isValidRole = isValidRole;
const defaultPermissionsForRole = (role) => exports.ROLES.find((r) => r.role === role)?.defaults || [];
exports.defaultPermissionsForRole = defaultPermissionsForRole;
// The super admin's email comes from env; fall back to the known platform owner.
exports.SUPER_ADMIN_EMAIL = (process.env.ADMIN_SEED_EMAIL || 'fixo@princehub.in')
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .trim()
    .toLowerCase();
const isSuperAdminEmail = (email) => !!email && email.trim().toLowerCase() === exports.SUPER_ADMIN_EMAIL;
exports.isSuperAdminEmail = isSuperAdminEmail;
// Resolve the effective permissions for an admin record.
const effectivePermissions = (admin) => {
    if (admin.role === 'super_admin' || (0, exports.isSuperAdminEmail)(admin.email))
        return [...exports.PERMISSION_KEYS];
    if (Array.isArray(admin.permissions) && admin.permissions.length) {
        return admin.permissions.filter(exports.isValidPermission);
    }
    return (0, exports.defaultPermissionsForRole)(admin.role || '');
};
exports.effectivePermissions = effectivePermissions;
//# sourceMappingURL=adminPermissions.js.map