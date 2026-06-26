import { Request, Response, NextFunction } from 'express';
import { IAdmin } from '../models/Admin';
export declare const loadAdminDoc: (req: Request) => Promise<IAdmin | null>;
export declare const isSuperAdmin: (admin: {
    role?: string;
    email?: string;
} | null) => boolean;
/**
 * Gate a route by permission. Passes if the admin has ANY of the listed keys
 * (so e.g. the support page can accept support_customer OR support_worker).
 * Super admins always pass.
 */
export declare const requirePermission: (...keys: string[]) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const requireSuperAdmin: (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=permission.middleware.d.ts.map