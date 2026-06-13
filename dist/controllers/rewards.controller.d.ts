import { Request, Response } from 'express';
export declare const ensureDefaultMilestones: () => Promise<void>;
export declare const getRewards: (req: Request, res: Response) => Promise<void>;
export declare const claimReward: (req: Request, res: Response) => Promise<void>;
export declare const getRewardClaims: (req: Request, res: Response) => Promise<void>;
export declare const getAvailableCoupons: (req: Request, res: Response) => Promise<void>;
export declare const validateCoupon: (req: Request, res: Response) => Promise<void>;
export declare const getWorkerPromotions: (req: Request, res: Response) => Promise<void>;
export declare const getPromotionHistory: (req: Request, res: Response) => Promise<void>;
export declare const claimPromotionBonus: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=rewards.controller.d.ts.map