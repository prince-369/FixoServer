import type { IBlockInfo } from '../models/User';

export interface BlockStatusPayload {
  isBlocked: boolean;
  reason: string;
  blockedAt: string | null;
  blockedUntil: string | null;
  remainingMs: number;
}

// True if the entity is currently inside an active temporary-block window.
export const isActivelyBlocked = (block?: IBlockInfo | null): boolean => {
  if (!block?.isBlocked) return false;
  if (!block.blockedUntil) return true; // no expiry => indefinite block
  return new Date(block.blockedUntil).getTime() > Date.now();
};

// API payload describing the current block (countdown + reason for the app).
export const blockPayload = (block?: IBlockInfo | null): BlockStatusPayload => {
  const active = isActivelyBlocked(block);
  const until = block?.blockedUntil ? new Date(block.blockedUntil) : null;
  return {
    isBlocked: active,
    reason: active ? (block?.reason || '') : '',
    blockedAt: active && block?.blockedAt ? new Date(block.blockedAt).toISOString() : null,
    blockedUntil: active && until ? until.toISOString() : null,
    remainingMs: active && until ? Math.max(0, until.getTime() - Date.now()) : 0,
  };
};

interface BlockableDoc {
  block?: IBlockInfo;
  save: () => Promise<unknown>;
}

// Lazy auto-unblock: if the window has passed, clear the block and persist.
// Returns whether the entity is STILL blocked after the check.
export const clearExpiredBlock = async (doc: BlockableDoc | null | undefined): Promise<boolean> => {
  const block = doc?.block;
  if (!doc || !block?.isBlocked) return false;
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
