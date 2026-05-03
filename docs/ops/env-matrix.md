# Fixo Backend Environment Matrix

This matrix is the baseline for production-style deployments.

Guidelines:
- Keep secrets out of Git; inject with your secret manager.
- Use different credentials and databases for staging and production.
- Keep Redis enabled in both staging and production for accurate scaling behavior tests.

| Variable | Staging | Production | Notes |
|---|---|---|---|
| NODE_ENV | staging-style via development profile | production | Runtime mode |
| PORT | 5000 | 5000 | Usually internal service port |
| TRUST_PROXY | true | true | Required behind load balancer |
| CLIENT_URL | https://staging.fixo.app | https://fixo.app | Primary frontend |
| CLIENT_URLS | https://staging.fixo.app,https://staging-admin.fixo.app | https://fixo.app,https://admin.fixo.app | CORS allowlist |
| MONGODB_URI | mongodb+srv://.../fixo_staging | mongodb+srv://.../fixo_prod | Dedicated DB per env |
| MONGODB_MAX_POOL_SIZE | 80 | 300 | Size with load profile |
| MONGODB_MIN_POOL_SIZE | 5 | 20 | Keep warm connections |
| MONGODB_SERVER_SELECTION_TIMEOUT_MS | 10000 | 10000 | DB fail-fast |
| MONGODB_SOCKET_TIMEOUT_MS | 45000 | 45000 | Long query protection |
| MONGODB_CONNECT_TIMEOUT_MS | 10000 | 10000 | Initial connect timeout |
| MONGODB_MAX_IDLE_TIME_MS | 30000 | 30000 | Reclaim idle sockets |
| JWT_SECRET | staging secret | production secret | Must be long and unique |
| JWT_EXPIRE | 7d | 7d | Access token policy remains separate |
| BODY_LIMIT_MB | 2 | 2 | Prevent payload abuse |
| URL_ENCODED_LIMIT_MB | 2 | 2 | Prevent payload abuse |
| REQUEST_TIMEOUT_MS | 30000 | 30000 | API timeout |
| KEEP_ALIVE_TIMEOUT_MS | 65000 | 65000 | Should align with LB |
| HEADERS_TIMEOUT_MS | 66000 | 66000 | Keep > keepAliveTimeout |
| MAX_REQUESTS_PER_SOCKET | 2000 | 8000 | Socket reuse guard |
| SLOW_REQUEST_THRESHOLD_MS | 1000 | 800 | Alerting and logs |
| RATE_LIMIT_WINDOW_MS | 900000 | 900000 | 15 minutes |
| RATE_LIMIT_MAX | 300 | 1200 | Tune by traffic volume |
| AUTH_RATE_LIMIT_MAX | 20 | 50 | Brute-force protection |
| MUTATION_RATE_LIMIT_MAX | 80 | 250 | Write endpoint protection |
| IDEMPOTENCY_TTL_MS | 15000 | 30000 | Replay safety window |
| REDIS_URL | redis://staging-redis:6379 | redis://prod-redis:6379 | Required for multi-instance rate-limit/socket adapter |
| SOCKET_PING_INTERVAL_MS | 20000 | 20000 | Reconnect behavior |
| SOCKET_PING_TIMEOUT_MS | 25000 | 25000 | Reconnect behavior |
| SOCKET_MAX_HTTP_BUFFER_SIZE | 1000000 | 1000000 | Event payload cap |
| WEB_PUSH_ENABLED | true | true | Master switch for browser push delivery |
| WEB_PUSH_PUBLIC_KEY | staging VAPID public key | production VAPID public key | Exposed to client for subscription |
| WEB_PUSH_PRIVATE_KEY | staging VAPID private key | production VAPID private key | Keep in secret manager |
| WEB_PUSH_SUBJECT | mailto:staging-alerts@fixo.app | mailto:alerts@fixo.app | VAPID subject identity |
| WEB_PUSH_TTL_SECONDS | 3600 | 3600 | Push delivery retention window |
| RAZORPAY_WEBHOOK_SECRET | staging webhook secret | production webhook secret | Verify Razorpay webhook signatures |
| METRICS_ENABLED | true | true | Prometheus metrics |
| METRICS_ROUTE | /api/metrics | /api/metrics | Scrape route |
| METRICS_AUTH_TOKEN | strong staging token | strong prod token | Required in internet-exposed setups |
| METRICS_SERVICE_NAME | fixo-server-staging | fixo-server | Metric labels |
| JOB_STALE_BOOKING_MINUTES | 3 | 3 | Auto cleanup rule |
| JOB_CLEANUP_INTERVAL_MS | 60000 | 30000 | Sweep frequency |
| MAPCN_GEOCODE_URL | https://nominatim.openstreetmap.org/search | https://nominatim.openstreetmap.org/search | Prefer paid provider at high scale |
| MAPCN_REVERSE_GEOCODE_URL | https://nominatim.openstreetmap.org/reverse | https://nominatim.openstreetmap.org/reverse | Prefer paid provider at high scale |
| MAPCN_ROUTING_URL | https://router.project-osrm.org/route/v1/driving | https://router.project-osrm.org/route/v1/driving | Prefer dedicated routing infra |

## Secrets Rotation Policy

Rotate immediately if any secret was ever committed or shared in plaintext:
- JWT_SECRET
- Cloudinary API secret
- Razorpay secret
- Razorpay webhook secret
- Twilio auth token
- SMTP app password
- Google OAuth secret
- METRICS_AUTH_TOKEN
