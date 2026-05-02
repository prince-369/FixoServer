"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendWebPushNotification = exports.getWebPushPublicKey = exports.isWebPushEnabled = void 0;
const web_push_1 = __importDefault(require("web-push"));
const env_1 = __importDefault(require("../config/env"));
const PushSubscription_1 = __importDefault(require("../models/PushSubscription"));
let vapidConfigured = false;
const isConfigComplete = () => {
    return Boolean(env_1.default.WEB_PUSH_ENABLED &&
        env_1.default.WEB_PUSH_PUBLIC_KEY &&
        env_1.default.WEB_PUSH_PRIVATE_KEY &&
        env_1.default.WEB_PUSH_SUBJECT);
};
const ensureVapidConfigured = () => {
    if (!isConfigComplete())
        return false;
    if (vapidConfigured)
        return true;
    try {
        web_push_1.default.setVapidDetails(env_1.default.WEB_PUSH_SUBJECT, env_1.default.WEB_PUSH_PUBLIC_KEY, env_1.default.WEB_PUSH_PRIVATE_KEY);
        vapidConfigured = true;
        return true;
    }
    catch (error) {
        console.error('Failed to configure web push VAPID details:', error);
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
const isWebPushEnabled = () => {
    return ensureVapidConfigured();
};
exports.isWebPushEnabled = isWebPushEnabled;
const getWebPushPublicKey = () => {
    return env_1.default.WEB_PUSH_PUBLIC_KEY;
};
exports.getWebPushPublicKey = getWebPushPublicKey;
const sendWebPushNotification = async (params) => {
    if (!ensureVapidConfigured())
        return;
    const subscriptions = await PushSubscription_1.default.find({
        recipient: params.recipientId,
        recipientModel: params.recipientModel,
        isActive: true,
    })
        .select('endpoint expirationTime keys')
        .lean();
    if (!subscriptions.length)
        return;
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
    const endpointsToDeactivate = [];
    await Promise.all(subscriptions.map(async (subscription) => {
        try {
            await web_push_1.default.sendNotification({
                endpoint: subscription.endpoint,
                expirationTime: subscription.expirationTime || null,
                keys: {
                    p256dh: subscription.keys.p256dh,
                    auth: subscription.keys.auth,
                },
            }, payload, {
                TTL: env_1.default.WEB_PUSH_TTL_SECONDS,
                urgency: 'high',
            });
        }
        catch (error) {
            const statusCode = Number(error?.statusCode || 0);
            if ([404, 410].includes(statusCode)) {
                endpointsToDeactivate.push(subscription.endpoint);
            }
            console.error('Web push send error:', error?.message || error);
        }
    }));
    if (endpointsToDeactivate.length > 0) {
        await PushSubscription_1.default.updateMany({ endpoint: { $in: endpointsToDeactivate } }, { $set: { isActive: false } });
    }
};
exports.sendWebPushNotification = sendWebPushNotification;
//# sourceMappingURL=webPush.service.js.map