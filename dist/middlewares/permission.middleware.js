"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireSuperAdmin = exports.requirePermission = exports.isSuperAdmin = exports.loadAdminDoc = void 0;
const Admin_1 = __importDefault(require("../models/Admin"));
const adminPermissions_1 = require("../config/adminPermissions");
// Load (and cache on the request) the current admin document.
const loadAdminDoc = async (req) => {
    const cached = req._adminDoc;
    if (cached !== undefined)
        return cached;
    const admin = req.user?.role === 'admin' ? await Admin_1.default.findById(req.user.id) : null;
    req._adminDoc = admin;
    return admin;
};
exports.loadAdminDoc = loadAdminDoc;
const isSuperAdmin = (admin) => !!admin && (admin.role === 'super_admin' || admin.role === 'superadmin' || (0, adminPermissions_1.isSuperAdminEmail)(admin.email));
exports.isSuperAdmin = isSuperAdmin;
/**
 * Gate a route by permission. Passes if the admin has ANY of the listed keys
 * (so e.g. the support page can accept support_customer OR support_worker).
 * Super admins always pass.
 */
const requirePermission = (...keys) => {
    return async (req, res, next) => {
        try {
            if (req.user?.role !== 'admin') {
                res.status(403).json({ message: 'Admin access required' });
                return;
            }
            const admin = await (0, exports.loadAdminDoc)(req);
            if (!admin || admin.isActive === false) {
                res.status(403).json({ message: 'Your admin account is inactive' });
                return;
            }
            if ((0, exports.isSuperAdmin)(admin)) {
                next();
                return;
            }
            const perms = (0, adminPermissions_1.effectivePermissions)(admin);
            const ok = keys.length === 0 || keys.some((k) => perms.includes(k));
            if (!ok) {
                res.status(403).json({ message: 'You do not have permission for this section' });
                return;
            }
            next();
        }
        catch {
            res.status(500).json({ message: 'Server error' });
        }
    };
};
exports.requirePermission = requirePermission;
// Super-admin-only gate (staff management).
const requireSuperAdmin = async (req, res, next) => {
    try {
        if (req.user?.role !== 'admin') {
            res.status(403).json({ message: 'Admin access required' });
            return;
        }
        const admin = await (0, exports.loadAdminDoc)(req);
        if (!(0, exports.isSuperAdmin)(admin)) {
            res.status(403).json({ message: 'Only the Super Admin can manage staff' });
            return;
        }
        next();
    }
    catch {
        res.status(500).json({ message: 'Server error' });
    }
};
exports.requireSuperAdmin = requireSuperAdmin;
//# sourceMappingURL=permission.middleware.js.map