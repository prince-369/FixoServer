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
export declare const isMobilePushEnabled: () => boolean;
export declare const sendMobilePushNotification: (params: NotificationMobilePushParams) => Promise<void>;
export {};
//# sourceMappingURL=mobilePush.service.d.ts.map