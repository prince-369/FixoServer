"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStaffActivity = exports.deleteStaff = exports.updateStaff = exports.createStaff = exports.listStaff = exports.getStaffMeta = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const Admin_1 = __importDefault(require("../models/Admin"));
const AdminActivity_1 = __importDefault(require("../models/AdminActivity"));
const adminPermissions_1 = require("../config/adminPermissions");
// ─── Meta: roles + permission catalogue (for building the staff form) ───
const getStaffMeta = async (_req, res) => {
    res.json({
        roles: adminPermissions_1.ROLES.map((r) => ({ role: r.role, label: r.label, description: r.description, defaults: r.defaults })),
        permissions: adminPermissions_1.PERMISSIONS.map((p) => ({ key: p.key, label: p.label, scope: p.scope })),
    });
};
exports.getStaffMeta = getStaffMeta;
// ─── List all staff (with lifetime activity counts) ───
const listStaff = async (_req, res) => {
    try {
        const staff = await Admin_1.default.find().sort({ createdAt: -1 }).lean();
        // Aggregate activity counts per admin.
        const counts = await AdminActivity_1.default.aggregate([
            { $group: { _id: '$admin', total: { $sum: 1 }, money: { $sum: { $ifNull: ['$amount', 0] } } } },
        ]);
        const countMap = new Map(counts.map((c) => [String(c._id), { total: c.total, money: c.money }]));
        const result = staff.map((a) => ({
            _id: a._id,
            name: a.name,
            email: a.email,
            role: a.role === 'superadmin' ? 'super_admin' : a.role,
            permissions: (0, adminPermissions_1.effectivePermissions)(a),
            isActive: a.isActive !== false,
            isSuperAdmin: a.role === 'super_admin' || a.role === 'superadmin' || (0, adminPermissions_1.isSuperAdminEmail)(a.email),
            lastLoginAt: a.lastLoginAt,
            createdAt: a.createdAt,
            activityCount: countMap.get(String(a._id))?.total || 0,
            moneyHandled: countMap.get(String(a._id))?.money || 0,
        }));
        res.json({ staff: result });
    }
    catch (error) {
        console.error('List staff error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.listStaff = listStaff;
// ─── Create staff ───
const createStaff = async (req, res) => {
    try {
        const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
        const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
        const password = typeof req.body?.password === 'string' ? req.body.password : '';
        const role = typeof req.body?.role === 'string' ? req.body.role : '';
        const permissions = Array.isArray(req.body?.permissions) ? req.body.permissions : [];
        if (!name) {
            res.status(400).json({ message: 'Staff name is required' });
            return;
        }
        if (!/^\S+@\S+\.\S+$/.test(email)) {
            res.status(400).json({ message: 'Valid email is required' });
            return;
        }
        if (password.length < 6) {
            res.status(400).json({ message: 'Password must be at least 6 characters' });
            return;
        }
        if (!(0, adminPermissions_1.isValidRole)(role)) {
            res.status(400).json({ message: 'Invalid role' });
            return;
        }
        if (role === 'super_admin') {
            res.status(400).json({ message: 'Cannot create another Super Admin' });
            return;
        }
        if ((0, adminPermissions_1.isSuperAdminEmail)(email)) {
            res.status(400).json({ message: 'This email is reserved for the Super Admin' });
            return;
        }
        const existing = await Admin_1.default.findOne({ email });
        if (existing) {
            res.status(400).json({ message: 'An admin with this email already exists' });
            return;
        }
        // Permissions: use provided (validated) or fall back to role defaults.
        const cleanPerms = permissions.filter(adminPermissions_1.isValidPermission).filter((p) => p !== 'staff');
        const finalPerms = cleanPerms.length ? cleanPerms : (0, adminPermissions_1.defaultPermissionsForRole)(role).filter((p) => p !== 'staff');
        const hashed = await bcryptjs_1.default.hash(password, 12);
        const staff = await Admin_1.default.create({
            name, email, password: hashed, role, permissions: finalPerms,
            isActive: true, createdBy: req.user.id,
        });
        res.status(201).json({
            message: 'Staff account created',
            staff: { _id: staff._id, name: staff.name, email: staff.email, role: staff.role, permissions: finalPerms, isActive: true },
        });
    }
    catch (error) {
        console.error('Create staff error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.createStaff = createStaff;
// ─── Update staff (role, permissions, name, active, optional password) ───
const updateStaff = async (req, res) => {
    try {
        const staff = await Admin_1.default.findById(req.params.id).select('+password');
        if (!staff) {
            res.status(404).json({ message: 'Staff not found' });
            return;
        }
        if (staff.role === 'super_admin' || staff.role === 'superadmin' || (0, adminPermissions_1.isSuperAdminEmail)(staff.email)) {
            res.status(400).json({ message: 'The Super Admin account cannot be edited here' });
            return;
        }
        if (typeof req.body?.name === 'string' && req.body.name.trim())
            staff.name = req.body.name.trim();
        if (typeof req.body?.role === 'string') {
            if (!(0, adminPermissions_1.isValidRole)(req.body.role) || req.body.role === 'super_admin') {
                res.status(400).json({ message: 'Invalid role' });
                return;
            }
            staff.role = req.body.role;
        }
        if (Array.isArray(req.body?.permissions)) {
            staff.permissions = req.body.permissions.filter(adminPermissions_1.isValidPermission).filter((p) => p !== 'staff');
        }
        if (typeof req.body?.isActive === 'boolean')
            staff.isActive = req.body.isActive;
        if (typeof req.body?.password === 'string' && req.body.password) {
            if (req.body.password.length < 6) {
                res.status(400).json({ message: 'Password must be at least 6 characters' });
                return;
            }
            staff.password = await bcryptjs_1.default.hash(req.body.password, 12);
        }
        await staff.save();
        res.json({
            message: 'Staff updated',
            staff: { _id: staff._id, name: staff.name, email: staff.email, role: staff.role, permissions: (0, adminPermissions_1.effectivePermissions)(staff), isActive: staff.isActive },
        });
    }
    catch (error) {
        console.error('Update staff error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.updateStaff = updateStaff;
// ─── Delete staff ───
const deleteStaff = async (req, res) => {
    try {
        const staff = await Admin_1.default.findById(req.params.id);
        if (!staff) {
            res.status(404).json({ message: 'Staff not found' });
            return;
        }
        if (staff.role === 'super_admin' || staff.role === 'superadmin' || (0, adminPermissions_1.isSuperAdminEmail)(staff.email)) {
            res.status(400).json({ message: 'The Super Admin account cannot be deleted' });
            return;
        }
        if (String(staff._id) === String(req.user.id)) {
            res.status(400).json({ message: 'You cannot delete your own account' });
            return;
        }
        await staff.deleteOne();
        res.json({ message: 'Staff removed' });
    }
    catch (error) {
        console.error('Delete staff error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.deleteStaff = deleteStaff;
// ─── Staff activity: per-staff summary + recent feed ───
const getStaffActivity = async (req, res) => {
    try {
        const staffId = req.query.staffId ? String(req.query.staffId) : null;
        const match = staffId ? { admin: new mongoose_1.default.Types.ObjectId(staffId) } : {};
        // Per-staff totals + per-category breakdown.
        const summary = await AdminActivity_1.default.aggregate([
            ...(staffId ? [{ $match: { admin: new mongoose_1.default.Types.ObjectId(staffId) } }] : []),
            {
                $group: {
                    _id: { admin: '$admin', category: '$category' },
                    count: { $sum: 1 },
                    money: { $sum: { $ifNull: ['$amount', 0] } },
                },
            },
        ]);
        const byStaff = {};
        for (const row of summary) {
            const id = String(row._id.admin);
            if (!byStaff[id])
                byStaff[id] = { total: 0, money: 0, categories: {} };
            byStaff[id].total += row.count;
            byStaff[id].money += row.money;
            byStaff[id].categories[row._id.category] = row.count;
        }
        const recent = await AdminActivity_1.default.find(match).sort({ createdAt: -1 }).limit(50).lean();
        res.json({ summary: byStaff, recent });
    }
    catch (error) {
        console.error('Get staff activity error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getStaffActivity = getStaffActivity;
//# sourceMappingURL=staff.controller.js.map