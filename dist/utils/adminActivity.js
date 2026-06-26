"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAdminActivity = void 0;
const AdminActivity_1 = __importDefault(require("../models/AdminActivity"));
const permission_middleware_1 = require("../middlewares/permission.middleware");
/**
 * Append a staff-activity row. Non-blocking and never throws — analytics only.
 * Call this from admin controllers after a meaningful action succeeds.
 */
const logAdminActivity = async (req, details) => {
    try {
        if (req.user?.role !== 'admin')
            return;
        const admin = await (0, permission_middleware_1.loadAdminDoc)(req);
        if (!admin)
            return;
        await AdminActivity_1.default.create({
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
    }
    catch {
        // swallow — activity logging must never break the actual action
    }
};
exports.logAdminActivity = logAdminActivity;
//# sourceMappingURL=adminActivity.js.map