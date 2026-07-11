# FIXO Backend — Security Audit Report

**Scope:** `FixoServer` (Node.js + TypeScript + Express + MongoDB, Razorpay payments)
**Type:** White-box source-code security review
**Date:** 2026-07-11
**Reviewer:** Manual code audit (Claude)

> **Note:** This is a **source-code review**. It identifies vulnerabilities in the code logic.
> It does not include live/dynamic exploit validation against the running server.
> Findings are ranked by severity. Fix in the order listed under "Priority".

---

## Executive Summary

The FIXO backend is **well-engineered** overall — it already has strong RBAC, rate limiting,
Razorpay signature verification, express-validator input validation, bcrypt hashing, hashed
password-reset tokens, helmet, and a strict CORS allowlist. This is above average.

However, there are **real vulnerabilities**, concentrated in the **money-handling flows** and the
**Socket.IO layer**, that a motivated attacker could exploit for **financial loss** or **data theft**.

| # | Severity | Issue | Impact |
|---|----------|-------|--------|
| 1 | 🔴 HIGH | Wallet balance race condition (withdrawal / earnings) | Steal money — withdraw more than balance |
| 2 | 🔴 HIGH | Socket.IO auth is optional & role-spoofable | Impersonate any user/admin, leak worker bank details & PII |
| 3 | 🟠 MEDIUM | OTP password-setup/reset has no per-account lockout | Account takeover via OTP brute-force |
| 4 | 🟠 MEDIUM | Coupon usage/per-user limit race (TOCTOU) | Coupon over-redemption / discount abuse |
| 5 | 🟡 MEDIUM | No global NoSQL-injection sanitization | Defense-in-depth gap on unvalidated endpoints |
| 6 | 🟢 LOW | JWT algorithm not pinned | Algorithm-confusion hardening |
| 7 | 🟢 LOW | Access token lives 7 days, non-revocable | Stolen token valid for a week |
| 8 | 🟢 LOW | Info disclosure in Google auth error | Internal config leaked to client |
| 9 | 🟢 LOW | Mass-assignment pattern (ChatbotQA) | Admin-gated, low impact today |
| 10 | ⚠️ CHECK | `.env` secrets exposure | Rotate if ever committed to git |

---

## 🔴 #1 — Wallet Balance Race Condition (HIGH)

**Files:**
- `src/controllers/worker.controller.ts` → `requestWithdrawal` (~line 1418)
- `src/controllers/worker.controller.ts` → `completeWork` (~line 1186)

**Problem:** Balance is updated with a non-atomic **read → check → modify → save**:

```ts
if (amount > worker.balance) { return insufficient; }   // read + check
worker.balance -= amount;                                // modify
await worker.save();                                     // save
```

**Attack (money theft):**
1. Worker has ₹1000 balance.
2. Send **two concurrent** `POST /api/worker/withdraw` requests, each with a **different**
   `x-idempotency-key` header (or slightly different body) so the idempotency guard treats them
   as distinct.
3. Both handlers read `balance = 1000`, both pass `amount(1000) > 1000` → false, both create a
   ₹1000 withdrawal, both save `balance = 0`.
4. Result: **two ₹1000 withdrawals created on a ₹1000 balance → ₹2000 paid out.**

The same class of bug lets `completeWork` **double-credit** earnings if raced.
The `idempotencyGuard` only blocks *identical* replays — it does **not** stop a race with varied keys.

**Fix — atomic conditional update:**

```ts
// requestWithdrawal
const updated = await Worker.findOneAndUpdate(
  { _id: req.user!.id, balance: { $gte: amount } },
  { $inc: { balance: -amount } },
  { new: true }
);
if (!updated) {
  res.status(400).json({ message: 'Insufficient balance' });
  return;
}
// only now create the Withdrawal record (ideally inside a MongoDB transaction)
```

```ts
// completeWork — claim the state transition atomically BEFORE crediting
const booking = await Booking.findOneAndUpdate(
  { _id: req.params.id, assignedWorker: req.user!.id, status: { $in: ['payment_done', 'in_progress'] } },
  { $set: { status: 'completed' } },
  { new: true }
);
if (!booking) { res.status(404).json({ message: 'Booking not found' }); return; }
// ...then credit with $inc, not `balance +=`
await Worker.updateOne({ _id: worker._id }, { $inc: { balance: workerEarning, totalEarnings: workerEarning, totalWorkDone: 1 } });
```

For full safety, wrap the balance change + ledger `Transaction.create` in a **MongoDB transaction**
(`session.withTransaction(...)`).

---

## 🔴 #2 — Socket.IO Authentication is Optional & Spoofable (HIGH)

**File:** `src/socket/index.ts` (auth middleware ~line 355, `register` handler ~line 436)

**Problem:** The socket auth middleware **allows connections with no token, and even with an invalid
token**:

```ts
if (!token) { next(); return; }          // no token → allowed
try { ... } catch { next(); }            // invalid/expired token → still allowed
```

Then the `register` event trusts client-supplied identity when no token was presented:

```ts
socket.on('register', ({ userId, role }) => {
  if (tokenUserId && tokenRole) { /* validated only if a token existed */ }
  registerSocketUser(tokenUserId || userId, tokenRole || role);  // <-- client-controlled
});
```

**Attack (impersonation + data theft):**
1. Attacker opens a socket **without any token**.
2. Emits `register({ userId: '<anything>', role: 'admin' })`.
3. Server joins them to `role:admin` (and `user:<anyId>`) rooms.
4. They now receive **every admin real-time event**, including `withdrawal_update` payloads that
   contain **worker bank details**, plus eKYC worker **names/phone numbers** and other notifications.
   They can also emit admin-only socket actions (e.g. `ekyc:notify-availability`) since role checks
   read the spoofed `connectedUsers` role.

This is an **authentication bypass** on the real-time layer → **PII + bank-detail disclosure**.

**Fix:**
- Reject unauthenticated sockets in the middleware:
  ```ts
  if (!token) return next(new Error('unauthorized'));
  try { socket.data.auth = verifyAccessToken(token); next(); }
  catch { return next(new Error('unauthorized')); }
  ```
- In `register`, **ignore client-supplied `userId`/`role` entirely** — always use `socket.data.auth`.
- Never emit sensitive fields (bank details) into shared rooms; send only IDs and fetch server-side.

---

## 🟠 #3 — OTP Password Setup/Reset: No Per-Account Lockout (MEDIUM)

**Files:**
- `src/controllers/auth.controller.ts` → `sendPasswordSetupOtp` / `setPasswordForOAuthUser` (~line 1124)
- `src/services/sms.service.ts` → `verifyOTP` (~line 37)

**Problem:** `/api/auth/set-password` is **unauthenticated**, takes a `userId` and a **6-digit** OTP.
A wrong OTP does **not** invalidate the real OTP (valid 10 min) and there is **no per-account attempt
counter / lockout**. Protection relies only on the IP-based `authLimiter` (30/15min), which is
weakened by IP rotation / distributed guessing. 6 digits = 1,000,000 combinations.

Also: `/set-password` validates the password with only `length >= 8` (line ~1181) — weaker than the
strong-password regex used everywhere else.

**Impact:** Brute-forcing the OTP lets an attacker set a password on any Google-OAuth account and take
it over.

**Fix:**
- Add an **attempt counter with lockout** per account/phone (e.g. 5 failures → block + require new OTP).
- Invalidate the OTP after N failed attempts.
- Use `validateStrongPassword()` in `/set-password` too.
- Consider longer OTP or short expiry with tighter limits.

---

## 🟠 #4 — Coupon Usage / Per-User Limit Race (MEDIUM)

**File:** `src/services/incentive.service.ts` → `validateAndPriceCoupon` (~line 204) +
`recordCouponRedemption` (~line 246)

**Problem:** Coupon limits are **checked at pricing time** (`usedCount >= usageLimit`,
`perUserLimit` via `countDocuments`), but the counter is incremented **later** in a separate step.
Between check and increment there is a TOCTOU window.

**Attack:** A user fires **many concurrent bookings** with the same coupon. All pass the limit check
before any increment lands → `usageLimit` / `perUserLimit` / `budgetLimit` are **exceeded**. Since
coupons are platform-absorbed discounts, this is a **financial abuse** vector.

**Fix:**
- Enforce `perUserLimit` with a **unique index** (e.g. on `{coupon, user, booking}` you already have
  per booking — add a per-user cap check that is atomic).
- Gate `usedCount`/`budgetLimit` with an atomic conditional `$inc`:
  ```ts
  const res = await CouponCampaign.updateOne(
    { _id: id, $expr: { $lt: ['$usedCount', '$usageLimit'] } },
    { $inc: { usedCount: 1, spentBudget: discount } }
  );
  if (res.modifiedCount === 0) throw new Error('coupon limit reached');
  ```

---

## 🟡 #5 — No Global NoSQL-Injection Sanitization (MEDIUM)

**File:** `src/app.ts` (no `express-mongo-sanitize`)

**Problem:** Several endpoints have **no express-validator** (`/verify-otp`,
`/customer/google/complete`, `/set-password`, Google flows), so object payloads can reach queries.
Today you are mostly protected **by accident**: Mongoose ObjectId casting, OTP hashing, and the
`identifier.includes('@')` call throwing on non-strings. This is fragile.

**Fix (defense in depth):**
```ts
import mongoSanitize from 'express-mongo-sanitize';
app.use(mongoSanitize());
```
And explicitly `String()`-cast any user value used as a query field value
(e.g. `User.findOne({ phone: String(phone) })`).

---

## 🟢 #6 — JWT Algorithm Not Pinned (LOW)

**File:** `src/utils/generateToken.ts` (~line 16, 33) and `src/socket/index.ts`

```ts
jwt.verify(token, env.JWT_SECRET)   // no algorithms option
```

**Fix:** Pin the algorithm to prevent algorithm-confusion classes:
```ts
jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
```

---

## 🟢 #7 — Access Token Lifetime 7 Days, Non-Revocable (LOW)

**File:** `src/utils/generateToken.ts` (`JWT_EXPIRE` default `7d`)

Only refresh tokens are DB-backed/revocable. A stolen access token stays valid up to **7 days** with
no way to revoke it.

**Fix:** Shorten access tokens to **15–30 minutes** and rely on refresh-token rotation. Optionally add
a token version / `tokenInvalidatedAt` check on sensitive actions.

---

## 🟢 #8 — Information Disclosure in Google Auth Error (LOW)

**File:** `src/controllers/auth.controller.ts` (~line 128)

The 401 response returns `allowedClientIds`, `tokenAud`, `tokenAzp` to the client — internal config
leakage.

**Fix:** Log these server-side only; return a generic error to the client.

---

## 🟢 #9 — Mass-Assignment Pattern (LOW, admin-gated)

**File:** `src/controllers/admin.controller.ts` (~line 1451, 1460)

```ts
const qa = await ChatbotQA.create(req.body);
const qa = await ChatbotQA.findByIdAndUpdate(req.params.id, req.body, { new: true });
```

Passing raw `req.body` into `create`/`findByIdAndUpdate` is a mass-assignment pattern. Low impact for
`ChatbotQA` today (admin-only, benign model), but adopt explicit field allow-listing as a habit so it
never becomes exploitable on a sensitive model.

**Fix:** Whitelist fields: `const { question, answer, category } = req.body;` then build the object.

---

## ⚠️ #10 — `.env` Secrets (ACTION REQUIRED)

`FixoServer/.env` holds real secrets (Razorpay keys, `JWT_SECRET`, DB URI, Twilio, Cloudinary,
Firebase). `.env` is in `.gitignore` (good), but:

- **Confirm it was never committed** to git history: `git log --all --full-history -- .env`.
- If it **ever** was committed, **rotate everything**: Razorpay key+secret+webhook secret,
  `JWT_SECRET` (invalidates all tokens — expected), MongoDB credentials, Twilio, Cloudinary, Firebase.
- Ensure `JWT_SECRET` is long & random (≥ 32 bytes). It is also used to salt OTP hashes, so a weak
  value weakens multiple defenses.

---

## ✅ What's Already Done Well

- **Payments:** charge amount is derived **server-side** from the accepted bid (`booking.amount`),
  not from the client → no price tampering. Razorpay payment **and** webhook signatures are verified.
- **Access control:** every route group applies `protect` + `authorize(role)`; admin routes use
  per-section `requirePermission(...)` and `requireSuperAdmin` for staff management. Solid RBAC.
- **Booking/order ownership** checks (`customer: req.user.id`) prevent classic IDOR on bookings.
- **Auth hygiene:** bcrypt cost 12, hashed & single-use password-reset tokens, refresh tokens stored &
  revocable, httpOnly/SameSite cookies.
- **Infra:** helmet, strict CORS allowlist, Redis-backed rate limiting (api/auth/mutation), request
  timeouts, body-size limits, `x-powered-by` disabled.
- **File upload:** memory storage, type + size limits, and images go to Cloudinary (not executed).
- **No SSRF:** map/geocode calls use **env-configured** trusted URLs, not user-supplied hosts.

---

## Recommended Fix Priority

1. **#1 Wallet balance race** — immediate (direct money loss).
2. **#2 Socket.IO auth** — immediate (bank-detail/PII leak + impersonation).
3. **#3 OTP lockout** and **#4 coupon race** — soon (account takeover / discount abuse).
4. **#5 mongo-sanitize**, **#6 JWT algorithms**, **#8 info leak** — quick one-line hardening.
5. **#7 token lifetime**, **#9 mass-assignment** — next cleanup pass.
6. **#10** — verify `.env` git history now; rotate if needed.

---

## Notes / Not Fully Reviewed

This review focused on the highest-risk surfaces (payments, auth, wallet/withdrawals, coupons/rewards,
socket layer, access control, uploads, SSRF, NoSQLi). The following were only spot-checked and deserve
the same atomic-money-flow and validation patterns applied above:
`admin.controller` refund/withdrawal-decline status guards, `customer.controller` profile update,
`staff.controller` create/update. Apply the same rules: **atomic status transitions for anything that
moves money or changes state**, and **explicit field allow-listing** on writes.
