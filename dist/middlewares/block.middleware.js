"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.blockGuard = void 0;
const User_1 = __importDefault(require("../models/User"));
const Worker_1 = __importDefault(require("../models/Worker"));
const userBlock_1 = require("../utils/userBlock");
// Paths that stay reachable even while temporarily blocked, so the user can
// still get help and read alerts. Matched against the router-relative path.
const BLOCK_EXEMPT = ['/help-tickets', '/chatbot-qa', '/notifications'];
/**
 * Rejects customer/worker actions while a temporary penalty is active.
 * Sends 403 with `{ message: 'account_blocked', block }` so the app can show
 * the block screen with reason + countdown. Auto-unblocks expired penalties.
 */
const blockGuard = async (req, res, next) => {
    try {
        if (BLOCK_EXEMPT.some((p) => req.path.startsWith(p))) {
            next();
            return;
        }
        if (req.user?.role === 'customer') {
            const user = await User_1.default.findById(req.user.id).select('block');
            if (user) {
                const stillBlocked = await (0, userBlock_1.clearExpiredBlock)(user);
                if (stillBlocked) {
                    res.status(403).json({ message: 'account_blocked', block: (0, userBlock_1.blockPayload)(user.block) });
                    return;
                }
            }
        }
        else if (req.user?.role === 'worker') {
            const worker = await Worker_1.default.findById(req.user.id).select('block');
            if (worker) {
                const stillBlocked = await (0, userBlock_1.clearExpiredBlock)(worker);
                if (stillBlocked) {
                    res.status(403).json({ message: 'account_blocked', block: (0, userBlock_1.blockPayload)(worker.block) });
                    return;
                }
            }
        }
        next();
    }
    catch {
        // Never hard-fail the request because of the guard.
        next();
    }
};
exports.blockGuard = blockGuard;
//# sourceMappingURL=block.middleware.js.map