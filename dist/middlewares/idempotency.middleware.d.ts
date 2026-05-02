import type { NextFunction, Request, Response } from 'express';
export declare const idempotencyGuard: (ttlMs?: number) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=idempotency.middleware.d.ts.map