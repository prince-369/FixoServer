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

export type PermissionScope = 'customer' | 'worker' | 'platform';

export interface PermissionDef {
  key: string;
  label: string;
  scope: PermissionScope;
  /** Optional: which admin route prefix this permission gates (for nav filtering). */
  route?: string;
}

// ─── Permission catalogue ───
export const PERMISSIONS: PermissionDef[] = [
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
  { key: 'skill_review', label: 'Worker Skill Review', scope: 'worker', route: '/admin/skill-requests' },

  // Super-admin only
  { key: 'staff', label: 'Staff Management', scope: 'platform', route: '/admin/staff' },
];

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);
export const ALL_PERMISSIONS = [...PERMISSION_KEYS];

export const isValidPermission = (key: string): boolean => PERMISSION_KEYS.includes(key);
export const permissionScope = (key: string): PermissionScope =>
  PERMISSIONS.find((p) => p.key === key)?.scope || 'platform';

// ─── Staff roles ───
export type StaffRole =
  | 'super_admin'
  | 'operations_manager'
  | 'customer_support'
  | 'worker_support'
  | 'kyc_officer'
  | 'finance_manager'
  | 'refund_officer'
  | 'withdrawal_officer'
  | 'marketing_manager'
  | 'analytics_manager';

export interface RoleDef {
  role: StaffRole;
  label: string;
  description: string;
  /** Default permissions granted when this role is assigned. */
  defaults: string[];
}

export const ROLES: RoleDef[] = [
  {
    role: 'super_admin',
    label: 'Super Admin',
    description: 'Full access — manages everything including staff.',
    defaults: [...PERMISSION_KEYS],
  },
  {
    role: 'operations_manager',
    label: 'Operations Manager',
    description: 'Monitors the platform — bookings, customers, workers, support.',
    defaults: ['dashboard', 'analytics', 'bookings', 'customers', 'workers', 'support_customer', 'support_worker', 'moderation_customer', 'moderation_worker', 'skill_review'],
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
    defaults: ['kyc', 'workers', 'skill_review'],
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

export const ROLE_KEYS = ROLES.map((r) => r.role);
export const isValidRole = (role: string): role is StaffRole => (ROLE_KEYS as string[]).includes(role);
export const defaultPermissionsForRole = (role: string): string[] =>
  ROLES.find((r) => r.role === role)?.defaults || [];

// The super admin's email comes from env; fall back to the known platform owner.
export const SUPER_ADMIN_EMAIL = (process.env.ADMIN_SEED_EMAIL || 'fixo@princehub.in')
  .trim()
  .replace(/^['"]+|['"]+$/g, '')
  .trim()
  .toLowerCase();

export const isSuperAdminEmail = (email?: string): boolean =>
  !!email && email.trim().toLowerCase() === SUPER_ADMIN_EMAIL;

// Resolve the effective permissions for an admin record.
export const effectivePermissions = (admin: { role?: string; email?: string; permissions?: string[] }): string[] => {
  if (admin.role === 'super_admin' || isSuperAdminEmail(admin.email)) return [...PERMISSION_KEYS];
  if (Array.isArray(admin.permissions) && admin.permissions.length) {
    return admin.permissions.filter(isValidPermission);
  }
  return defaultPermissionsForRole(admin.role || '');
};
