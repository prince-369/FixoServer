# Push Notification Setup

This project now supports 3 delivery layers:

1. In-app realtime (`Socket.IO`) when app is open.
2. Browser push notifications (`Web Push`) for background/closed tabs.
3. Persistent in-app inbox (`Notification` collection) for missed events.

## 1) Generate VAPID keys

Run in `server/`:

```bash
npx web-push generate-vapid-keys
```

Copy generated values to environment variables:

- `WEB_PUSH_PUBLIC_KEY`
- `WEB_PUSH_PRIVATE_KEY`
- `WEB_PUSH_SUBJECT` (example: `mailto:alerts@fixo.app`)

## 2) Required env vars

```env
WEB_PUSH_ENABLED=true
WEB_PUSH_PUBLIC_KEY=...
WEB_PUSH_PRIVATE_KEY=...
WEB_PUSH_SUBJECT=mailto:alerts@fixo.app
WEB_PUSH_TTL_SECONDS=3600
```

## 3) Client behavior

- Service worker file: `client/public/push-sw.js`
- Auto-subscribe bridge: `client/src/components/PushNotificationBridge.tsx`
- Subscription API endpoints:
  - `GET /api/notifications/push/config`
  - `POST /api/notifications/push/subscribe`
  - `POST /api/notifications/push/unsubscribe`
  - `POST /api/notifications/push/unsubscribe-all`

## 4) Important platform limits

- Push works when tab/app is in background or closed, if user granted notification permission.
- If user fully uninstalls PWA/browser profile or revokes permission, push cannot be delivered to that device.
- For guaranteed delivery after uninstall/permission revoke, add fallback channels (SMS/WhatsApp/Email) for critical alerts.
