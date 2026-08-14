# Arkalyn Kitty — Group Pooled-Wallet Expense Manager

A production-oriented, group-based expense manager built as a TypeScript MERN monorepo. The system prioritizes **financial integrity, role-based access, and a verifiable audit trail** over feature count. It ships with realtime updates, Razorpay-backed subscriptions, and a hosted **MCP server** that lets a Claude.ai user read and write their own data through a personal API key.

**Live**
- Frontend (Vercel): [arkalynkitty-fin.vercel.app](https://arkalynkitty-fin.vercel.app/)
- Backend (Render): [arkalyn-kitty-v8e5.onrender.com](https://arkalyn-kitty-v8e5.onrender.com) — health probe at `/health`
- MCP server: [arkalyn-kitty-mcp.onrender.com](https://arkalyn-kitty-mcp.onrender.com/mcp)

---

## Repository Structure

This is a monorepo with three independently deployable packages:

| Package | Description |
|---|---|
| `backend/` | Express 5 + TypeScript REST API, Mongoose 9, socket.io, Razorpay, JWT auth |
| `frontend/` | React 19 + TypeScript SPA (Vite 8, Redux Toolkit + RTK Query, Tailwind 4) |
| `arkalyn-mcp/` | Standalone MCP server exposing the user's data to Claude.ai — see [`arkalyn-mcp/README.md`](./arkalyn-mcp/README.md) |

The backend is a flat layered tree (no `src/`): `routes → validators → middlewares → controllers → services → models`.

---

## Architecture Decision — Why a Pooled Wallet?

Most expense-sharing apps use a debt-splitting model (e.g. Splitwise), which requires resolving circular debts and maintaining per-pair balances. That introduces significant state complexity.

This system deliberately uses a **pooled wallet model**:

- Members contribute to a single shared group balance
- Expenses are deducted from that pool
- Individual contributions are tracked for transparency, and settled as a lump sum on exit — not as a running per-pair debt graph

The trade-off keeps financial logic deterministic and the data model auditable — a conscious choice, not a limitation.

---

## Money Integrity

Financial correctness is enforced at the data layer, not the UI:

- **Scaled storage** — every money field carries a Mongoose `set: toDBAmount` / `get: fromDBAmount` pair (`helpers/Money`), so amounts are persisted ×100 (paise) and read back in rupees. Application code always speaks rupees; the schema boundary is the only place the conversion happens.
- **One place for balance mutations** — `helpers/balanceOps` owns every `$inc` against a balance. Two rules that are easy to get wrong live there and nowhere else: update operators receive **raw rupees** (Mongoose re-runs the setter), while query filters receive `toDBAmount(x)` (filters do *not* run setters). Services never hand-write balance arithmetic.
- **Append-only ledger** — every balance change is recorded in `group_transaction` as a `CREDIT`, `DEBIT`, or `REFUND` entry, with polymorphic references (`refPath`) back to the source document and soft-delete (`isDeleted`) instead of hard deletes.
- **Atomic overspend guard** — debits run as a single conditional `findOneAndUpdate({ _id, balance: { $gte: amount } })`. If the balance is insufficient the update matches nothing and the caller throws — the check and the write cannot interleave.
- **Multi-document transactions** — expense create/edit/delete, settlement, and group close all run inside a `mongoose` session so the balance, ledger entry, and audit event commit or abort together.

---

## How It Works

1. A member contributes → group balance increases and a `CREDIT` ledger entry is created.
2. An admin adds an expense → balance decreases, an `Expense` is written, and a `DEBIT` ledger entry is logged with category and metadata.
3. Editing an expense adjusts the pool by the **delta only**, then writes a field-level before→after diff to the event log.
4. Deleting an expense soft-deletes it and refunds the pool with a `REFUND` entry.
5. The system enforces a hard constraint: expenses cannot exceed available balance.
6. All mutations are logged — there is no silent state change.

---

## Data Model

The schema is normalized across focused collections rather than embedded blobs:

**Identity & auth**
- `user` — account, hashed password, profile, plan, app role, lifecycle status
- `session` — issued refresh-token sessions, used for the device/session cap
- `password_reset` — short-lived reset tokens

**Groups**
- `group` — group metadata, purpose, status, balance, plan snapshot
- `group_member` — join collection (user ↔ group) carrying role, contribution total, and settlement state
- `group_invite` — invitations with a two-step lifecycle (invitee responds, then an admin approves)
- `group_event` — per-group audit/event stream

**Money**
- `group_transaction` — CREDIT / DEBIT / REFUND ledger (scaled amounts, soft-delete)
- `expense` — individual expense records with optional per-member split attribution
- `category` — per-group categories, in two flavours (`EXPENSE` and `CREDIT`)
- `counter` — atomic sequence source for human-readable display IDs (`Grp-25-001`)

**Billing**
- `subscription_payment` — Razorpay order/payment records
- `promo_code` / `promo_redemption` — discount codes and their redemptions

**Notifications**
- `notification` — in-app notifications, auto-expiring after 60 days via a TTL index

---

## Groups & Membership Lifecycle

- **Invite → accept → approve.** An invite targets an existing account. The invitee accepts and declares a contribution, which is held on the invite row until an admin approves — only then does it credit the group balance. `REJECTED` (invitee said no) and `DECLINED` (admin said no) are kept distinct so the audit trail records who refused.
- **Leaving.** A member either files a leave request for admin approval (settlement path) or exits instantly via **forfeit**, leaving their contribution in the pool. `leftMode` records which happened.
- **Settlement.** An admin settles a member for an amount up to the available balance; the payout debits the pool and writes a ledger entry. Members cannot be removed unsettled.
- **Close & clone.** A group can be previewed and then closed, freezing the owner's plan tier into `planSnapshot` so later plan changes never rewrite history. Closed groups reject all further writes (`ensureGroupActive`) and stop consuming the owner's group limit. Paid tiers can clone a group's structure into a fresh one.

---

## Categories & Spend Limits

Categories share one collection but serve two purposes:

- **`EXPENSE`** — what money was spent on.
- **`CREDIT`** — which bucket a contribution landed in, so an expense can optionally record which pool it was drawn from.

Two modifiers refine reporting:

- **`isSpecial`** — collective costs (e.g. a shared EMI) are excluded from the per-member breakdown and surfaced as their own bucket.
- **`limitCents`** — an optional lifetime spend cap for the category. It is **advisory**: crossing it warns, it never blocks a write.

Categories cannot be deleted while any expense or credit still references them.

---

## Role-Based Access Control

Permissions are enforced at the middleware level, not just the UI. `loadGroup` resolves the group (by ObjectId or `displayId`), then `authorizeRole` checks the caller's membership row.

| Role | Capabilities |
|---|---|
| `MEMBER` | Add expenses, edit their own expenses, view balance/reports/history, request to leave |
| `ADMIN` | All member actions + manage categories, invite and manage members, add contributions, settle members, edit or delete any expense |
| `SUPER_ADMIN` | All admin actions + manage admin roles, close/clone/delete the group |
| `APP_OWNER` | Application-level administration across all accounts (see `admin.router`) |

Expense editing is authorized inside the service rather than by route middleware, because the rule is *admin **or** the original payer* — which the role middleware alone cannot express.

---

## Payments & Subscriptions

Three tiers, priced in INR. `null` means unlimited.

| | Free | Pro | Premium |
|---|---|---|---|
| Price (monthly / yearly) | ₹0 | ₹69 / ₹660 | ₹119 / ₹1140 |
| Groups owned | 3 | 8 | Unlimited |
| Members per group | 5 | 10 | Unlimited |
| Categories per group | 10 | 20 | Unlimited |
| Event log retention | 15 days | 60 days | Unlimited |
| Transaction log retention | 30 days | 100 days | Unlimited |
| Custom report date ranges | — | ✓ | ✓ |
| Clone group | — | ✓ | ✓ |

- **Razorpay** order creation and **HMAC signature verification** on callback.
- **Idempotent** payment recording — a replayed callback does not double-credit.
- **Lazy expiry** — entitlement is computed on read from `plan` + `planExpiresAt`, so no cron job is needed. After expiry a **7-day grace period** preserves full access; past that the account falls back to `FREE` and over-limit resources go read-only.
- **Group-scoped limits follow the group owner's plan**, since subscriptions are per-account.
- **Promo codes** with tracked redemptions, guarded against downgrading an active higher tier.

The named report presets — `this_month`, `last_month`, and `all_time` — are free on every tier; only hand-picked custom date ranges are gated. Closed groups are exempt regardless of tier, since the month presets are meaningless on frozen history.

---

## Reports

Three group-scoped report endpoints under `/api/groupreport`, all available to any member:

- **Category breakdown** — spend per category, with special categories bucketed separately.
- **Member breakdown** — attribution per member: expenses they shared in, plus unsplit expenses they paid for.
- **Spend trend** — spend over time.

Report cards deep-link into a pre-filtered expense list, and the list's server-side filters (category, payer, spender, date range) mirror the report's attribution so the drill-through always reconciles with the chart.

---

## Realtime & Notifications

- **socket.io** server (`backend/sockets`) and `socket.io-client` on the frontend push live updates for expenses, categories, balance, membership, roles, contributions, settlements, leave requests, and activity events.
- **In-app notifications** cover the membership lifecycle — invites, join approvals, leave requests, role changes, departures, and group deletion — delivered over the socket and persisted with read state.
- **Transactional email** via Resend for password reset and the public contact form. Optional: without an API key the app still boots and email degrades to a logged warning.

---

## MCP Server

A hosted MCP server (`arkalyn-mcp/`) lets a Claude.ai user operate on their **own** Arkalyn Kitty data through a personal API key generated from their profile. Every call is scoped to the key's owner.

**Read tools:** `get_my_balance`, `get_my_expenses`, `get_group_details`, `get_group_activity`, `get_my_members`, `get_my_subscription`
**Write tools:** `add_expense`, `add_category`, `add_contribution`

Writes go through the same services as the web app, so balance updates, ledger entries, audit events, and plan limits stay identical. Transports: **Streamable HTTP** (`/mcp`, used by Claude.ai connectors) and legacy **HTTP+SSE**. Full details in [`arkalyn-mcp/README.md`](./arkalyn-mcp/README.md).

---

## Tech Stack

**Frontend**
- React 19 + TypeScript, built with Vite 8 (React Compiler enabled)
- Redux Toolkit + RTK Query for server state, caching, and optimistic updates
- Tailwind CSS 4, react-router 7, framer-motion
- i18next (English + Tamil) for internationalization, socket.io-client for realtime, html-to-image for shareable receipt cards

**Backend**
- Node.js (>=20) + Express 5 + TypeScript, layered architecture (routes → middleware → validators → services → models)
- Mongoose 9 for schema enforcement and queries
- Zod for request validation
- socket.io for realtime, Resend for transactional email, Razorpay for payments
- pino for structured logging

**Database**
- MongoDB (Atlas) — document model fits the group/member/transaction relationships. Replica set required: the money paths use multi-document transactions.

---

## Security

- JWT access tokens with rotating refresh tokens stored hashed; HttpOnly cookies
- Google OAuth with a single-use, HttpOnly `state` nonce; the token endpoints are pinned constants so a bad env value can't swap in a hostile issuer
- Account status enforced on **every** request — suspending an account invalidates its already-issued JWT on next use
- Device/session cap (3 active sessions) enforced via the `session` collection
- `helmet` and tiered `express-rate-limit` (global, auth, contact form) on the request pipeline
- A hand-rolled `sanitizeMongoOperators` middleware strips `$`-prefixed and dotted keys from request bodies to block operator injection
- Request-level validation (Zod) in addition to schema-level (Mongoose)
- Consistent error envelope: `{ success, message, data }`

---

## API Surface

RESTful routers mounted under `/api`:

| Mount | Router |
|---|---|
| `/api/auth` | signup, login, refresh, logout, Google OAuth, password reset/change |
| `/api/user` | profile, account deletion, user search, API key generation/revocation |
| `/api/group` | create, close, clone, members, roles, contributions, settlement, leave flow, transactions, events, credits |
| `/api/invite` | send, accept, reject, approve, decline, pending queue |
| `/api/expense` | create, edit, delete, list with filters, duplicate detection, payment methods |
| `/api/category` | create, update, delete, list (expense + credit) |
| `/api/groupreport` | category breakdown, member breakdown, spend trend |
| `/api/subscription` | plans, orders, payment verification, transactions, promo redemption |
| `/api/notifications` | list, unread count, mark read, delete |
| `/api/contact` | public contact form (rate-limited) |
| `/api/admin` | app-owner dashboard (gated by `requireAppOwner`) |
| `/api/mcp` | API-key-authenticated surface for the MCP server |

All protected routes require a valid JWT verified via middleware. `/health` is unauthenticated and rate-limit exempt.

---

## Local Development

**Prerequisites:** Node >= 20, a MongoDB replica set (Atlas or a local `rs` — transactions require one).

```bash
# Backend
cd backend
npm install
npm run dev          # nodemon + ts-node on PORT

# Frontend
cd frontend
npm install
npm run dev          # vite --host

# MCP server
cd arkalyn-mcp
npm install
npm run dev          # tsx watch
```

**Required backend env** (`backend/.env`) — the server refuses to boot without these:

```
PORT
MONGO_URI
ACCESS_TOKEN_SECRET
REFRESH_TOKEN_SECRET
FRONTEND_URL                 # no trailing slash — breaks CORS
FRONTEND_DASHBOARD_URL
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI
```

**Optional** — each degrades gracefully rather than blocking boot:

```
RESEND_API_KEY, RESEND_FROM, CONTACT_EMAIL        # email → logged warning
RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET,             # billing → clean 503
RAZORPAY_WEBHOOK_SECRET
ACCESS_TOKEN_EXPIRES_IN (15m), REFRESH_TOKEN_EXPIRES_IN (7d)
```

---

## Known Gaps

Stated plainly, so the scope is honest:

- **No automated test suite.** The money paths are the obvious place to start.
- **No receipt attachments or OCR.**
- **No recurring expenses.**
- **Single currency (INR).** Not a travel/multi-currency product.
- **No offline support or native mobile apps** — responsive web only.
- **UPI is a payment-type label, not an integrated payment rail.** Razorpay handles subscription billing; it does not move money between members.
- **No data import/export** beyond shareable PNG cards.
- **Splitting supports equal and exact amounts only** — no percentage, shares, or multiple payers.
- **Expense text search is client-side** over the loaded page; the server-side filters are the ones that scale.
- **`groupType: "SPLIT"`** exists in the schema but is unimplemented — `POOL` is the only live mode.

---

## Design Philosophy

The goal was not the most feature-rich expense app — it was one with **defensible decisions at every layer**. Financial data requires consistency above all else; every constraint exists because its absence would create ambiguous state.

> Simple → Maintainable → Scalable
