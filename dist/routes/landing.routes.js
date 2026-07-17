"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const rateLimit_middleware_1 = require("../middlewares/rateLimit.middleware");
const landing_controller_1 = require("../controllers/landing.controller");
const router = (0, express_1.Router)();
// Public and unauthenticated — the marketing site posts here. Each form carries
// its own IP limiter (see rateLimit.middleware) on top of the global apiLimiter.
router.post('/waitlist', rateLimit_middleware_1.waitlistLimiter, landing_controller_1.joinLaunchWaitlist);
router.post('/partner', rateLimit_middleware_1.partnerLimiter, landing_controller_1.submitPartnerRequest);
exports.default = router;
//# sourceMappingURL=landing.routes.js.map