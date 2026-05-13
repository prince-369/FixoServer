import { Request, Response } from 'express';
export declare const getWorkerAvailabilitySummary: (req: Request, res: Response) => Promise<void>;
export declare const createBooking: (req: Request, res: Response) => Promise<void>;
export declare const getBookingBids: (req: Request, res: Response) => Promise<void>;
export declare const acceptBid: (req: Request, res: Response) => Promise<void>;
export declare const initiatePayment: (req: Request, res: Response) => Promise<void>;
export declare const verifyBookingPayment: (req: Request, res: Response) => Promise<void>;
export declare const reconcileBookingPayment: (req: Request, res: Response) => Promise<void>;
export declare const handleRazorpayWebhook: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=booking.controller.d.ts.map