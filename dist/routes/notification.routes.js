"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const notification_controller_1 = require("../controllers/notification.controller");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.protect, (0, auth_middleware_1.authorize)('customer', 'worker', 'admin'));
router.get('/push/config', notification_controller_1.getPushConfig);
router.post('/push/subscribe', notification_controller_1.subscribePush);
router.post('/push/unsubscribe', notification_controller_1.unsubscribePush);
router.post('/push/unsubscribe-all', notification_controller_1.unsubscribeAllPush);
exports.default = router;
//# sourceMappingURL=notification.routes.js.map