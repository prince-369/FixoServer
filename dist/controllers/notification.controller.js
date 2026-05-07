"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.unregisterAllMobilePushTokens = exports.unregisterMobilePushToken = exports.registerMobilePushToken = exports.unsubscribeAllPush = exports.unsubscribePush = exports.subscribePush = exports.getPushConfig = void 0;
const PushSubscription_1 = __importDefault(require("../models/PushSubscription"));
const MobilePushToken_1 = __importDefault(require("../models/MobilePushToken"));
const webPush_service_1 = require("../services/webPush.service");
const toRecipientModel = (role) => {
    if (role === 'customer')
        return 'User';
    if (role === 'worker')
        return 'Worker';
    return 'Admin';
};
const isValidSubscription = (subscription) => {
    return Boolean(subscription.endpoint &&
        typeof subscription.endpoint === 'string' &&
        subscription.endpoint.trim() &&
        subscription.keys?.p256dh &&
        subscription.keys?.auth);
};
const normalizeMobilePlatform = (platform) => {
    if (platform === 'android' || platform === 'ios')
        return platform;
    return 'unknown';
};
const getPushConfig = async (_req, res) => {
    const enabled = (0, webPush_service_1.isWebPushEnabled)();
    res.json({
        enabled,
        publicKey: enabled ? (0, webPush_service_1.getWebPushPublicKey)() : '',
    });
};
exports.getPushConfig = getPushConfig;
const subscribePush = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Not authorized' });
            return;
        }
        if (!(0, webPush_service_1.isWebPushEnabled)()) {
            res.status(503).json({ message: 'Push notifications are not configured on the server.' });
            return;
        }
        const subscription = (req.body?.subscription || {});
        if (!isValidSubscription(subscription)) {
            res.status(400).json({ message: 'Invalid push subscription payload.' });
            return;
        }
        const recipientModel = toRecipientModel(req.user.role);
        await PushSubscription_1.default.findOneAndUpdate({ endpoint: subscription.endpoint.trim() }, {
            recipient: req.user.id,
            recipientModel,
            endpoint: subscription.endpoint.trim(),
            expirationTime: typeof subscription.expirationTime === 'number' ? subscription.expirationTime : null,
            keys: {
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth,
            },
            userAgent: req.get('user-agent') || '',
            isActive: true,
            lastSeenAt: new Date(),
        }, {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
        });
        res.json({ message: 'Push subscription saved successfully.' });
    }
    catch (error) {
        console.error('Subscribe push error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.subscribePush = subscribePush;
const unsubscribePush = async (req, res) => {
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
        await PushSubscription_1.default.updateOne({ endpoint, recipient: req.user.id }, {
            $set: {
                isActive: false,
                lastSeenAt: new Date(),
            },
        });
        res.json({ message: 'Push subscription removed.' });
    }
    catch (error) {
        console.error('Unsubscribe push error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.unsubscribePush = unsubscribePush;
const unsubscribeAllPush = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Not authorized' });
            return;
        }
        const recipientModel = toRecipientModel(req.user.role);
        await PushSubscription_1.default.updateMany({ recipient: req.user.id, recipientModel, isActive: true }, {
            $set: {
                isActive: false,
                lastSeenAt: new Date(),
            },
        });
        res.json({ message: 'All push subscriptions removed for this user.' });
    }
    catch (error) {
        console.error('Unsubscribe all push error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.unsubscribeAllPush = unsubscribeAllPush;
const registerMobilePushToken = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Not authorized' });
            return;
        }
        const payload = (req.body || {});
        const token = typeof payload.token === 'string' ? payload.token.trim() : '';
        if (!token || token.length < 20) {
            res.status(400).json({ message: 'Invalid mobile push token.' });
            return;
        }
        const recipientModel = toRecipientModel(req.user.role);
        await MobilePushToken_1.default.findOneAndUpdate({ token }, {
            recipient: req.user.id,
            recipientModel,
            token,
            platform: normalizeMobilePlatform(payload.platform),
            userAgent: req.get('user-agent') || '',
            isActive: true,
            lastSeenAt: new Date(),
        }, {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
        });
        res.json({ message: 'Mobile push token saved successfully.' });
    }
    catch (error) {
        console.error('Register mobile push token error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.registerMobilePushToken = registerMobilePushToken;
const unregisterMobilePushToken = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Not authorized' });
            return;
        }
        const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
        if (!token) {
            res.status(400).json({ message: 'Token is required.' });
            return;
        }
        await MobilePushToken_1.default.updateOne({ token, recipient: req.user.id }, {
            $set: {
                isActive: false,
                lastSeenAt: new Date(),
            },
        });
        res.json({ message: 'Mobile push token removed.' });
    }
    catch (error) {
        console.error('Unregister mobile push token error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.unregisterMobilePushToken = unregisterMobilePushToken;
const unregisterAllMobilePushTokens = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Not authorized' });
            return;
        }
        const recipientModel = toRecipientModel(req.user.role);
        await MobilePushToken_1.default.updateMany({ recipient: req.user.id, recipientModel, isActive: true }, {
            $set: {
                isActive: false,
                lastSeenAt: new Date(),
            },
        });
        res.json({ message: 'All mobile push tokens removed for this user.' });
    }
    catch (error) {
        console.error('Unregister all mobile push tokens error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.unregisterAllMobilePushTokens = unregisterAllMobilePushTokens;
//# sourceMappingURL=notification.controller.js.map