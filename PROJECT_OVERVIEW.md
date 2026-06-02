# Expense Tracker — Complete Project Reference

A single source of truth for how this project is built and how every workflow
behaves. Derived from the actual code (services/models), not aspirational docs.

> **One-line summary:** a MERN group expense-sharing app built on a **pooled
> wallet** model — members contribute money into a shared group balance, and
> expenses are debited from that pool, so there is no circular "who owes whom"
> debt graph.

---

## 1. Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite, TypeScript, Tailwind CSS v4 |
| **State / data** | Redux Toolkit + **RTK Query** (caching, tag invalidation, auto-refetch) |
| **Backend** | Node.js, **Express 5**, TypeScript (strict) |
| **Database** | MongoDB Atlas + **Mongoose** (multi-doc writes use transactions/sessions) |
| **Auth** | JWT (access + refresh) in **HTTP-only cookies**, server-side session store |
| **Real-time** | Socket.IO (per-user rooms + per-group rooms) |
| **Payments** | Razorpay (orders + signature verify + webhook) |
| **Email** | Nodemailer / Resend (password-reset links) |
| **Validation** | Zod schemas per feature (`validators/`) |
| **Security** | helmet, express-rate-limit, custom NoSQL-operator sanitizer, CORS allow-list |
| **Logging** | pino (structured) |

---

## 2. High-Level Architecture

### Backend request flow (layered, service layer mandatory)
```
client → Express Router
       → Middleware  (verifyToken → loadGroup → ensureGroupActive → authorizeRole)
       → Controller  (parse req, format res — NO business logic)
       → Service     (all business logic, validation, balance maths, transactions)
       → Model       (Mongoose schema + DB queries)
       → MongoDB     (sessions/transactions for any multi-document write)
```
**Rule:** controllers never touch Mongoose models directly — everything goes
through a service.

### Frontend data flow
```
React page → RTK Query hook → baseQuery (sends cookies, auto-refresh on 401)
          → Backend API
          ← response normalized to { success, message, data }
          ← cache invalidated by tag types: Auth, Group, Expense, Category,
            User, Transaction, Event, Notification, Admin, AdminPromos
          ← 401 → silent /auth/refresh → replay → else redirect to /login
```

### Response envelope (every endpoint)
```jsonc
// success
{ "success": true,  "message": "…", "data": { … } }
// error
{ "success": false, "message": "…", "errors": [{ "field": "email", "message": "…" }] }
```
Thrown via `AppError(message, statusCode, errors?)`, formatted by a central
`error.middleware.ts`. Zod failures become `errors: [{ field, message }]`.

---

## 3. Folder Structure
```
frontend/src/
  redux/api/    RTK Query endpoint files per feature (auth, group, expense, …)
  redux/store.ts  single store (RTK Query reducer + small slices)
  page/         route-level pages
  components/    reusable UI; components/ui = design-system primitives
  hooks/         useApiError (RTK error → string), useFieldError, usePlan, socket
  interface/     TypeScript interfaces
  App.tsx        routes + ProtectedRouter + AdminRoute + ErrorBoundary + TopProgressBar

backend/
  config/        env.ts (validateEnv, typed env), constants.ts (plans, limits, rate limits)
  controllers/   request parse + response only
  db/            Mongo connection (exponential backoff, pool tuning)
  helpers/       Money.ts (cents), balanceOps.ts (wallet maths), AppError.ts, planLimits.ts
  middlewares/   auth.middleware, error.middleware, validate.middleware, security.middleware
  models/        Mongoose schemas
  routes/        Express routers per feature
  services/      business logic + transactions  ← the heart of the app
  sockets/       Socket.IO setup, rooms, typed events
  utils/         response helpers, asyncHandler, logger, email, razorpay, health
  validators/    Zod schemas per feature
```

---

## 4. Data Model (MongoDB collections)

| Collection | Purpose / key fields |
|---|---|
| **User** | `name, email(unique), password(bcrypt), role(USER\|APP_OWNER), status(ACTIVE\|SUSPENDED\|DELETED), plan, planExpiresAt, planCycle, planSource` |
| **Group** | `displayId(Grp-YY-NNN), name, groupType(POOL\|SPLIT), balance, totalContribution, status(ACTIVE\|INACTIVE\|CLOSED), planSnapshot, createdBy` |
| **GroupMember** | `groupId, userId, contribution, role(SUPER_ADMIN\|ADMIN\|MEMBER), settlement, settlementAmount, leaveRequestedAt, leftMode(SETTLED\|FORFEIT), isDeleted, isFavorite` |
| **Expense** | `groupId, category, title, description, amount, splitBetween[{userId,amount}], paidBy, paymentType, date, isDeleted` — **immutable** |
| **Category** | `groupId, name, color, isDeleted` |
| **GroupTransaction** | money **audit log**: `groupId, amount, action(CREDIT\|DEBIT\|REFUND), description, referenceId, referenceModel, performedBy, isDeleted` |
| **GroupEvent** | admin **activity log**: `groupId, performedBy, eventType(MEMBER_ADDED\|MEMBER_REMOVED\|MANAGE_CATEGORY\|CHANGE_ROLE\|CREATE_GROUP\|GROUP_CLOSED\|CREDIT_REMOVED), referenceId, amount, metadata` |
| **GroupInvite** | `groupId, invitedUser, invitedBy, status(PENDING\|ACCEPTED\|REJECTED), respondedAt` |
| **Notification** | `recipient, actor, group, type, metadata, read` — TTL 60 days |
| **Session** | `userId, refreshToken(bcrypt hash), deviceInfo, lastUsedAt, expiresAt(TTL)` |
| **PasswordReset** | `userId, tokenHash(SHA-256), expiresAt(TTL 30 min)` |
| **Counter** | sequence generator for `Group.displayId` |
| **PromoCode** | `code, plan, cycle, periodDays, maxRedemptions, redemptionCount, expiresAt, isActive` |
| **PromoRedemption** | `promoCodeId, userId, plan, periodDays` — unique `{promoCodeId,userId}` |
| **SubscriptionPayment** | `userId, plan, cycle, amount, periodDays, razorpayOrderId, razorpayPaymentId, status(created\|paid)` |

### Two account-level roles vs three per-group roles
- **Account role** (`User.role`): `USER` or `APP_OWNER` (the app admin/dashboard).
- **Per-group role** (`GroupMember.role`): `SUPER_ADMIN` (owner/creator) →
  `ADMIN` → `MEMBER`.

### Indexes / TTL (performance + housekeeping)
- `GroupMember {groupId,userId}` unique (partial: `isDeleted:false`), **`{userId,isDeleted}`** (hot per-user path).
- `Expense {groupId,isDeleted,date}`, `{groupId,category,isDeleted}`, `{paidBy,isDeleted}`.
- `GroupTransaction {groupId,isDeleted,createdAt}`, `{groupId,action,isDeleted}`.
- `User {createdAt}` (admin list), email unique, role/status indexed.
- TTL: `Session.expiresAt`, `PasswordReset.expiresAt`, `Notification.createdAt` (60 d).

---

## 5. Money Model (the core invariant)

- **All money is stored as integer cents** (paise). `toDBAmount(rupees)=×100`,
  `fromDBAmount(cents)=/100`. Schema getters/setters do this automatically —
  **never do float arithmetic on raw amounts**.
- **Single source of wallet maths:** `helpers/balanceOps.ts`. Services call these
  instead of hand-writing `$inc`/`$gte` (a double-conversion bug otherwise):
  | Helper | What it does |
  |---|---|
  | `creditGroupBalance` | `+balance` (and `+totalContribution`) |
  | `debitGroupBalance` | **atomic** `findOneAndUpdate({balance:{$gte:amt}}, -amt)` → `null` if insufficient |
  | `refundGroupBalance` | `+balance` only (totalContribution unchanged) |
  | `reverseGroupCredit` | atomic `-balance, -totalContribution` (never negative) |
  | `adjustMemberContribution` | signed `$inc` on a member's contribution |
- **Every balance mutation writes two records:** a `GroupTransaction` (money
  audit: CREDIT/DEBIT/REFUND) **and**, for admin-visible actions, a `GroupEvent`.
- **Atomic overspend guard:** the pool can never go negative — the `$gte` filter
  in `debitGroupBalance`/`reverseGroupCredit` is what prevents race conditions
  under concurrent expense/settlement writes.

---

## 6. Auth & Session Workflow

### Sign up → log in
1. **Signup** (`POST /auth/signup`): password hashed with bcrypt (10 rounds),
   user created (`role=USER, status=ACTIVE, plan=FREE`). Does **not** auto-login.
2. **Login** (`POST /auth/login`): verify password; reject `SUSPENDED` (403) and
   `DELETED` (401, generic). On success → `issueTokensForUser`:
   - signs a short-lived **access token** + a long-lived **refresh token** (JWT).
   - stores a **Session** row with the **bcrypt hash** of the refresh token + device info.
   - enforces **max 3 active sessions** per user (oldest evicted).
   - both tokens set as **HTTP-only cookies** (`secure`+`sameSite=none` in prod).

### Token refresh (rotation)
- `POST /auth/refresh`: verify refresh JWT → find the matching session by bcrypt
  comparing against stored hashes → confirm the account is still `ACTIVE` →
  **delete the old session and issue a brand-new pair** (rotation). Frontend
  `baseQuery` does this automatically on any 401 (single-flight), then replays
  the original request; if refresh fails → redirect to `/login`.

### Logout / change password / reset
- **Logout**: revoke (delete) the current session.
- **Change password** (`POST /auth/change-password`, authed): verify current pw →
  hash new → **delete ALL sessions** (logs out every device) → mint a fresh
  session for the current device.
- **Forgot password** (`POST /auth/forgot-password`): **anti-enumeration** —
  identical response whether or not the email exists. If it exists: store a
  SHA-256 hash of a 32-byte token (30-min TTL), email a reset link. Email send
  failure is logged, never surfaced.
- **Reset password** (`POST /auth/reset-password`): look up by token hash, check
  expiry, set new password, **single-use** (delete token) + **revoke all sessions**.

### Request authorization middleware (per request)
```
verifyToken      → validates access JWT, loads role+status, rejects non-ACTIVE
                   (clears cookies) → sets req.user
loadGroup        → loads the group + the caller's membership → sets req.group
ensureGroupActive→ blocks writes on CLOSED groups
authorizeRole(…) → checks per-group role (SUPER_ADMIN/ADMIN/MEMBER)
requireAppOwner  → gate for /api/admin/* (User.role === APP_OWNER, else 403)
```

---

## 7. Group Workflows

### 7.1 Create group  `POST /group/create`
Transaction:
1. Create `Group` (balance = creator's initial contribution; `displayId` from the
   `Counter` sequence via a `pre('save')` hook — never set manually).
2. Add creator as `GroupMember` with role **SUPER_ADMIN**.
3. Write `GroupEvent: CREATE_GROUP` + `GroupTransaction: CREDIT` (initial pool).
4. For each invitee → create a `PENDING` `GroupInvite`.
After commit → send `GROUP_INVITE` notifications. (Gated by the plan's `maxGroups`.)

### 7.2 Invite & join
- **Invite** `POST /group/invitemember` (SUPER_ADMIN/ADMIN): create PENDING invite
  + `GROUP_INVITE` notification (carries `inviteId` in metadata).
- **Accept** `POST /invite/accept` `{inviteId, contribution}`: validates the invite
  belongs to the user, not already a member, **within plan member cap**. Transaction:
  invite → ACCEPTED, create `GroupMember(role=MEMBER, contribution)`,
  `creditGroupBalance(+contribution)`, `GroupEvent: MEMBER_ADDED`,
  `GroupTransaction: CREDIT`. Notifies the inviter (`INVITE_ACCEPTED`).
- **Reject** `POST /invite/reject`: invite → REJECTED, notify inviter.

### 7.3 Manage member (direct)  `POST /group/managemember` (SA/ADMIN)
- `action: "add"` → add a user directly as a member (with contribution → credit).
- `action: "remove"` → soft-remove a member (`isDeleted:true`), `MEMBER_REMOVED`.

### 7.4 Manage admin (roles)  `POST /group/manageadmin` (SUPER_ADMIN only)
- `promote` MEMBER→ADMIN, `demote` ADMIN→MEMBER. Cannot touch the SUPER_ADMIN.
  Writes `GroupEvent: CHANGE_ROLE`.

### 7.5 Add contribution  `POST /group/addcontribution` (SA/ADMIN)
Top up the pool for a member. Transaction: `adjustMemberContribution(+x)` +
`creditGroupBalance(+x)` + `GroupTransaction: CREDIT`. (Can be attributed to
another member via `userId`.)

### 7.6 Settlement (direct)  `POST /group/settlement` (SA/ADMIN)
Mark a member settled and **pay them out** of the pool: set
`settlement:true, settlementAmount`, **atomic `debitGroupBalance(settlement)`**
(rejects if pool too low) + `GroupTransaction: DEBIT`.

### 7.7 Leave group  `POST /group/leave` (ADMIN/MEMBER)
The SUPER_ADMIN **cannot** leave (must transfer/close first). Two modes:
- **forfeit** → instant exit; contribution stays in the pool; member soft-deleted
  with `leftMode=FORFEIT`; `MEMBER_REMOVED` event. No money moves.
- **settlement** (default):
  - already-settled member → leaves instantly (`leftMode=SETTLED`).
  - otherwise → sets `leaveRequestedAt`, notifies all admins (`LEAVE_REQUESTED`).
- **Approve** `POST /group/leave/approve` (SA/ADMIN; an *admin's* request needs the
  SUPER_ADMIN): settle + soft-delete + atomic `debitGroupBalance` + `DEBIT` txn,
  notify `LEAVE_APPROVED`.
- **Reject** `POST /group/leave/reject`: clear the request, notify `LEAVE_REJECTED`.
- **Cancel own** `POST /group/leave/cancel`: requester clears their own request.

### 7.8 Clone group  `POST /group/:groupId/clone` (SUPER_ADMIN)
Plan-gated (`cloneGroup` feature). Reads the source's structure and creates a
brand-new group; never mutates the source (works on CLOSED groups too).

### 7.9 Close group  `GET /:groupId/close-preview` + `POST /:groupId/close` (SA)
The "wind down and refund" flow:
1. **Preview** computes a **proportional refund** per active member
   (`share = floor(memberContribution × balance / totalContribution)`; rounding
   remainder goes to the largest contributors so the sum is exact).
2. **Close** (transaction): optionally accept manual `overrides` (must sum to the
   exact balance ±0.01); if balance > 0 create a single **"Group closure refund"**
   expense splitting the whole balance to members; freeze the owner's plan tier
   into `Group.planSnapshot`; flip `status=CLOSED, balance=0`; write
   `GroupEvent: GROUP_CLOSED` with the full refund breakdown. CLOSED groups are
   frozen (read-only, immutable audit, never count toward plan limits).

### 7.10 Delete group  `DELETE /group/delete/:groupId` (SUPER_ADMIN)
Hard delete. A `pre('findOneAndDelete')` hook cascades: deletes the group's
Expenses, Categories, GroupMembers, and **soft-deletes** its GroupEvents &
GroupTransactions (audit kept).

### 7.11 Remove a credit  `DELETE /group/credit/:creditId` (SUPER_ADMIN)
A "credit" is a `CREDIT` GroupTransaction (the credits list *is* the txn log).
Transaction: **atomic `reverseGroupCredit`** (pulls money + contribution back out;
**refuses if the funds were already spent** — balance < credit), roll back the
contributor's running total (`includeLeft` so departed members are corrected),
soft-delete the credit txn, write `GroupEvent: CREDIT_REMOVED`.

### 7.12 Favorite  `POST /group/favorite` — toggles `GroupMember.isFavorite` (pins the card).

---

## 8. Payment / Money Workflows (where the balance moves)

| Action | Effect on pool | Records written |
|---|---|---|
| Create group / accept invite / add contribution | **+balance, +totalContribution** | `CREDIT` txn (+ event) |
| Create expense | **−balance** (atomic `$gte`) | `DEBIT` txn |
| Delete expense | **+balance** (refund) | `REFUND` txn |
| Settlement / leave-approve | **−balance** (atomic) | `DEBIT` txn |
| Remove credit | **−balance, −totalContribution** (atomic, can't overspend) | `CREDIT_REMOVED` event + soft-delete txn |
| Close group | balance → 0 via a single closure expense | `GROUP_CLOSED` event |

---

## 9. Expense Workflow

### Create  `POST /expense/create`
Transaction: pre-check `balance ≥ amount` → save `Expense` (optional
`splitBetween`) → **atomic `debitGroupBalance(amount)`** (the real guard; throws
if `null`) → `GroupTransaction: DEBIT`. **Expenses are immutable** — there is no
PATCH; to correct, **delete and recreate**.

### Delete  `DELETE /expense/delete/:id` (SA/ADMIN)
Transaction: soft-delete (`isDeleted:true`) → `refundGroupBalance(amount)` →
`GroupTransaction: REFUND` (with optional reason).

### Listing & reads
- `GET /expense/allexpenses/:groupId` — **paginated** (`page`,`limit`) with optional
  filters: `categoryId`, `paidBy`, `spender` (split member OR unsplit payer),
  `startDate`/`endDate`.
- `GET /expense/expensereport/:groupId` — today's expenses (populated).
- `GET /expense/getExpenseAddDetails/:groupId` — `{categories, payMethods, members}`.
- Payment types: **Cash, Card, UPI, Net Banking**.

---

## 10. Category Workflow  `/api/category`
- `POST /create` (SA/ADMIN) — gated by plan `maxCategoriesPerGroup`; `MANAGE_CATEGORY` event.
- `DELETE /delete/:id/:groupId` (SA/ADMIN) — **soft delete** (`isDeleted:true`).
- `GET /getCategoryDetails/:groupId` — live categories. An expense **requires** a
  category, so the UI gates "Add Expense" until at least one exists.

---

## 11. Reports  `/api/groupreport/:groupId/reports/*`
All built with MongoDB aggregation; amounts summed in **raw cents** (aggregation
skips Mongoose getters).
- **category-breakdown** — `$group` by category, totals + share %.
- **member-breakdown** — `by=spent` (default; `$unwind splitBetween`, who
  *consumed*) or `by=paid` (`$group` by `paidBy`, who *paid*).
- **spend-trend** — `$dateTrunc` buckets; granularity auto-picked by span
  (≤31 d → day, ≤182 d → week, else month).

**Date range** resolves to `this_month` / `last_month` / `all_time` / `custom`.
**Plan gate:** `this_month` & `last_month` are free; `all_time`/`custom` require
the `advancedReportRange` feature (Pro/Premium) → otherwise **402**
(`requireAdvancedReportRange` middleware).

---

## 12. Subscriptions / Billing

### Plans (single source of truth = `config/constants.ts`)
| Plan | Price (mo / yr) | maxGroups | members/group | categories/group | event/txn retention | advancedReports / clone |
|---|---|---|---|---|---|---|
| **FREE** | ₹0 | 3 | 5 | 10 | 15 d / 30 d | ✗ / ✗ |
| **PRO** | ₹69 / ₹660 | 8 | 10 | 20 | 60 d / 100 d | ✓ / ✓ |
| **PREMIUM** | ₹119 / ₹1140 | ∞ | ∞ | ∞ | ∞ | ✓ / ✓ |

### Effective plan (computed lazily, no cron) — `helpers/planLimits.ts`
- `active`: `now ≤ planExpiresAt` → stored tier, full access.
- `grace`: within **7 days** after expiry → stored tier, full access.
- `expired`: past grace → drops to **FREE** entitlements + read-only freeze.
- Group-scoped limits use the **group owner's** plan; a CLOSED group uses its
  frozen `planSnapshot`.

### Pay with Razorpay
1. `POST /subscription/order` → creates a Razorpay order + a `created`
   `SubscriptionPayment` row; returns `{orderId, amount, keyId}`. (Degrades to
   **503 "Payments not configured"** if Razorpay keys are unset.)
2. Browser completes payment → `POST /subscription/verify` → **HMAC signature
   verification** + order ownership check → grant.
3. `POST /subscription/webhook` (raw body, `payment.captured`) is the
   **server-to-server source of truth** even if the browser callback is lost.
4. **`grantFromPayment` is atomic + idempotent**: the `created → paid`
   `findOneAndUpdate` is the lock — only the first caller (browser **or** webhook)
   applies the entitlement; renewing the same tier while active **extends** from
   the current expiry, otherwise starts now. `planSource=PAYMENT` (only these
   count toward MRR).

### Promo codes  `POST /subscription/redeem`
Validates active/not-expired/under-cap → blocks downgrading an active higher
tier → transaction: insert `PromoRedemption` (**unique `{promoCodeId,userId}`** =
one per user) + **atomic guarded `$inc`** on `redemptionCount` (respects
`maxRedemptions` under concurrency) → grant plan (`planSource=PROMO`).

---

## 13. Admin Dashboard  `/api/admin/*` (APP_OWNER only)

### Users
- `GET /users` — paginated + **server-side filters** `search`, `status`, `plan`,
  `sort(newest|oldest)`.
- `GET /users/:id` — detail + the user's groups + last-action timestamps.
- `POST .../suspend` | `.../restore` — flip status; suspend/delete **revoke all
  sessions** and force-logout over the socket.
- `DELETE /users/:id` — **soft** delete (status=DELETED, reversible).
- `DELETE /users/:id/hard` — **permanent transfer-on-delete** (see §13.1).
- `POST /users/:id/plan` — manual plan override (`planSource=ADMIN`).

### 13.1 Hard delete (transfer-on-delete) — single transaction
For each group the user actively belongs to:
- **sole member** → cascade-delete the group;
- **owner (SUPER_ADMIN) with survivors** → promote the **earliest-joined ADMIN**
  (else earliest **MEMBER**) to SUPER_ADMIN (writes `CHANGE_ROLE`);
- remove the user's membership (contribution credits **survive** in
  `GroupTransaction`, rendered as "Deleted user"); expenses are **retained**.
Then purge account-scoped data (sessions, resets, redemptions, payments, invites,
notifications) and the user doc. Promoted members are notified **after** commit.

### Analytics  `GET /admin/analytics`
Scales to large user tables: MongoDB **buckets + counts** users by (stored plan,
cycle, source, status, entitlement window); Node does the tiny pricing math
reusing `getEffectivePlan`/`monthlyEquivalent` so **MRR** can't drift. Returns
totals, plan breakdown, MRR/ARR, suspended count, signups-over-time.

### Promos & health
`POST /promos`, `GET /promos`, `POST /promos/:id/deactivate`,
`GET /promos/:id/redemptions`; `GET /admin/health` (DB ping + recent logs).

---

## 14. Notifications & Real-time (Socket.IO)
- **In-app notifications**: `createNotification` writes a `Notification` and, if the
  recipient has a live socket, pushes `notification:new`. Types: `GROUP_INVITE,
  INVITE_ACCEPTED, INVITE_REJECTED, LEAVE_REQUESTED, LEAVE_APPROVED,
  LEAVE_REJECTED, ROLE_CHANGED, MEMBER_LEFT, GROUP_DELETED`. TTL 60 days.
- API: `GET /notifications` (paginated), `GET /unread-count`, `PATCH /read-all`,
  `PATCH /:id/read`, `DELETE /:id`.
- **Sockets**: per-user room (keyed by userId, for notifications + `FORCE_LOGOUT`)
  and per-group rooms (member/balance/role/expense events). The frontend connects
  on auth and a global `TopProgressBar` reflects any in-flight request.

---

## 15. Pagination
List endpoints take `page` & `limit` (Zod-validated, default 20, cap 200/100) and
return `{ items, total, page, limit }` via `sendPaginated`. Applied to: all
expenses, transactions, all credits, notifications, admin users. (Group members,
categories, and events still return all rows — a known small TODO.)

---

## 16. Security Techniques
- **JWT in HTTP-only cookies** (not localStorage) → XSS can't read tokens;
  `secure`+`sameSite=none` in production.
- **Refresh-token rotation** + server-side **session store** (bcrypt-hashed
  tokens, max 3 devices, instant revoke on suspend/delete/password-change).
- **Rate limiting**: `/auth/*` 15 req/15 min/IP; global 300 req/15 min/IP.
- **NoSQL-injection guard**: custom `sanitizeMongoOperators` strips `$`-prefixed
  and dotted keys from `req.body` (Express-5-safe; `req.query` is read-only).
- **helmet** security headers + **CORS allow-list** (enumerated methods/headers,
  credentials, 24 h preflight cache); `x-powered-by` disabled; `trust proxy` set.
- **Zod validation** on every body/param/query before the controller.
- **bcrypt** password hashing (10 rounds); **anti-enumeration** on password reset;
  **single-use** reset tokens (SHA-256 hashed, 30-min TTL).
- **Razorpay HMAC** signature verification on both the browser callback and webhook.

---

## 17. Techniques & Patterns (the "how it stays correct")
- **Layered architecture** — controllers thin, services own all logic.
- **MongoDB transactions** for every multi-document write (group create, expense,
  settlement, leave-approve, promo redeem, close, hard-delete).
- **Atomic conditional updates** (`findOneAndUpdate` with `$gte` filter) as the
  concurrency guard so the wallet can never overspend or go negative.
- **Money as integer cents** + centralized `balanceOps` to prevent
  double-conversion / float errors.
- **Dual logging** of money: `GroupTransaction` (financial audit) +
  `GroupEvent` (admin activity).
- **Soft deletes** for `GroupMember` & `Category` (always filter `isDeleted:false`).
- **Idempotency** (subscription grant keyed on order id) + **unique-index races**
  (promo per-user, member uniqueness) handled by catching `11000`.
- **Counter sequence** for human-readable `Group.displayId`.
- **TTL indexes** auto-expire sessions, reset tokens, old notifications.
- **Lazy plan evaluation** (effective tier computed on read, grace window, frozen
  snapshot on close) — no billing cron needed.
- **Aggregation-first reporting/analytics** — push grouping/counting to the DB,
  never load whole collections into Node.
- **Frontend**: RTK Query caching + tag invalidation, auto token-refresh on 401,
  centralized `useApiError`, `ErrorBoundary`, route-level fade + progress bar.

---

## 18. API Surface (quick reference)

| Group | Endpoints |
|---|---|
| **Auth** `/api/auth` (rate-limited) | `POST /signup`, `/login`, `/refresh`, `/logout`, `/forgot-password`, `/reset-password`, `/change-password` |
| **User** `/api/user` | `GET /me`, `DELETE /me`, `GET /usergroups`, `GET /search`, `POST /verifyuser` |
| **Group** `/api/group` | `POST /create`, `/:id/clone`, `DELETE /delete/:id`, `POST /managemember`, `/invitemember`, `/manageadmin`, `/addcontribution`, `/settlement`, `/leave`, `/leave/approve`, `/leave/reject`, `/leave/cancel`, `/favorite`, `GET /:id/close-preview`, `POST /:id/close`, `GET /getgroupbyid/:id`, `/getgroupmembers/:id`, `/leftcontributors/:id`, `/getbasictransaction/:id`, `/getTransaction/:id`, `/getEvent/:id`, `/allcredits/:id`, `DELETE /credit/:creditId` |
| **Category** `/api/category` | `POST /create`, `DELETE /delete/:id/:groupId`, `GET /getCategoryDetails/:groupId` |
| **Expense** `/api/expense` | `POST /create`, `DELETE /delete/:id`, `GET /getExpenseAddDetails/:id`, `/paymentMethods`, `/expensereport/:id`, `/allexpenses/:id` |
| **Reports** `/api/groupreport` | `GET /:id/reports/category-breakdown`, `/member-breakdown`, `/spend-trend` |
| **Invite** `/api/invite` | `POST /accept`, `/reject` |
| **Notifications** `/api/notifications` | `GET /`, `/unread-count`, `PATCH /read-all`, `/:id/read`, `DELETE /:id` |
| **Subscription** `/api/subscription` | `GET /plans`, `POST /order`, `/verify`, `/redeem`, `/webhook` |
| **Admin** `/api/admin` (APP_OWNER) | `GET /users`, `/users/:id`, `POST /users/:id/suspend`, `/restore`, `DELETE /users/:id`, `/users/:id/hard`, `POST /users/:id/plan`, `POST /promos`, `GET /promos`, `POST /promos/:id/deactivate`, `GET /promos/:id/redemptions`, `/analytics`, `/health` |
| **Health** | `GET /health` (flat JSON, before rate limiter) |

---

## 19. Environment & Running

**Backend `.env`** — required: `PORT, MONGO_URI, ACCESS_TOKEN_SECRET,
REFRESH_TOKEN_SECRET, FRONTEND_URL`; optional: `NODE_ENV,
ACCESS_TOKEN_EXPIRES_IN, REFRESH_TOKEN_EXPIRES_IN`, Razorpay & SMTP keys.
**Frontend `.env`** — `VITE_API_URL`. Validated on boot by `validateEnv()`.

```bash
# backend
npm run dev      # nodemon + ts-node (runs source, auto-reload)
npm run build    # tsc → dist/
npm start        # node dist/main.js  (PROD runs compiled dist — rebuild + restart after edits)

# frontend
npm run dev      # vite
npm run build    # vite build
npm run lint     # eslint
```
**Testing:** no automated suite yet; gates are `tsc`/`build` + ESLint + manual
API/browser testing. (See the TODO list in `CLAUDE.md`.)
```
