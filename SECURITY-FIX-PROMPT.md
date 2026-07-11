# Security Fix Prompt — hand this to a Claude Code agent

Copy everything below the line and paste it as your prompt to a Claude Code / AI agent
running inside the `FixoServer` project.

---

You are a senior application-security engineer working on the **FIXO backend**
(Node.js + TypeScript + Express + MongoDB/Mongoose, Razorpay payments).

## Your task
Read the file `SECURITY-AUDIT-REPORT.md` in this repository. It lists 10 security findings
ranked by severity. Fix all of them to a professional, production standard, in the priority
order given in that report.

## How to work
1. **First, read `SECURITY-AUDIT-REPORT.md` fully**, then read each affected file before editing it.
2. Fix findings in this order: #1 (wallet race) → #2 (socket auth) → #3 (OTP lockout) →
   #4 (coupon race) → #5 (mongo-sanitize) → #6 (JWT algorithms) → #7 (token lifetime) →
   #8 (info leak) → #9 (mass-assignment) → #10 (verify `.env` git history, do NOT print secrets).
3. Before finishing, also review the files the report flagged as "Not Fully Reviewed"
   (`admin.controller` refund + withdrawal-decline status guards, `customer.controller`
   profile update, `staff.controller` create/update) and apply the same patterns there:
   **atomic status transitions for anything that moves money or changes state**, and
   **explicit field allow-listing** on every write.

## Engineering rules (important — keep it professional but lean)
- **Match the existing code style** exactly (naming, error handling, response shapes). Do not
  reformat or refactor unrelated code.
- For money/balance/counters: use **atomic MongoDB operations** (`findOneAndUpdate` with a
  precondition + `$inc`). Where a balance change and a ledger `Transaction.create` must both
  succeed or both fail, wrap them in a **MongoDB transaction** (`session.withTransaction`).
- **Do not add heavy dependencies or over-engineer.** Prefer built-ins and the packages already
  in `package.json`. Only add a well-known, minimal package if strictly necessary
  (e.g. `express-mongo-sanitize`), and explain why.
- Keep changes **minimal and targeted** — fix the vulnerability, don't rewrite the feature.
- Preserve all existing functionality and API contracts. Do not break the app.
- Never log or expose secrets. For #10, only run read-only git-history checks and report the
  result; do not print secret values.

## Verification (must do before you report done)
- Run the type checker / build (`npm run build` or `tsc --noEmit`) and fix any errors you introduce.
- Run the existing test suite (`npm test` / vitest) and keep it green. Add focused tests for the
  two race conditions (#1 wallet, #4 coupon) and the socket-auth fix (#2) proving the vulnerability
  is closed (e.g. concurrent requests can't over-withdraw).
- Do a self-review: confirm each of the 10 findings is actually fixed, not just partially.

## Deliverable
When done, produce a short summary:
- A checklist of the 10 findings with ✅ fixed / ⚠️ needs-decision and the file(s) changed for each.
- Any finding you could NOT safely auto-fix and why (e.g. needs an env/infra change or a product
  decision), with a clear recommended action for me.
- The list of new tests added and confirmation the build + tests pass.

Do not deploy, do not push, do not change infrastructure. Only edit code in this repo and report back.
