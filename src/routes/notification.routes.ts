import { Router } from 'express';
import { protect, authorize } from '../middlewares/auth.middleware';
import {
  getPushConfig,
  subscribePush,
  unsubscribePush,
  unsubscribeAllPush,
} from '../controllers/notification.controller';

const router = Router();

router.use(protect, authorize('customer', 'worker', 'admin'));

router.get('/push/config', getPushConfig);
router.post('/push/subscribe', subscribePush);
router.post('/push/unsubscribe', unsubscribePush);
router.post('/push/unsubscribe-all', unsubscribeAllPush);

export default router;
