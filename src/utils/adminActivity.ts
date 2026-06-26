import { Request } from 'express';
import AdminActivity from '../models/AdminActivity';
import { loadAdminDoc } from '../middlewares/permission.middleware';

interface ActivityDetails {
  action: string;
  category: string;
  targetType?: string;
  targetId?: string;
  amount?: number;
  meta?: Record<string, unknown>;
}

/**
 * Append a staff-activity row. Non-blocking and never throws — analytics only.
 * Call this from admin controllers after a meaningful action succeeds.
 */
export const logAdminActivity = async (req: Request, details: ActivityDetails): Promise<void> => {
  try {
    if (req.user?.role !== 'admin') return;
    const admin = await loadAdminDoc(req);
    if (!admin) return;
    await AdminActivity.create({
      admin: admin._id,
      adminEmail: admin.email,
      role: admin.role,
      action: details.action,
      category: details.category,
      targetType: details.targetType,
      targetId: details.targetId,
      amount: details.amount,
      meta: details.meta,
    });
  } catch {
    // swallow — activity logging must never break the actual action
  }
};
