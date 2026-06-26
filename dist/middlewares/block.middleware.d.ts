import { Request, Response, NextFunction } from 'express';
/**
 * Rejects customer/worker actions while a temporary penalty is active.
 * Sends 403 with `{ message: 'account_blocked', block }` so the app can show
 * the block screen with reason + countdown. Auto-unblocks expired penalties.
 */
export declare const blockGuard: (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=block.middleware.d.ts.map