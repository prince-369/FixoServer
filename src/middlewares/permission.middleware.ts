import { Request, Response, NextFunction } from 'express';
import Admin, { IAdmin } from '../models/Admin';
import { effectivePermissions, isSuperAdminEmail } from '../config/adminPermissions';

// Load (and cache on the request) the current admin document.
export const loadAdminDoc = async (req: Request): Promise<IAdmin | null> => {
  const cached = (req as any)._adminDoc as IAdmin | null | undefined;
  if (cached !== undefined) return cached;
  const admin = req.user?.role === 'admin' ? await Admin.findById(req.user.id) : null;
  (req as any)._adminDoc = admin;
  return admin;
};

export const isSuperAdmin = (admin: { role?: string; email?: string } | null): boolean =>
  !!admin && (admin.role === 'super_admin' || admin.role === 'superadmin' || isSuperAdminEmail(admin.email));

/**
 * Gate a route by permission. Passes if the admin has ANY of the listed keys
 * (so e.g. the support page can accept support_customer OR support_worker).
 * Super admins always pass.
 */
export const requirePermission = (...keys: string[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.user?.role !== 'admin') {
        res.status(403).json({ message: 'Admin access required' });
        return;
      }
      const admin = await loadAdminDoc(req);
      if (!admin || admin.isActive === false) {
        res.status(403).json({ message: 'Your admin account is inactive' });
        return;
      }
      if (isSuperAdmin(admin)) { next(); return; }
      const perms = effectivePermissions(admin);
      const ok = keys.length === 0 || keys.some((k) => perms.includes(k));
      if (!ok) {
        res.status(403).json({ message: 'You do not have permission for this section' });
        return;
      }
      next();
    } catch {
      res.status(500).json({ message: 'Server error' });
    }
  };
};

// Super-admin-only gate (staff management).
export const requireSuperAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ message: 'Admin access required' });
      return;
    }
    const admin = await loadAdminDoc(req);
    if (!isSuperAdmin(admin)) {
      res.status(403).json({ message: 'Only the Super Admin can manage staff' });
      return;
    }
    next();
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};
