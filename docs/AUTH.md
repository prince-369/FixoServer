# FIXO Authentication Architecture

Persistent sessions built on short-lived access tokens and rotating refresh tokens.

---

## 1. Model

```
Login (password / Google / later: phone OTP)
  └─ identity proven
       └─ createSession()                  ← the ONLY place a session is born
            ├─ AuthSession row (one per device)
            ├─ access token   JWT, 15m, in memory
            └─ refresh token  opaque, 30d, rotating
```

Authentication *method* and session *lifetime* are separate concerns. Adding phone
OTP later means calling `createSession()` after the OTP verifies — nothing in the
token, cookie, rotation or client layer changes.

| | Access token | Refresh token |
|---|---|---|
| Format | HS256 JWT | 256-bit random, base64url (opaque) |
| TTL | `ACCESS_TOKEN_TTL` (15m) | `REFRESH_TOKEN_TTL` (30d), sliding |
| Claims | `id`, `role`, `sid`, `tokenType` | none — it is not a token, it is a lookup key |
| Web storage | memory only | HttpOnly cookie |
| Native storage | memory only | `expo-secure-store` (Keychain / Keystore) |
| At rest in DB | never stored | **HMAC-SHA256 hash only** |

Access tokens are not checked against the database on every request — that is the
point of keeping them short. Revocation acts on the refresh token, so a revoked
session dies within at most one access-token lifetime.

## 2. Rotation and reuse detection

Every successful `/auth/refresh` retires the presented token and issues a new one.
The session row keeps the previous token's hash so a replay can be recognised:

```
present token T
  ├─ matches refreshTokenHash        → rotate, issue T'
  ├─ matches previousTokenHash
  │     ├─ within REFRESH_REUSE_GRACE_MS (60s)  → benign retry, rotate again
  │     └─ outside the window                   → THEFT: revoke whole tokenFamilyId
  └─ matches nothing                 → 401
```

The grace window exists because a mobile client that loses the response to a
rotation will retry with a token the server has already retired. Without it, every
flaky connection would look like an attack and log a real user out.

## 3. Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/refresh` | refresh token | Rotate + return access token **and** user profile |
| POST | `/api/auth/logout` | refresh token | Revoke this session |
| POST | `/api/auth/logout-all` | access token | Revoke every session for the account |
| GET | `/api/auth/me` | access token | Current user |
| GET | `/api/auth/sessions` | access token | List active devices |
| DELETE | `/api/auth/sessions/:id` | access token | Revoke one device |
| POST | `/api/auth/session` | access token | Legacy-install migration (see §7) |

`/auth/refresh` returns the user profile alongside the token, so a client restores a
session in one round trip rather than refresh-then-`/auth/me`.

Failures carry a machine-readable `code` so clients can tell a dead session from a
dead network: `NO_SESSION`, `SESSION_INVALID`, `SESSION_EXPIRED`, `SESSION_REVOKED`.
A server fault returns **500, not 401** — a database blip must never read as a logout.

## 4. Transport

Selected by the `X-Client-Type` header:

- **Browsers** (`web` / absent) — refresh token goes out as an HttpOnly cookie and is
  never present in a response body. JavaScript, and therefore XSS, cannot read it.
- **Native** (`native`) — React Native has no cookie jar, so the token is returned in
  the JSON body and stored in the device keychain.

Clients may also send `X-Device-Id` and `X-Device-Name`. A device id makes re-login
replace that device's session instead of stacking a new row, which keeps the session
list a true device list.

## 5. Cookie topology — proxy mode vs custom-domain mode

A refresh cookie only survives a browser restart if it is **first-party** to the page
origin. Third-party cookies are blocked by Safari ITP outright and increasingly by
Chrome and Firefox. Two supported topologies, both driven entirely by environment:

### Mode A — same-origin proxy (**current**)

Each Next app rewrites `/api/*` to the API server, so the browser only ever talks to
the app's own origin and the cookie is first-party to it.

### Mode B — shared apex subdomains (future)

`app.fixoservice.in` + `api.fixoservice.in` share a registrable domain, so the cookie
is first-party without a proxy hop.

### Migration: exactly what changes

**Server (Render):**

| Variable | Mode A (now) | Mode B (custom domains) |
|---|---|---|
| `REFRESH_COOKIE_DOMAIN` | *(empty)* | `.fixoservice.in` |
| `REFRESH_COOKIE_SAMESITE` | `lax` | `lax` |
| `REFRESH_COOKIE_SECURE` | `true` | `true` |
| `REFRESH_COOKIE_PATH` | `/api/auth` | `/api/auth` |
| `CLIENT_URL` | `https://fixoservice.vercel.app` | `https://app.fixoservice.in` |
| `CLIENT_URLS` | current Vercel origins | `https://app.fixoservice.in,https://worker.fixoservice.in,https://admin.fixoservice.in` |

**Each Next app (Vercel):**

| Variable | Mode A (now) | Mode B (custom domains) |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `/api` | `https://api.fixoservice.in/api` |
| `API_PROXY_TARGET` | `https://fixoserver.online` | *(unset — disables the proxy)* |
| `NEXT_PUBLIC_SOCKET_URL` | `https://fixoserver.online` | `https://api.fixoservice.in` |

**Mobile apps:** unaffected. They never used cookies; `src/lib/config.ts` already
points at the API host directly.

No authentication code changes between modes. `REFRESH_COOKIE_SAMESITE=none` is
supported for a genuinely cross-site deployment, and startup **fails** if it is set
without `REFRESH_COOKIE_SECURE=true`.

## 6. CSRF

No synchroniser token. The reasoning:

1. The refresh cookie is `SameSite=Lax`, and Lax cookies are **not** sent on
   cross-site POST. Every cookie-authenticated auth route is POST, so a request
   forged from another origin arrives with no cookie and fails — SameSite already
   does a CSRF token's job.
2. `requireTrustedOrigin` is the second layer: any request that *does* carry an
   `Origin` header must match the CORS allowlist. This covers the
   `SameSite=None` configuration and browsers without Lax-by-default.
3. Native clients send no `Origin` and no cookie; their token travels in an explicit
   header/body, which a hostile page cannot make a browser send.

A CSRF token would be required if the refresh cookie ever moved to `SameSite=None`
**and** the Origin check were removed. It should not.

## 7. Legacy migration

Nothing about this change logs an existing user out.

- **Old web sessions** — the previous `refreshToken` cookie is still read. On first
  use the old row is redeemed once for a real `AuthSession`, then deleted.
- **Old access tokens** — tokens minted before the `tokenType` claim existed still
  verify, so a deploy does not invalidate in-flight requests.
- **Old mobile installs** — these stored an *access* token in the keychain. On first
  launch it is read once, exchanged at `POST /auth/session` for a proper rotating
  session, and deleted. `POST /auth/session` is `protect`-guarded, so it grants no
  authority the caller does not already hold.
- **Login methods** — password and Google logins are untouched; they now simply call
  `createSession()`.

## 8. Session revocation

| Event | Effect |
|---|---|
| Logout | This session |
| Logout-all | Every session for the account |
| Password **change** | Every session **except** the acting device |
| Password **reset** | Every session, no exception (the account may be compromised) |
| Refresh-token reuse | The entire token family |
| Session limit exceeded | Oldest-used sessions beyond `MAX_SESSIONS_PER_USER` |

Deliberately **not** revoked: ordinary profile edits, worker verification changes, and
admin blocks. A block is temporary and the apps render a dedicated block screen with a
countdown, which needs a live session — killing it would replace that UX with a logout.

## 9. Storage and cleanup

Sessions carry a TTL index on `expiresAt`, so Mongo removes expired rows
automatically. Revoked-but-unexpired rows are kept until natural expiry so reuse
detection still has something to match. No Redis was introduced; the existing
Redis-backed rate limiter is reused for `/auth/refresh`.

## 10. Rate limiting

`/auth/refresh` has its own limiter (`REFRESH_RATE_LIMIT_MAX`, default 60/window)
rather than the login limiter, because healthy clients call it routinely.
`skipSuccessfulRequests` means only failures count, so a normal user is never
throttled while token spraying is cut off quickly.
