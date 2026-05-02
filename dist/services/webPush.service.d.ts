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
export declare const isWebPushEnabled: () => boolean;
export declare const getWebPushPublicKey: () => string;
export declare const sendWebPushNotification: (params: NotificationPushParams) => Promise<void>;
export {};
//# sourceMappingURL=webPush.service.d.ts.map