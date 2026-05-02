import { Request, Response } from 'express';
import PushSubscription from '../models/PushSubscription';
import { getWebPushPublicKey, isWebPushEnabled } from '../services/webPush.service';

const toRecipientModel = (role: 'customer' | 'worker' | 'admin'): 'User' | 'Worker' | 'Admin' => {
  if (role === 'customer') return 'User';
  if (role === 'worker') return 'Worker';
  return 'Admin';
};

interface PushSubscriptionInput {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
}

const isValidSubscription = (subscription: PushSubscriptionInput): boolean => {
  return Boolean(
    subscription.endpoint &&
    typeof subscription.endpoint === 'string' &&
    subscription.endpoint.trim() &&
    subscription.keys?.p256dh &&
    subscription.keys?.auth
  );
};

export const getPushConfig = async (_req: Request, res: Response): Promise<void> => {
  const enabled = isWebPushEnabled();

  res.json({
    enabled,
    publicKey: enabled ? getWebPushPublicKey() : '',
  });
};

export const subscribePush = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    if (!isWebPushEnabled()) {
      res.status(503).json({ message: 'Push notifications are not configured on the server.' });
      return;
    }

    const subscription = (req.body?.subscription || {}) as PushSubscriptionInput;
    if (!isValidSubscription(subscription)) {
      res.status(400).json({ message: 'Invalid push subscription payload.' });
      return;
    }

    const recipientModel = toRecipientModel(req.user.role);

    await PushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint!.trim() },
      {
        recipient: req.user.id,
        recipientModel,
        endpoint: subscription.endpoint!.trim(),
        expirationTime: typeof subscription.expirationTime === 'number' ? subscription.expirationTime : null,
        keys: {
          p256dh: subscription.keys!.p256dh!,
          auth: subscription.keys!.auth!,
        },
        userAgent: req.get('user-agent') || '',
        isActive: true,
        lastSeenAt: new Date(),
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    res.json({ message: 'Push subscription saved successfully.' });
  } catch (error) {
    console.error('Subscribe push error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const unsubscribePush = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint.trim() : '';
    if (!endpoint) {
      res.status(400).json({ message: 'Endpoint is required.' });
      return;
    }

    await PushSubscription.updateOne(
      { endpoint, recipient: req.user.id },
      {
        $set: {
          isActive: false,
          lastSeenAt: new Date(),
        },
      }
    );

    res.json({ message: 'Push subscription removed.' });
  } catch (error) {
    console.error('Unsubscribe push error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const unsubscribeAllPush = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    const recipientModel = toRecipientModel(req.user.role);

    await PushSubscription.updateMany(
      { recipient: req.user.id, recipientModel, isActive: true },
      {
        $set: {
          isActive: false,
          lastSeenAt: new Date(),
        },
      }
    );

    res.json({ message: 'All push subscriptions removed for this user.' });
  } catch (error) {
    console.error('Unsubscribe all push error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
