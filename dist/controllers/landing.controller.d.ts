import { Request, Response } from 'express';
/** POST /api/landing/waitlist — "Notify me at launch" */
export declare const joinLaunchWaitlist: (req: Request, res: Response) => Promise<void>;
/** POST /api/landing/partner — "Partner with Fixo" */
export declare const submitPartnerRequest: (req: Request, res: Response) => Promise<void>;
/** GET /api/admin/landing/waitlist */
export declare const getLaunchWaitlist: (req: Request, res: Response) => Promise<void>;
/** GET /api/admin/landing/partners */
export declare const getPartnerRequests: (req: Request, res: Response) => Promise<void>;
/** PATCH /api/admin/landing/partners/:id — move through new → contacted → closed */
export declare const updatePartnerRequestStatus: (req: Request, res: Response) => Promise<void>;
/** PATCH /api/admin/landing/waitlist/:id — mark a signup as notified */
export declare const markSignupNotified: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=landing.controller.d.ts.map