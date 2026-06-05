# Building a Group Expense Tracker (MERN + Razorpay) — Content & Blog Kit

> A single source you can pull from for a **YouTube deep-dive** (explain the app + the
> engineering concepts) and a **LinkedIn post** (job search). Sections are self-contained —
> copy what you need.

---

## 0. The 20-second pitch

**Arkalyn Kitty** is a group expense-sharing app built on a **pooled-wallet model**: instead of
tracking "who owes whom" (the messy circular debt every other split app has), members **contribute
money into a shared pool**, and every expense is **debited from that pool**. No IOUs, no settle-up
math — just a transparent shared balance with a full audit trail, per-group roles, categories, and
plan-based subscriptions paid via Razorpay.

**Stack:** React 19 + Vite + TypeScript + Tailwind · Node + Express 5 + TypeScript · MongoDB
(Atlas) + Mongoose · Redux Toolkit + RTK Query · Socket.io · Razorpay · JWT (httpOnly cookies).

---

## 1. Why this project is interesting (the hook)

Most "expense splitter" tutorials stop at CRUD. This app goes after the **hard parts that real
money apps must get right**:

- **Money is never a float** — every amount is stored as integer paise/cents.
- **Every balance change is atomic and auditable** — multi-document writes run inside MongoDB
  transactions, and each one writes both a financial record *and* an admin event.
- **Payments are idempotent and race-safe** — browser callback and server webhook can fire at the
  same time; the user is granted access exactly once.
- **Entitlements are computed, not stored** — a plan "expires" lazily without any cron job.

That's the story: *I took a CRUD idea and engineered it like a fintech product.*

---

## 2. Architecture (one diagram, explain it on camera)

```
React page → RTK Query hook → base query (sends httpOnly cookie)
   → Express Router
   → Middleware:  verifyToken → loadGroup → authorizeRole / ensureGroupActive
   → Controller   (parse request, format response — no business logic)
   → Service      (ALL business logic + validation + transactions)
   → Model        (Mongoose schema + queries)
   → MongoDB      (sessions for multi-document writes)
```

**The one rule that keeps it clean:** controllers may *never* touch the database directly. Every
write goes through a **service layer**, which is the only place transactions, balance math, and
audit logging live. This is the single most interview-worthy habit in the codebase — talk about
*separation of concerns* and *why a service layer exists*.

**Frontend mirror:**
```
Page → RTK Query hook → cache (tag-based) → API
     ← auto cache-invalidation by tag (Auth, Group, Expense, Category, Subscription…)
     ← auto token refresh + redirect to /login on 401
```

---

## 3. The engineering concepts to teach (your YouTube "knowledge" segment)

Each of these is a 2–4 minute explainer with a concrete example from the code.

### 3.1 Money as integers (never floats)
`0.1 + 0.2 !== 0.3` in floating point. Storing rupees as **paise** (`amount * 100`, integer) makes
arithmetic exact. Helpers `toDBAmount()` / `fromDBAmount()` convert at the DB boundary; Mongoose
getters/setters apply them automatically. **Lesson:** money + floats = rounding bugs that lose real
cash.

### 3.2 Database transactions & atomicity
A single expense touches three documents: the `Expense`, the group `balance`, and a
`GroupTransaction` audit row. If any step fails, *none* should persist. We wrap them in a Mongoose
**session/transaction** (`session.startTransaction()` → `commitTransaction()` / `abortTransaction()`).
**Lesson:** ACID isn't just SQL — MongoDB has multi-document transactions and you need them the
moment one user action writes to more than one collection.

### 3.3 Atomic guards & concurrency (the money-safety trick)
To debit the pool we don't "read balance, check, then write" (a classic race). We do it in **one
atomic operation**:
```js
Group.findOneAndUpdate(
  { _id: groupId, balance: { $gte: amount } },   // condition + write are atomic
  { $inc: { balance: -amount } }
)  // returns null if the balance was insufficient → caller throws
```
The database guarantees no two concurrent expenses can overspend. **Lesson:** put the invariant in
the query filter, not in application code.

### 3.4 Idempotency & race conditions in payments
After a Razorpay payment, **two** things race to grant access: the browser's success callback and
Razorpay's server webhook. We make the grant idempotent with an atomic state transition keyed on
the order id:
```js
SubscriptionPayment.findOneAndUpdate(
  { razorpayOrderId, status: { $in: ['created', 'failed'] } },
  { status: 'paid', razorpayPaymentId }
)  // only the FIRST caller flips the row and grants; later callers no-op
```
**Lesson:** in payments, "exactly once" is a design problem, not a hope. Idempotency keys + atomic
transitions solve it.

### 3.5 Payment security: HMAC signatures + webhooks
Never trust the browser that a payment succeeded. We verify Razorpay's **HMAC-SHA256 signature**
on both the browser callback (`order_id|payment_id`) and the webhook (raw body), using a
constant-time comparison. The webhook is the **server-to-server source of truth** even if the
browser closes. **Lesson:** signatures prove authenticity; webhooks guarantee delivery.

### 3.6 JWT auth done properly
Tokens live in **httpOnly cookies** (not localStorage → immune to XSS token theft). A short-lived
access token + a refresh token; on a 401 the frontend runs a **single-flight refresh** (concurrent
401s all await one `/auth/refresh` call so the rotating token is consumed once), then replays the
request. **Lesson:** where you store a token and how you refresh it is a security decision.

### 3.7 Audit trails (event-sourcing-lite)
Every balance mutation writes to **two** logs: `GroupTransaction` (the financial ledger) and
`GroupEvent` (the human-readable activity feed). Records are immutable; corrections are new entries.
This is how real systems stay auditable. **Lesson:** append-only history > editing rows in place.

### 3.8 MongoDB aggregation pipelines (and *where* you compute)
Reports (who-paid / who-spent, category breakdown, spend trend, admin MRR) are computed with
`$match → $group → $facet → $unwind` **inside MongoDB**, not by loading rows into Node. The "who
spent" report even uses `$facet` to attribute split expenses per-share *and* unsplit expenses to
the payer in one pass. **Lesson:** push aggregation to the database; it scales, Node memory doesn't.

### 3.9 Caching & cache invalidation (RTK Query)
The frontend never manually refetches. Queries **provide tags**, mutations **invalidate tags**, and
the cache refetches exactly what changed. Editing an expense invalidates `Expense` + `Group` (balance
moved) so the list and the balance update together. **Lesson:** "There are only two hard things in CS"
— this is the cache-invalidation one, solved declaratively.

### 3.10 Lazy entitlement evaluation (no cron)
A plan doesn't need a nightly job to expire. `getEffectivePlan()` computes the live tier *on read*
from `planExpiresAt` + a 7-day grace window. Expired users silently fall back to FREE with a
read-only freeze on over-limit data. **Lesson:** derive state when you read it instead of scheduling
jobs to mutate it.

### 3.11 Real-time with Socket.io rooms
Group members join a **room per group**; expense/category/member events fan out to just that room.
Typed events keep client and server in sync. **Lesson:** rooms = targeted broadcasts without tracking
socket ids by hand.

---

## 4. Feature deep-dive (your YouTube walkthrough, in order)

For each feature: **what the user sees → what happens under the hood → the concept it teaches.**

### Feature 1 — Pooled wallet & creating a group
- **User:** create a group, pick a **purpose** (Family / Friends / Roommates / Team), set your
  contribution, invite members.
- **Under the hood:** one transaction creates the `Group`, the creator as `SUPER_ADMIN`, the initial
  `CREDIT` transaction, and **seeds a starter set of categories** for the chosen purpose. Invitees get
  pending invites; their contribution is collected when they accept.
- **Teaches:** transactions, role seeding, sensible defaults to beat the empty-state problem.

### Feature 2 — Adding an expense (the money path)
- **User:** title, amount, category, who paid, optional split between members.
- **Under the hood:** atomic `$gte` balance debit (can't overspend), writes the `Expense` +
  `GroupTransaction`, emits a socket event. Split amounts must sum to the total (validated in the
  model).
- **Teaches:** the atomic guard (3.3), integer money (3.1), audit logging (3.7).

### Feature 3 — Editing an expense + an edit log (a design tradeoff story)
- **The interesting bit:** expenses were originally **immutable** ("delete & recreate"). The product
  needed real editing. Rather than abandon auditability, edits are **in-place but fully logged**: the
  pool balance is adjusted by the *delta* atomically, and an `EXPENSE_EDITED` event records a
  **field-level before→after diff**.
- **Teaches:** how to *safely reverse an architectural invariant* — mutability is fine when every
  change leaves a trace. Great "I weighed a tradeoff" interview story.

### Feature 4 — Categories: colour editing, deep-linking, and "collective" categories
- **User:** edit a category's colour inline; click a category to jump to its filtered expense list;
  flag a category as **collective**.
- **The interesting bit:** a *collective* category (e.g. a family **house-loan EMI**) is **excluded
  from the per-member "who paid / who spent" breakdown** and shown as its own bucket — because nobody
  individually "owes" the EMI; it's a shared obligation. Implemented by adding
  `category: { $nin: specialIds }` to the aggregation and a second pipeline for the bucket, while
  keeping the report drill-down filter in sync.
- **Teaches:** modelling real-world nuance in aggregation pipelines (3.8); keeping a chart and its
  drill-down reconciled.

### Feature 5 — Subscriptions & payments (Razorpay)
- **User:** pick Pro/Premium, pay, get instant access; see a **transaction history** on the profile.
- **The interesting bits:**
  - **No downgrade while active:** you can't buy a *lower* tier while your higher plan is live
    (PREMIUM→PRO blocked; PRO→PREMIUM and renewals allowed) — enforced server-side with a tier-rank
    check *before* creating the order.
  - **Event-driven outcome:** each checkout is one record that moves `created → paid` (success) or
    `created → failed` (Razorpay `payment.failed` or the user dismissing the popup). The profile
    "Subscription transactions" list shows **Pending / Success / Failed** live.
  - **Race-proofing:** if the browser marks an attempt failed but Razorpay actually captured it, the
    webhook still grants it (the grant lock accepts `failed` rows too).
- **Teaches:** idempotency (3.4), HMAC + webhooks (3.5), modelling payment state machines, lazy
  entitlements (3.10).

### Feature 6 — Admin dashboard & analytics
- **User (app owner only):** revenue (MRR), user management, plan overrides, system health.
- **Under the hood:** MRR and user buckets are computed with MongoDB `$group` — never by loading all
  users into Node. Hard-deleting a user transfers group ownership in one transaction.
- **Teaches:** analytics that scale; RBAC (`requireAppOwner`); careful cascading deletes.

---

## 5. Hard problems I solved (the strongest talking points)

Use these as your "what was challenging" answers — each is a real, specific decision.

1. **Exactly-once payment grants** under a browser-callback ↔ webhook race → atomic state transition
   on an idempotency key.
2. **No-overspend concurrency** → moved the balance check *into* the update's filter (`$gte`), so the
   database enforces it.
3. **Auditable mutability** → reversed an "immutable expense" rule without losing the audit trail by
   logging a before→after diff on every edit.
4. **Collective costs in a per-member report** → excluded special categories from member attribution
   with `$facet`/`$nin`, surfaced them as a separate bucket, and kept the drill-down consistent.
5. **Plan expiry without cron** → lazy effective-plan computation with a grace window and read-only
   freeze.
6. **Token refresh stampede** → single-flight refresh so concurrent 401s consume the rotating token
   once.

---

## 6. What this project demonstrates (skills for recruiters)

- **Full-stack TypeScript** end to end (React + Node + Mongoose, fully typed).
- **Backend architecture:** layered design, service layer, DTO validation (Zod), centralized error
  handling, structured logging.
- **Data & money correctness:** MongoDB transactions, atomic operations, integer money, audit ledgers.
- **Payments:** Razorpay integration, HMAC verification, webhooks, idempotency, subscription state.
- **Auth & security:** JWT in httpOnly cookies, refresh rotation, RBAC middleware, signature checks.
- **Performance:** DB-side aggregation, pagination/infinite scroll, indexed queries, RTK Query caching.
- **Real-time:** Socket.io rooms + typed events.
- **Frontend craft:** Redux Toolkit + RTK Query, responsive Tailwind UI, i18n (English + Tamil),
  accessibility-minded modals.
- **Product sense:** plan gating, sensible defaults, graceful degradation when a service (payments)
  isn't configured.

---

## 7. YouTube video outline (≈12–18 min)

| Time | Segment | What to show |
|---|---|---|
| 0:00 | Hook | "Most split apps track who-owes-whom. I built one that doesn't." Demo the pooled wallet. |
| 1:00 | The problem | Circular debt vs. a shared pool. Why pooled is simpler + transparent. |
| 2:30 | Architecture | The request-flow diagram (Section 2). Why a service layer. |
| 4:00 | Money done right | Integer paise + the atomic `$gte` debit (Sections 3.1, 3.3) on screen. |
| 6:00 | Audit trail | Show an expense create → the ledger + activity feed (3.7). |
| 7:30 | Edit + edit log | The immutability→auditable-mutability tradeoff (Feature 3). |
| 9:00 | Reports & aggregation | who-paid/who-spent + the "collective EMI" bucket (Feature 4, 3.8). |
| 11:00| Payments | Razorpay order → verify → webhook; idempotency + the failed/pending list (Feature 5, 3.4–3.5). |
| 14:00| Real-time + auth | Socket rooms; httpOnly cookies + single-flight refresh (3.6, 3.11). |
| 15:30| What I learned | Section 5 talking points. |
| 17:00| Outro | Repo link, "open to opportunities," subscribe. |

**Recording tips:** show the *code that proves each claim* (the `$gte` filter, the
`findOneAndUpdate` grant, the `$facet` pipeline). Recruiters skim — put the diagram and the payment
race slide where they'll pause.

---

## 8. LinkedIn posts (ready to paste — pick one)

### Option A — concise, recruiter-friendly
> 🚀 I built **Arkalyn Kitty** — a group expense-sharing app on a *pooled-wallet* model (members fund
> a shared balance; expenses debit the pool — no "who-owes-whom" math).
>
> It's a MERN + TypeScript app I engineered like a fintech product:
> 💰 Money stored as **integer paise** (never floats)
> 🔒 **Atomic, transactional** balance updates — the DB enforces "no overspending"
> 🧾 Full **audit trail** on every change
> 💳 **Razorpay** subscriptions with HMAC-verified webhooks + **idempotent, race-safe** grants
> 🔑 JWT in **httpOnly cookies** with single-flight refresh
> 📊 Reports + MRR via **MongoDB aggregation** (computed in the DB, not Node)
> ⚡ Real-time updates with **Socket.io**
>
> Stack: React 19 · Vite · Express 5 · MongoDB/Mongoose · Redux Toolkit (RTK Query) · Socket.io · Razorpay.
>
> Full walkthrough on YouTube 👉 [link]
> I'm **open to full-stack / backend roles** — let's talk. #MERN #TypeScript #NodeJS #React #MongoDB #OpenToWork

### Option B — story / problem-solution
> Every expense-splitting app I've used drowns you in "you owe Sam ₹240, Sam owes Priya ₹110…".
> So I built one that kills circular debt entirely: a **shared pool** everyone funds, and expenses
> just come out of it.
>
> The fun part wasn't the CRUD — it was treating money correctly:
> • exactly-once payment grants across a browser↔webhook race (idempotency keys + atomic transitions)
> • no-overspend enforced *inside* the database query, not in app code
> • editable expenses that still keep a tamper-proof before→after audit log
> • plans that expire lazily with a grace period — zero cron jobs
>
> MERN + TypeScript + Razorpay. I wrote up the architecture and recorded a deep-dive 👉 [link]
> Open to backend/full-stack opportunities. #SoftwareEngineering #FullStack #Fintech #OpenToWork

### Option C — one-liner + carousel caption
> I engineered a group-expense app like a payments product: integer money, ACID transactions,
> idempotent Razorpay webhooks, httpOnly-cookie auth, and DB-side analytics. Swipe for the
> architecture 👇 Full video: [link] #MERN #TypeScript #NodeJS #OpenToWork

---

## 9. Glossary (drop on-screen as you say each term)

- **Pooled wallet** — a shared group balance everyone contributes to; expenses debit it.
- **ACID transaction** — all-or-nothing multi-document write.
- **Idempotency** — running the same operation twice has the same effect as once.
- **HMAC signature** — a keyed hash proving a message wasn't forged/tampered.
- **Webhook** — a server-to-server callback (here: Razorpay → our backend on payment captured).
- **Atomic operation** — a read-check-write the database performs as one indivisible step.
- **Aggregation pipeline** — MongoDB's `$match/$group/$facet` stages to compute reports in the DB.
- **Cache invalidation (tags)** — RTK Query refetches exactly the data a mutation changed.
- **RBAC** — role-based access control (SUPER_ADMIN / ADMIN / MEMBER; app-owner-only admin).
- **Effective plan** — entitlement computed live from expiry + grace, not a stored flag.

---

*Doc generated as a content kit — adapt the voice to yours. Repo: this project. Author: Aravind A.*
