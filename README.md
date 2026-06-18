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

---

## Architecture Decision — Why a Pooled Wallet?

Most expense-sharing apps use a debt-splitting model (e.g. Splitwise), which requires resolving circular debts and maintaining per-pair balances. That introduces significant state complexity.

This system deliberately uses a **pooled wallet model**:

- Members contribute to a single shared group balance
- Expenses are deducted from that pool
- Individual contributions are tracked for transparency, not for settlement

The trade-off keeps financial logic deterministic and the data model auditable — a conscious choice, not a limitation.

---

## Money Integrity

Financial correctness is enforced at the data layer, not the UI:

- **Integer storage** — all amounts are stored as integer paise via the `helpers/Money` setter/getter (`toDBAmount` / `fromDBAmount`), so there is no floating-point drift on currency.
- **Append-only ledger** — every balance change is recorded in `group_transaction` as a `CREDIT`, `DEBIT`, or `REFUND` entry, with polymorphic references (`refPath`) back to the source document and soft-delete (`isDeleted`) instead of hard deletes.
- **Overspend guard** — expenses cannot exceed the available group balance; this is validated server-side before any write.
- **Atomic writes** — balance-affecting operations go through dedicated services so the balance, ledger, and audit event stay consistent.

---

## How It Works

1. A member contributes → group balance increases and a `CREDIT` ledger entry is created.
2. An admin adds an expense → balance decreases, an `Expense` is written, and a `DEBIT` ledger entry is logged with category and metadata.
3. The system enforces a hard constraint: expenses cannot exceed available balance.
4. All mutations are logged — there is no silent state change.

---

## Data Model

The schema is normalized across focused collections rather than embedded blobs:

**Identity & auth**
- `user` — account, hashed password, profile
- `session` — issued refresh-token sessions, used for the device/session cap
- `password_reset` — short-lived reset tokens

**Groups**
- `group` — group metadata, status, balance
- `group_member` — join collection (user ↔ group) carrying role and contribution total
- `group_invite` — pending invitations
- `group_event` — per-group audit/event stream

**Money**
- `group_transaction` — CREDIT / DEBIT / REFUND ledger (integer paise, soft-delete)
- `expense` — individual expense records
- `category` — per-group expense categories
- `counter` — atomic sequence source for human-readable display IDs

**Billing**
- `subscription_payment` — Razorpay order/payment records
- `promo_code` / `promo_redemption` — discount codes and their redemptions

**Notifications**
- `notification` — in-app notifications

---

## Role-Based Access Control

Permissions are enforced at the middleware level, not just the UI.

| Role | Capabilities |
|---|---|
| `MEMBER` | Add expenses, view group balance and transaction history |
| `ADMIN` | All member actions + manage categories, add contributions, delete expenses |
| `SUPER_ADMIN` | All admin actions + delete group, manage member roles |
| `APP_OWNER` | Application-level administration (see `admin.router`) |

Role checks are applied per route, so unauthorized actions are rejected at the API layer regardless of client-side state.

---

## Payments & Subscriptions

- **Razorpay** order creation and **HMAC signature verification** on callback.
- **Idempotent** payment recording — a replayed callback does not double-credit.
- **Plan limits** enforced on writes; closed groups and expired/over-limit plans are rejected by the backend.
- **Promo codes** with tracked redemptions.

---

## Realtime & Notifications

- **socket.io** server (`backend/sockets`) and `socket.io-client` on the frontend push live balance and activity updates to group members.
- In-app notifications via the `notification` collection and `notification.router`.

---

## MCP Server

A hosted MCP server (`arkalyn-mcp/`) lets a Claude.ai user operate on their **own** Arkalyn Kitty data through a personal API key. Every call is scoped to the key's owner.

**Read tools:** `get_my_balance`, `get_my_expenses`, `get_my_members`, `get_my_subscription`
**Write tools:** `add_expense`, `add_category`, `add_contribution`

Writes go through the same services as the web app, so balance updates, ledger entries, audit events, and plan limits stay identical. Transports: **Streamable HTTP** (`/mcp`, used by Claude.ai connectors) and legacy **HTTP+SSE**. Full details in [`arkalyn-mcp/README.md`](./arkalyn-mcp/README.md).

---

## Tech Stack

**Frontend**
- React 19 + TypeScript, built with Vite 8 (React Compiler enabled)
- Redux Toolkit + RTK Query for server state, caching, and optimistic updates
- Tailwind CSS 4, react-router 7, framer-motion
- i18next for internationalization, socket.io-client for realtime, html-to-image for shareable receipts

**Backend**
- Node.js (>=20) + Express 5 + TypeScript, layered architecture (routes → middleware → validators → services → models)
- Mongoose 9 for schema enforcement and queries
- Zod for request validation
- socket.io for realtime, Resend for transactional email, Razorpay for payments
- pino for structured logging

**Database**
- MongoDB (Atlas) — document model fits the group/member/transaction relationships

---

## Security

- JWT access tokens with rotating refresh tokens stored hashed; HttpOnly cookies
- Device/session cap enforced via the `session` collection
- `helmet`, `express-rate-limit`, and `express-mongo-sanitize` on the request pipeline
- Request-level validation (Zod) in addition to schema-level (Mongoose)
- Consistent error envelope: `{ success, message, data }`

---

## API Surface

RESTful routers under `backend/routes`:

`auth` · `user` · `group` · `invite` · `expense` · `category` · `subscription` · `notification` · `report` · `contact` · `admin` · `mcp`

All protected routes require a valid JWT verified via middleware.

## Design Philosophy

The goal was not the most feature-rich expense app — it was one with **defensible decisions at every layer**. Financial data requires consistency above all else; every constraint exists because its absence would create ambiguous state.

> Simple → Maintainable → Scalable
