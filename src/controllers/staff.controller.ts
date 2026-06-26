import { Request, Response } from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Admin from '../models/Admin';
import AdminActivity from '../models/AdminActivity';
import {
  ROLES, PERMISSIONS, isValidRole, isValidPermission, defaultPermissionsForRole,
  effectivePermissions, isSuperAdminEmail,
} from '../config/adminPermissions';

// ─── Meta: roles + permission catalogue (for building the staff form) ───
export const getStaffMeta = async (_req: Request, res: Response): Promise<void> => {
  res.json({
    roles: ROLES.map((r) => ({ role: r.role, label: r.label, description: r.description, defaults: r.defaults })),
    permissions: PERMISSIONS.map((p) => ({ key: p.key, label: p.label, scope: p.scope })),
  });
};

// ─── List all staff (with lifetime activity counts) ───
export const listStaff = async (_req: Request, res: Response): Promise<void> => {
  try {
    const staff = await Admin.find().sort({ createdAt: -1 }).lean();

    // Aggregate activity counts per admin.
    const counts = await AdminActivity.aggregate([
      { $group: { _id: '$admin', total: { $sum: 1 }, money: { $sum: { $ifNull: ['$amount', 0] } } } },
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), { total: c.total, money: c.money }]));

    const result = staff.map((a) => ({
      _id: a._id,
      name: a.name,
      email: a.email,
      role: a.role === 'superadmin' ? 'super_admin' : a.role,
      permissions: effectivePermissions(a as any),
      isActive: a.isActive !== false,
      isSuperAdmin: a.role === 'super_admin' || a.role === 'superadmin' || isSuperAdminEmail(a.email),
      lastLoginAt: a.lastLoginAt,
      createdAt: a.createdAt,
      activityCount: countMap.get(String(a._id))?.total || 0,
      moneyHandled: countMap.get(String(a._id))?.money || 0,
    }));

    res.json({ staff: result });
  } catch (error) {
    console.error('List staff error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Create staff ───
export const createStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const role = typeof req.body?.role === 'string' ? req.body.role : '';
    const permissions: string[] = Array.isArray(req.body?.permissions) ? req.body.permissions : [];

    if (!name) { res.status(400).json({ message: 'Staff name is required' }); return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { res.status(400).json({ message: 'Valid email is required' }); return; }
    if (password.length < 6) { res.status(400).json({ message: 'Password must be at least 6 characters' }); return; }
    if (!isValidRole(role)) { res.status(400).json({ message: 'Invalid role' }); return; }
    if (role === 'super_admin') { res.status(400).json({ message: 'Cannot create another Super Admin' }); return; }
    if (isSuperAdminEmail(email)) { res.status(400).json({ message: 'This email is reserved for the Super Admin' }); return; }

    const existing = await Admin.findOne({ email });
    if (existing) { res.status(400).json({ message: 'An admin with this email already exists' }); return; }

    // Permissions: use provided (validated) or fall back to role defaults.
    const cleanPerms = permissions.filter(isValidPermission).filter((p) => p !== 'staff');
    const finalPerms = cleanPerms.length ? cleanPerms : defaultPermissionsForRole(role).filter((p) => p !== 'staff');

    const hashed = await bcrypt.hash(password, 12);
    const staff = await Admin.create({
      name, email, password: hashed, role, permissions: finalPerms,
      isActive: true, createdBy: req.user!.id,
    });

    res.status(201).json({
      message: 'Staff account created',
      staff: { _id: staff._id, name: staff.name, email: staff.email, role: staff.role, permissions: finalPerms, isActive: true },
    });
  } catch (error) {
    console.error('Create staff error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Update staff (role, permissions, name, active, optional password) ───
export const updateStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const staff = await Admin.findById(req.params.id).select('+password');
    if (!staff) { res.status(404).json({ message: 'Staff not found' }); return; }
    if (staff.role === 'super_admin' || staff.role === 'superadmin' || isSuperAdminEmail(staff.email)) {
      res.status(400).json({ message: 'The Super Admin account cannot be edited here' });
      return;
    }

    if (typeof req.body?.name === 'string' && req.body.name.trim()) staff.name = req.body.name.trim();

    if (typeof req.body?.role === 'string') {
      if (!isValidRole(req.body.role) || req.body.role === 'super_admin') {
        res.status(400).json({ message: 'Invalid role' });
        return;
      }
      staff.role = req.body.role;
    }

    if (Array.isArray(req.body?.permissions)) {
      staff.permissions = req.body.permissions.filter(isValidPermission).filter((p: string) => p !== 'staff');
    }

    if (typeof req.body?.isActive === 'boolean') staff.isActive = req.body.isActive;

    if (typeof req.body?.password === 'string' && req.body.password) {
      if (req.body.password.length < 6) { res.status(400).json({ message: 'Password must be at least 6 characters' }); return; }
      staff.password = await bcrypt.hash(req.body.password, 12);
    }

    await staff.save();
    res.json({
      message: 'Staff updated',
      staff: { _id: staff._id, name: staff.name, email: staff.email, role: staff.role, permissions: effectivePermissions(staff as any), isActive: staff.isActive },
    });
  } catch (error) {
    console.error('Update staff error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Delete staff ───
export const deleteStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const staff = await Admin.findById(req.params.id);
    if (!staff) { res.status(404).json({ message: 'Staff not found' }); return; }
    if (staff.role === 'super_admin' || staff.role === 'superadmin' || isSuperAdminEmail(staff.email)) {
      res.status(400).json({ message: 'The Super Admin account cannot be deleted' });
      return;
    }
    if (String(staff._id) === String(req.user!.id)) {
      res.status(400).json({ message: 'You cannot delete your own account' });
      return;
    }
    await staff.deleteOne();
    res.json({ message: 'Staff removed' });
  } catch (error) {
    console.error('Delete staff error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Staff activity: per-staff summary + recent feed ───
export const getStaffActivity = async (req: Request, res: Response): Promise<void> => {
  try {
    const staffId = req.query.staffId ? String(req.query.staffId) : null;
    const match = staffId ? { admin: new mongoose.Types.ObjectId(staffId) } : {};

    // Per-staff totals + per-category breakdown.
    const summary = await AdminActivity.aggregate([
      ...(staffId ? [{ $match: { admin: new mongoose.Types.ObjectId(staffId) } }] : []),
      {
        $group: {
          _id: { admin: '$admin', category: '$category' },
          count: { $sum: 1 },
          money: { $sum: { $ifNull: ['$amount', 0] } },
        },
      },
    ]);

    const byStaff: Record<string, { total: number; money: number; categories: Record<string, number> }> = {};
    for (const row of summary) {
      const id = String(row._id.admin);
      if (!byStaff[id]) byStaff[id] = { total: 0, money: 0, categories: {} };
      byStaff[id].total += row.count;
      byStaff[id].money += row.money;
      byStaff[id].categories[row._id.category] = row.count;
    }

    const recent = await AdminActivity.find(match).sort({ createdAt: -1 }).limit(50).lean();

    res.json({ summary: byStaff, recent });
  } catch (error) {
    console.error('Get staff activity error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
