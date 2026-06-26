"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearExpiredBlock = exports.blockPayload = exports.isActivelyBlocked = void 0;
// True if the entity is currently inside an active temporary-block window.
const isActivelyBlocked = (block) => {
    if (!block?.isBlocked)
        return false;
    if (!block.blockedUntil)
        return true; // no expiry => indefinite block
    return new Date(block.blockedUntil).getTime() > Date.now();
};
exports.isActivelyBlocked = isActivelyBlocked;
// API payload describing the current block (countdown + reason for the app).
const blockPayload = (block) => {
    const active = (0, exports.isActivelyBlocked)(block);
    const until = block?.blockedUntil ? new Date(block.blockedUntil) : null;
    return {
        isBlocked: active,
        reason: active ? (block?.reason || '') : '',
        blockedAt: active && block?.blockedAt ? new Date(block.blockedAt).toISOString() : null,
        blockedUntil: active && until ? until.toISOString() : null,
        remainingMs: active && until ? Math.max(0, until.getTime() - Date.now()) : 0,
    };
};
exports.blockPayload = blockPayload;
// Lazy auto-unblock: if the window has passed, clear the block and persist.
// Returns whether the entity is STILL blocked after the check.
const clearExpiredBlock = async (doc) => {
    const block = doc?.block;
    if (!doc || !block?.isBlocked)
        return false;
    if (block.blockedUntil && new Date(block.blockedUntil).getTime() <= Date.now()) {
        block.isBlocked = false;
        block.reason = '';
        block.blockedAt = null;
        block.blockedUntil = null;
        block.blockedBy = null;
        await doc.save();
        return false;
    }
    return true;
};
exports.clearExpiredBlock = clearExpiredBlock;
//# sourceMappingURL=userBlock.js.map