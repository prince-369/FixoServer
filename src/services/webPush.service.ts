import webpush from 'web-push';
import env from '../config/env';
import PushSubscription from '../models/PushSubscription';

type RecipientModel = 'User' | 'Worker' | 'Admin';

interface NotificationPushParams {
  recipientId: string;
  recipientModel: RecipientModel;
  notificationId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  createdAt: Date;
}

let vapidConfigured = false;

const isConfigComplete = (): boolean => {
  return Boolean(
    env.WEB_PUSH_ENABLED &&
    env.WEB_PUSH_PUBLIC_KEY &&
    env.WEB_PUSH_PRIVATE_KEY &&
    env.WEB_PUSH_SUBJECT
  );
};

const ensureVapidConfigured = (): boolean => {
  if (!isConfigComplete()) return false;
  if (vapidConfigured) return true;

  try {
    webpush.setVapidDetails(
      env.WEB_PUSH_SUBJECT,
      env.WEB_PUSH_PUBLIC_KEY,
      env.WEB_PUSH_PRIVATE_KEY
    );
    vapidConfigured = true;
    return true;
  } catch (error) {
    console.error('Failed to configure web push VAPID details:', error);
    return false;
  }
};

const buildNotificationUrl = (
  recipientModel: RecipientModel,
  type: string,
  data?: Record<string, unknown>
): string => {
  const bookingId = typeof data?.bookingId === 'string' ? data.bookingId : '';
  const ticketId = typeof data?.ticketId === 'string' ? data.ticketId : '';

  if (recipientModel === 'Admin') {
    if (type.startsWith('ekyc_')) return '/admin/ekyc';
    if (ticketId) return '/admin/help-support';
    return '/admin/notifications';
  }

  if (recipientModel === 'Worker') {
    if (type === 'ekyc_admin_available') return '/worker/complete-profile';
    if (ticketId) return '/worker/help-support';
    if (bookingId) return '/worker/work-requests';
    return '/worker/notifications';
  }

  if (ticketId) return '/help-support';
  if (bookingId) return `/bookings/${bookingId}`;
  return '/notifications';
};

export const isWebPushEnabled = (): boolean => {
  return ensureVapidConfigured();
};

export const getWebPushPublicKey = (): string => {
  return env.WEB_PUSH_PUBLIC_KEY;
};

export const sendWebPushNotification = async (params: NotificationPushParams): Promise<void> => {
  if (!ensureVapidConfigured()) return;

  const subscriptions = await PushSubscription.find({
    recipient: params.recipientId,
    recipientModel: params.recipientModel,
    isActive: true,
  })
    .select('endpoint expirationTime keys')
    .lean();

  if (!subscriptions.length) return;

  const url = buildNotificationUrl(params.recipientModel, params.type, params.data);
  const payload = JSON.stringify({
    title: params.title,
    body: params.message,
    icon: '/favicon.png',
    badge: '/favicon.png',
    tag: `fixo:${params.type}:${params.notificationId}`,
    url,
    notificationId: params.notificationId,
    type: params.type,
    data: params.data || {},
    createdAt: params.createdAt.toISOString(),
  });

  const endpointsToDeactivate: string[] = [];

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            expirationTime: subscription.expirationTime || null,
            keys: {
              p256dh: subscription.keys.p256dh,
              auth: subscription.keys.auth,
            },
          },
          payload,
          {
            TTL: env.WEB_PUSH_TTL_SECONDS,
            urgency: 'high',
          }
        );
      } catch (error: any) {
        const statusCode = Number(error?.statusCode || 0);
        if ([404, 410].includes(statusCode)) {
          endpointsToDeactivate.push(subscription.endpoint);
        }
        console.error('Web push send error:', error?.message || error);
      }
    })
  );

  if (endpointsToDeactivate.length > 0) {
    await PushSubscription.updateMany(
      { endpoint: { $in: endpointsToDeactivate } },
      { $set: { isActive: false } }
    );
  }
};
