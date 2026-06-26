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
export declare const PERMISSIONS: PermissionDef[];
export declare const PERMISSION_KEYS: string[];
export declare const ALL_PERMISSIONS: string[];
export declare const isValidPermission: (key: string) => boolean;
export declare const permissionScope: (key: string) => PermissionScope;
export type StaffRole = 'super_admin' | 'operations_manager' | 'customer_support' | 'worker_support' | 'kyc_officer' | 'finance_manager' | 'refund_officer' | 'withdrawal_officer' | 'marketing_manager' | 'analytics_manager';
export interface RoleDef {
    role: StaffRole;
    label: string;
    description: string;
    /** Default permissions granted when this role is assigned. */
    defaults: string[];
}
export declare const ROLES: RoleDef[];
export declare const ROLE_KEYS: StaffRole[];
export declare const isValidRole: (role: string) => role is StaffRole;
export declare const defaultPermissionsForRole: (role: string) => string[];
export declare const SUPER_ADMIN_EMAIL: string;
export declare const isSuperAdminEmail: (email?: string) => boolean;
export declare const effectivePermissions: (admin: {
    role?: string;
    email?: string;
    permissions?: string[];
}) => string[];
//# sourceMappingURL=adminPermissions.d.ts.map