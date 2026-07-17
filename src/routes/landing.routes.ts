import { Router } from 'express';
import { waitlistLimiter, partnerLimiter } from '../middlewares/rateLimit.middleware';
import { joinLaunchWaitlist, submitPartnerRequest } from '../controllers/landing.controller';

const router = Router();

// Public and unauthenticated — the marketing site posts here. Each form carries
// its own IP limiter (see rateLimit.middleware) on top of the global apiLimiter.
router.post('/waitlist', waitlistLimiter, joinLaunchWaitlist);
router.post('/partner', partnerLimiter, submitPartnerRequest);

export default router;
