import { Router } from 'express';
import { protect, authorize } from '../middlewares/auth.middleware';
import {
  getPushConfig,
  subscribePush,
  unsubscribePush,
  unsubscribeAllPush,
  registerMobilePushToken,
  unregisterMobilePushToken,
  unregisterAllMobilePushTokens,
} from '../controllers/notification.controller';

const router = Router();

router.use(protect, authorize('customer', 'worker', 'admin'));

router.get('/push/config', getPushConfig);
router.post('/push/subscribe', subscribePush);
router.post('/push/unsubscribe', unsubscribePush);
router.post('/push/unsubscribe-all', unsubscribeAllPush);
router.post('/mobile/register', registerMobilePushToken);
router.post('/mobile/unregister', unregisterMobilePushToken);
router.post('/mobile/unregister-all', unregisterAllMobilePushTokens);

export default router;
