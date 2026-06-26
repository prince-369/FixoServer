import { Request } from 'express';
interface ActivityDetails {
    action: string;
    category: string;
    targetType?: string;
    targetId?: string;
    amount?: number;
    meta?: Record<string, unknown>;
}
/**
 * Append a staff-activity row. Non-blocking and never throws — analytics only.
 * Call this from admin controllers after a meaningful action succeeds.
 */
export declare const logAdminActivity: (req: Request, details: ActivityDetails) => Promise<void>;
export {};
//# sourceMappingURL=adminActivity.d.ts.map