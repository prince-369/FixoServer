"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMobilePushNotification = exports.isMobilePushEnabled = void 0;
const app_1 = require("firebase-admin/app");
const messaging_1 = require("firebase-admin/messaging");
const env_1 = __importDefault(require("../config/env"));
const MobilePushToken_1 = __importDefault(require("../models/MobilePushToken"));
let firebaseConfigured = false;
let firebaseConfigWarningShown = false;
const parseServiceAccountFromJson = () => {
    const rawJson = env_1.default.FIREBASE_SERVICE_ACCOUNT_JSON.trim();
    if (!rawJson)
        return null;
    try {
        const parsed = JSON.parse(rawJson);
        const projectId = (parsed.project_id || '').trim();
        const clientEmail = (parsed.client_email || '').trim();
        const privateKey = (parsed.private_key || '').trim();
        if (!projectId || !clientEmail || !privateKey)
            return null;
        return {
            projectId,
            clientEmail,
            privateKey,
        };
    }
    catch {
        return null;
    }
};
const parseServiceAccountFromSplitEnv = () => {
    const projectId = env_1.default.FIREBASE_PROJECT_ID.trim();
    const clientEmail = env_1.default.FIREBASE_CLIENT_EMAIL.trim();
    const privateKeyRaw = env_1.default.FIREBASE_PRIVATE_KEY.trim();
    if (!projectId || !clientEmail || !privateKeyRaw)
        return null;
    return {
        projectId,
        clientEmail,
        privateKey: privateKeyRaw.replace(/\\n/g, '\n'),
    };
};
const getServiceAccountConfig = () => {
    return parseServiceAccountFromJson() || parseServiceAccountFromSplitEnv();
};
const ensureFirebaseConfigured = () => {
    if (!env_1.default.MOBILE_PUSH_ENABLED)
        return false;
    if (firebaseConfigured)
        return true;
    const serviceAccount = getServiceAccountConfig();
    if (!serviceAccount) {
        if (!firebaseConfigWarningShown) {
            console.warn('Mobile push is enabled but Firebase credentials are missing. Skipping mobile push delivery.');
            firebaseConfigWarningShown = true;
        }
        return false;
    }
    try {
        if (!(0, app_1.getApps)().length) {
            (0, app_1.initializeApp)({
                credential: (0, app_1.cert)({
                    projectId: serviceAccount.projectId,
                    clientEmail: serviceAccount.clientEmail,
                    privateKey: serviceAccount.privateKey,
                }),
            });
        }
        firebaseConfigured = true;
        return true;
    }
    catch (error) {
        console.error('Failed to initialize Firebase Admin for mobile push:', error);
        return false;
    }
};
const buildNotificationUrl = (recipientModel, type, data) => {
    const bookingId = typeof data?.bookingId === 'string' ? data.bookingId : '';
    const ticketId = typeof data?.ticketId === 'string' ? data.ticketId : '';
    if (recipientModel === 'Admin') {
        if (type.startsWith('ekyc_'))
            return '/admin/ekyc';
        if (ticketId)
            return '/admin/help-support';
        return '/admin/notifications';
    }
    if (recipientModel === 'Worker') {
        if (type === 'ekyc_admin_available')
            return '/worker/complete-profile';
        if (ticketId)
            return '/worker/help-support';
        if (bookingId)
            return '/worker/work-requests';
        return '/worker/notifications';
    }
    if (ticketId)
        return '/help-support';
    if (bookingId)
        return `/bookings/${bookingId}`;
    return '/notifications';
};
const toStringDataValue = (value) => {
    if (typeof value === 'string')
        return value;
    if (typeof value === 'number' || typeof value === 'boolean')
        return String(value);
    try {
        return JSON.stringify(value);
    }
    catch {
        return '';
    }
};
const chunk = (items, size) => {
    const output = [];
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
const isMobilePushEnabled = () => {
    return ensureFirebaseConfigured();
};
exports.isMobilePushEnabled = isMobilePushEnabled;
const sendMobilePushNotification = async (params) => {
    if (!ensureFirebaseConfigured())
        return;
    const deviceTokens = await MobilePushToken_1.default.find({
        recipient: params.recipientId,
        recipientModel: params.recipientModel,
        isActive: true,
    })
        .select('token')
        .lean();
    const tokens = Array.from(new Set(deviceTokens.map((item) => item.token).filter(Boolean)));
    if (!tokens.length)
        return;
    const url = buildNotificationUrl(params.recipientModel, params.type, params.data);
    const payloadData = {
        notificationId: params.notificationId,
        type: params.type,
        url,
        createdAt: params.createdAt.toISOString(),
    };
    for (const [key, value] of Object.entries(params.data || {})) {
        if (value === undefined || value === null)
            continue;
        payloadData[key] = toStringDataValue(value);
    }
    const inactiveTokens = [];
    for (const tokenChunk of chunk(tokens, 500)) {
        const message = {
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
        const result = await (0, messaging_1.getMessaging)().sendEachForMulticast(message);
        result.responses.forEach((response, index) => {
            if (response.success)
                return;
            const token = tokenChunk[index];
            const code = response.error?.code || 'unknown';
            if (inactiveTokenErrorCodes.has(code)) {
                inactiveTokens.push(token);
            }
            console.error('Mobile push send error:', code, response.error?.message || 'Unknown error');
        });
    }
    if (inactiveTokens.length > 0) {
        await MobilePushToken_1.default.updateMany({ token: { $in: inactiveTokens } }, {
            $set: {
                isActive: false,
            },
        });
    }
};
exports.sendMobilePushNotification = sendMobilePushNotification;
//# sourceMappingURL=mobilePush.service.js.map