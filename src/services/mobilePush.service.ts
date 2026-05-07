import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, type MulticastMessage } from 'firebase-admin/messaging';
import env from '../config/env';
import MobilePushToken from '../models/MobilePushToken';

type RecipientModel = 'User' | 'Worker' | 'Admin';

interface NotificationMobilePushParams {
  recipientId: string;
  recipientModel: RecipientModel;
  notificationId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  createdAt: Date;
}

interface FirebaseServiceAccountConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

let firebaseConfigured = false;
let firebaseConfigWarningShown = false;

const parseServiceAccountFromJson = (): FirebaseServiceAccountConfig | null => {
  const rawJson = env.FIREBASE_SERVICE_ACCOUNT_JSON.trim();
  if (!rawJson) return null;

  try {
    const parsed = JSON.parse(rawJson) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };

    const projectId = (parsed.project_id || '').trim();
    const clientEmail = (parsed.client_email || '').trim();
    const privateKey = (parsed.private_key || '').trim();

    if (!projectId || !clientEmail || !privateKey) return null;

    return {
      projectId,
      clientEmail,
      privateKey,
    };
  } catch {
    return null;
  }
};

const parseServiceAccountFromSplitEnv = (): FirebaseServiceAccountConfig | null => {
  const projectId = env.FIREBASE_PROJECT_ID.trim();
  const clientEmail = env.FIREBASE_CLIENT_EMAIL.trim();
  const privateKeyRaw = env.FIREBASE_PRIVATE_KEY.trim();

  if (!projectId || !clientEmail || !privateKeyRaw) return null;

  return {
    projectId,
    clientEmail,
    privateKey: privateKeyRaw.replace(/\\n/g, '\n'),
  };
};

const getServiceAccountConfig = (): FirebaseServiceAccountConfig | null => {
  return parseServiceAccountFromJson() || parseServiceAccountFromSplitEnv();
};

const ensureFirebaseConfigured = (): boolean => {
  if (!env.MOBILE_PUSH_ENABLED) return false;
  if (firebaseConfigured) return true;

  const serviceAccount = getServiceAccountConfig();
  if (!serviceAccount) {
    if (!firebaseConfigWarningShown) {
      console.warn('Mobile push is enabled but Firebase credentials are missing. Skipping mobile push delivery.');
      firebaseConfigWarningShown = true;
    }
    return false;
  }

  try {
    if (!getApps().length) {
      initializeApp({
        credential: cert({
          projectId: serviceAccount.projectId,
          clientEmail: serviceAccount.clientEmail,
          privateKey: serviceAccount.privateKey,
        }),
      });
    }

    firebaseConfigured = true;
    return true;
  } catch (error) {
    console.error('Failed to initialize Firebase Admin for mobile push:', error);
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

const toStringDataValue = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
};

const chunk = <T>(items: T[], size: number): T[][] => {
  const output: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    output.push(items.slice(i, i + size));
  }
  return output;
};

const inactiveTokenErrorCodes = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/mismatched-credential',
]);

export const isMobilePushEnabled = (): boolean => {
  return ensureFirebaseConfigured();
};

export const sendMobilePushNotification = async (params: NotificationMobilePushParams): Promise<void> => {
  if (!ensureFirebaseConfigured()) return;

  const deviceTokens = await MobilePushToken.find({
    recipient: params.recipientId,
    recipientModel: params.recipientModel,
    isActive: true,
  })
    .select('token')
    .lean();

  const tokens = Array.from(new Set(deviceTokens.map((item) => item.token).filter(Boolean)));
  if (!tokens.length) return;

  const url = buildNotificationUrl(params.recipientModel, params.type, params.data);
  const payloadData: Record<string, string> = {
    notificationId: params.notificationId,
    type: params.type,
    url,
    createdAt: params.createdAt.toISOString(),
  };

  for (const [key, value] of Object.entries(params.data || {})) {
    if (value === undefined || value === null) continue;
    payloadData[key] = toStringDataValue(value);
  }

  const inactiveTokens: string[] = [];

  for (const tokenChunk of chunk(tokens, 500)) {
    const message: MulticastMessage = {
      tokens: tokenChunk,
      notification: {
        title: params.title,
        body: params.message,
      },
      data: payloadData,
      android: {
        priority: 'high',
        notification: {
          clickAction: 'FCM_PLUGIN_ACTIVITY',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
          },
        },
      },
    };

    const result = await getMessaging().sendEachForMulticast(message);

    result.responses.forEach((response, index) => {
      if (response.success) return;

      const token = tokenChunk[index];
      const code = response.error?.code || 'unknown';
      if (inactiveTokenErrorCodes.has(code)) {
        inactiveTokens.push(token);
      }

      console.error('Mobile push send error:', code, response.error?.message || 'Unknown error');
    });
  }

  if (inactiveTokens.length > 0) {
    await MobilePushToken.updateMany(
      { token: { $in: inactiveTokens } },
      {
        $set: {
          isActive: false,
        },
      }
    );
  }
};
