# Fixo Server

Backend API for FIXO (Express + TypeScript + MongoDB + Socket.IO).

## Local Development

1. Install dependencies:
   npm install
2. Copy env template and fill values:
   copy .env.example .env
3. Run in dev mode:
   npm run dev

## Render Deployment

This server is ready for Render deployment using the included blueprint file: render.yaml.

### Option A: Blueprint Deploy (Recommended)

1. Push this repository to GitHub.
2. In Render, click New -> Blueprint.
3. Select the repository and choose the branch.
4. Render will read render.yaml and create the web service automatically.
5. Fill all environment variables marked with sync: false.

### Option B: Manual Web Service

If you create service manually in Render dashboard, use:

- Runtime: Node
- Build Command: npm ci && npm run build
- Start Command: npm run start
- Health Check Path: /api/health

## Required Environment Variables

Minimum required for production startup:

- NODE_ENV=production
- TRUST_PROXY=true
- MONGODB_URI=your-production-mongodb-uri
- JWT_SECRET=your-strong-secret
- CLIENT_URL=https://your-client-domain.vercel.app
- CLIENT_URLS=https://your-client-domain.vercel.app,https://www.your-client-domain.com

Feature-specific variables:

- Payments: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET
- Media uploads: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
- Email: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
- Push notifications: WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY, WEB_PUSH_SUBJECT
- Optional scaling: REDIS_URL

## Important Production Notes

- Cross-domain auth cookie support is enabled for production:
  refresh token cookie uses SameSite=None and Secure.
- CLIENT_URL / CLIENT_URLS must include your Vercel frontend domains.
- If MONGODB_URI or CLIENT_URL is missing in production, server exits early by design.

## Post-Deploy Verification

After first deploy, verify:

1. Health endpoint: GET /api/health
2. Readiness endpoint: GET /api/ready
3. CORS + auth flow from frontend domain (login, refresh token, logout)
4. Worker/admin payout and booking flows

## Build Validation

Use this before deploy:

npm run build
