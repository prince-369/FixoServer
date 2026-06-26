import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import Worker from '../models/Worker';
import { clearExpiredBlock, blockPayload } from '../utils/userBlock';

// Paths that stay reachable even while temporarily blocked, so the user can
// still get help and read alerts. Matched against the router-relative path.
const BLOCK_EXEMPT = ['/help-tickets', '/chatbot-qa', '/notifications'];

/**
 * Rejects customer/worker actions while a temporary penalty is active.
 * Sends 403 with `{ message: 'account_blocked', block }` so the app can show
 * the block screen with reason + countdown. Auto-unblocks expired penalties.
 */
export const blockGuard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (BLOCK_EXEMPT.some((p) => req.path.startsWith(p))) { next(); return; }

    if (req.user?.role === 'customer') {
      const user = await User.findById(req.user.id).select('block');
      if (user) {
        const stillBlocked = await clearExpiredBlock(user);
        if (stillBlocked) {
          res.status(403).json({ message: 'account_blocked', block: blockPayload(user.block) });
          return;
        }
      }
    } else if (req.user?.role === 'worker') {
      const worker = await Worker.findById(req.user.id).select('block');
      if (worker) {
        const stillBlocked = await clearExpiredBlock(worker);
        if (stillBlocked) {
          res.status(403).json({ message: 'account_blocked', block: blockPayload(worker.block) });
          return;
        }
      }
    }
    next();
  } catch {
    // Never hard-fail the request because of the guard.
    next();
  }
};
