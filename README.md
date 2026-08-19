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
- **Multi-document transactions** — expense create/edit/delete, settlement, group close, and group-to-group funding all run inside a `mongoose` session so the balance, ledger entry, and audit event commit or abort together. A funding transfer spans two groups' wallets and ledgers in one session.

---

## How It Works

1. A member contributes → group balance increases and a `CREDIT` ledger entry is created.
2. An admin adds an expense → balance decreases, an `Expense` is written, and a `DEBIT` ledger entry is logged with category and metadata.
3. Editing an expense adjusts the pool by the **delta only**, then writes a field-level before→after diff to the event log.
4. Deleting an expense soft-deletes it and refunds the pool with a `REFUND` entry.
5. The system enforces a hard constraint: expenses cannot exceed available balance.
6. A connected group can top the wallet up too — an admin of the funding group pushes money across, and it credits the pool like any other contribution.
7. All mutations are logged — there is no silent state change.

---

## Data Model

The schema is normalized across focused collections rather than embedded blobs:

**Identity & auth**
- `user` — account, hashed password, profile, app role, lifecycle status (no plan — see `group`)
- `session` — issued refresh-token sessions, used for the device/session cap
- `password_reset` — short-lived reset tokens

**Groups**
- `group` — group metadata, **its type** (`purpose` — see Group Types), status, balance, **its subscription** (`plan`, `planExpiresAt`, `planCycle`, `planSource`) and the plan snapshot frozen at close
- `group_member` — join collection (user ↔ group) carrying role, contribution total, and settlement state
- `group_invite` — invitations with a two-step lifecycle (invitee responds, then an admin approves)
- `group_join_link` — shareable "ask to join" tokens, one active per group, revocable and rotatable
- `group_link` — group ↔ group funding links (source bankrolls host) with a running contributed total
- `group_event` — per-group audit/event stream

**Money**
- `group_transaction` — CREDIT / DEBIT / REFUND ledger (scaled amounts, soft-delete)
- `expense` — individual expense records with optional per-member split attribution
- `category` — per-group categories, in two flavours (`EXPENSE` and `CREDIT`)
- `counter` — atomic sequence source for human-readable display IDs (`Grp-25-001`)

**Billing**
- `subscription_payment` — Razorpay order/payment records (`groupId` = what was upgraded, `userId` = who paid)
- `promo_code` / `promo_redemption` — discount codes and their redemptions

**Notifications**
- `notification` — in-app notifications, auto-expiring after 60 days via a TTL index

---

## Groups & Membership Lifecycle

- **Invite → accept → approve.** An invite targets an existing account. The invitee accepts and declares a contribution, which is held on the invite row until an admin approves — only then does it credit the group balance. `REJECTED` (invitee said no) and `DECLINED` (admin said no) are kept distinct so the audit trail records who refused.
- **Join links.** An admin can share a link (`/join/<token>`) that lets anyone with it *ask* to join. Clicking it is the acceptance, so the request is written straight to `PENDING_APPROVAL` — the same state an emailed invite reaches once answered, and therefore the same approval queue, the same member-cap check, the same balance credit. A link is a second entry point, not a second path to membership: nobody joins unreviewed. Tokens are stored in plaintext deliberately, since a token grants only the right to ask; one link is active per group, and rotating or revoking kills the old one immediately.
- **Leaving.** A member either files a leave request for admin approval (settlement path) or exits instantly via **forfeit**, leaving their contribution in the pool. `leftMode` records which happened.
- **Settlement.** An admin settles a member for an amount up to the available balance; the payout debits the pool and writes a ledger entry. Members cannot be removed unsettled.
- **Close & clone.** A group can be previewed and then closed, freezing its plan tier into `planSnapshot` so a later purchase or lapse never rewrites history. Closed groups reject all further writes (`ensureGroupActive`) and stop counting toward the owner's group cap. Paid tiers can clone a group's structure into a fresh one.

---

## Group Types

Every group has a **type**, chosen at creation and **immutable thereafter**. It is
stored in `group.purpose` and decides which features the group has.

| Type | Records expenses | May fund another group | What it is |
|---|---|---|---|
| `FAMILY` | ✓ | — | The pooled-wallet baseline: shared bills and everyday spending. |
| `CHIT` | ✓ | — | Everything Family can do, **plus a chit fund** — see below. |
| `RESERVE` | — | ✓ | A vault. Holds contributions and bankrolls other groups; it does not spend on its own account. |

**Type and tier are orthogonal axes.** A plan is bought and lapses; a type is
intrinsic and permanent. So group-type gating is a second capability map
(`config/groupTypeFeatures.ts` → `GROUP_TYPE_FEATURES`) resolved by its own
assertion (`helpers/groupTypes.ts` → `assertGroupTypeFeature`), rather than more
rows in `PLANS`. Where both apply they compose: funding a group needs
`assertFeature(plan, 'linkGroups')` **and**
`assertGroupTypeFeature(purpose, 'fundOthers')`.

Type gates throw **403, not 402**. A Chit group does not become a Family group by
paying, so `402 Payment Required` would be a lie — and every 402 is recorded to
`paywall_hit` as purchase intent, which would poison the one dataset used to
decide where tier boundaries belong. Same line the funding routes already draw for
`/reject`: refusing is never a paid action.

**`purpose` has legacy values.** `FRIENDS`, `ROOMMATES`, `TEAM` and `OTHER` exist
on groups created before purpose meant anything. They stay valid in the Mongoose
enum — dropping them would strand real documents behind a schema that no longer
accepts them — and `groupTypeOf()` resolves every one of them to `FAMILY`, which
is exactly how those groups already behave. `SELECTABLE_GROUP_PURPOSES` is what
the create form offers and the validator accepts, so no *new* group can be created
on a legacy value. This is the same storage-vs-offered split as `PLAN_TIERS` vs
`SELLABLE_TIERS`, down to the `isSelectableGroupPurpose` predicate.

Two consequences worth stating:

- **Gates live in the services, not only in middleware.** The MCP server calls
  `createExpenseService` and `createCategoryService` directly and never passes
  through a router, so a middleware-only gate would not apply to it. The
  middleware is an early, cheap failure; the service is the enforcement point. The
  group's `purpose` is a *required* field on both service inputs, so the compiler
  names any call site that forgets to pass it.
- **Restrictions bind creation, not history.** A Reserve group that predates the
  rule keeps its expenses readable, editable and deletable — only new ones are
  refused. Freezing them would strand money with no way to correct it. Its
  `RESERVE` starter categories are seeded as `CREDIT` buckets, since expense
  categories would be buckets nothing could ever go into.

---

## Chit Funds

A `CHIT` group runs a **rotating savings scheme**: every participant pays the same
fixed amount each cycle, and one participant per cycle receives the whole pot, in
an order fixed when the scheme starts.

There is deliberately **no auction, no bidding, no discount and no organiser
commission**. That keeps one identity true: the pot is always
`amountPerMember × participants`, everyone pays every cycle *including that
cycle's recipient*, and over the full term each member pays in exactly what they
take out. Take any of those away and it stops being a chit and becomes a lottery.

**Chit money is the group's money.** Recording a contribution credits
`group.balance`, bumps the member's `contribution` and writes a `CREDIT` row —
the same `helpers/balanceOps` primitives, the same ledger, the same atomic
overspend guard as every other money path. A payout debits it and writes a
`DEBIT`. There is no parallel chit ledger: a second source of truth for the same
rupees is the one thing this codebase has consistently refused to build.

Three collections. `chit_scheme` holds the terms and the frozen turn order;
`chit_cycle` is one row per cycle; `chit_due` is one row per member per cycle.
**Everything is materialised at activation** — all N cycles and all N² dues in one
transaction — so there is no per-cycle "open" step to remember, members can pay
ahead, and "my history" is an indexed query rather than a reconstruction. That N²
is what `MAX_CHIT_PARTICIPANTS` (50) bounds.

- **Missed is derived, never stored.** A due is missed when it is still `PENDING`
  and either its date has passed or its cycle has already paid out. Storing it
  would need a scheduler, which this codebase refused for lazy plan expiry too.
  One `dueState()` helper resolves it, so the member view, the organiser roster
  and the history log cannot disagree. The server ships the answer; the client
  never reads the clock during render, which the React Compiler would reject.
- **A missed contribution stays payable.** "Ravi paid his August dues in
  September" is the most ordinary event in a real chit. A late payment raises that
  cycle's `collectedAmount` but never rewrites its `shortfallAmount`, which records
  what the recipient actually received on the day.
- **A short cycle still pays out**, with an explicit confirmation naming collected
  versus expected. One defaulter must not freeze the scheme.
- **The organiser acts, not the role.** `defaultJoinRole` makes *every* member of
  a Free group an `ADMIN`, so gating on the role would let anyone mark themselves
  paid and pay themselves the pot. `requireChitOrganizer` gates on
  `scheme.organizerUserId`, with `SUPER_ADMIN` as the backup that stops a group
  being stranded by a quiet organiser.
- **Recording is reversible; the payout is not.** Marking paid is manual, so
  mis-marking is one misclick — hence an undo, restricted to cycles that have not
  yet paid out. Correspondingly, `removeCreditService` **refuses** to delete a chit
  credit: doing so would reverse the wallet while the due went on claiming it was
  paid. The chit page owns that reversal because only it can unwind all four
  writes together.
- **A running chit blocks group close and blocks members leaving.** The close
  refund is proportional to `contribution`, which is wrong mid-chit — a member who
  has taken their pot has the same contribution as one still waiting. And losing a
  participant breaks the one-cycle-per-member invariant.
- **Chit size is the plan lever.** `participants.length` is checked against
  `maxMembersPerGroup`, so a Free group can run a 5-person chit and a real
  20-person one needs Pro. No new plan flag was required.

---

## Connected Groups

A **Reserve** group can bankroll another — a household reserve funding a trip
group, say. Only a Reserve group may be the source: `fundOthers` is a group-type
capability, so a Family or Chit group cannot be named as a funder. The link is
consented to on both sides: an admin of the **host** (the group that wants
funding) requests it, and an admin of the **source** (the group whose money it is)
approves. Direction is never inferred and never reversed.

The type gate sits on link **formation** — `/request` and `/approve` — and
deliberately *not* on `/transfer`. A transfer acts on a link that is already
`ACTIVE`, so links approved before the rule existed keep working: grandfathering
falls out of where the gate sits, with no flag, no migration and no dead state to
reconcile.

Funding is **pre-paid, not pulled**. An admin of the source pushes a lump sum, exactly like a member topping up a wallet; the host then spends it through the ordinary expense flow. Only the source can move its own money — a host can request a link and spend what it has been given, but it can never reach into the funder's wallet.

A single transfer runs in one session across two wallets:

```
debitGroupBalance(source)    → DEBIT  on source, referenceModel 'Group'
creditGroupBalance(host)     → CREDIT on host,   referenceModel 'Group'
$inc link.contribution
```

The atomic overspend guard applies to the source, so a transfer larger than its balance matches nothing and aborts the whole session.

Expenses in the host can optionally record `fundedByGroup`. That is **attribution only** — the money was already transferred in, so the debit still targets the host like any other expense, and the invariant that *an expense debits exactly the group it belongs to* holds everywhere. Because funding is pre-paid, a host can tag more spend to a funder than that funder ever sent; the UI warns and still saves, matching how category spend limits behave.

Money sent is a **contribution, not a loan**. There is no inter-group debt and no settle-up: removing a link stops further funding and further attribution, and leaves what has already moved where it is. Closing or deleting either group revokes the link.

**The host pays for the connection, never the source.** A reserve group can sit on Free and bankroll as many groups as it likes — it is giving money away, and charging for that would be charging for generosity. What the `linkGroups` feature buys is the right to *be* funded: the host's wallet grows, its ledger carries the incoming credits, and its expenses gain funder attribution. So the plan gate does not follow the acting group. On `/request` the actor is the host and its own plan is read; on `/approve` and `/transfer` the actor is the source, so the host is recovered from the link and gated instead (`requireLinkHostPlan`). `/reject` and `/revoke` are ungated on both sides — refusing, and unwinding something already agreed, must work on any plan.

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
| `ADMIN` | All member actions + manage categories, invite and manage members, share/revoke the join link, approve join requests, manage group connections and send funds, add contributions, settle members, edit or delete any expense |
| `SUPER_ADMIN` | All admin actions + manage admin roles, close/clone/delete the group |
| `APP_OWNER` | Application-level administration across all accounts (see `admin.router`) |

Expense editing is authorized inside the service rather than by route middleware, because the rule is *admin **or** the original payer* — which the role middleware alone cannot express.

---

## Payments & Subscriptions

**Subscriptions are per GROUP, not per account.** A plan is bought for one group
and every limit and feature below applies to that group alone; a user can own a
Premium group and a Free one at the same time, and any `SUPER_ADMIN`/`ADMIN` of a
group can pay to lift its limits for everyone in it. Accounts hold no tier.

Three sellable tiers, priced in INR. `null` means unlimited.

| | Free | Pro | Organization |
|---|---|---|---|
| Price (monthly / yearly) | ₹0 | ₹199 / ₹1,990 | ₹999 / ₹9,990 |
| Members in the group | 5 | 25 | Unlimited |
| Categories in the group | 10 | 50 | Unlimited |
| Event log retention | 15 days | 180 days | Unlimited |
| Transaction log retention | 30 days | 365 days | Unlimited |
| Custom report date ranges | — | ✓ | ✓ |
| Admin & member roles | — (all admins) | ✓ | ✓ |
| Clone group | — | ✓ | ✓ |
| Receive funding from another group | — | ✓ | ✓ |
| Fund another group | ✓ | ✓ | ✓ |
| CSV export & audit pack | — | — | ✓ |
| Priority support | — | — | ✓ |

Yearly is ten months' price for twelve — "2 months free" rather than a
percentage, so the badge stays true if a price ever moves.

**Who each tier is for.** Free has to be genuinely sufficient for a flatmate
kitty, because those groups are how an organizational buyer first sees the
product; capping it tighter would cost reach and gain nothing, since that user
was never going to pay. Pro is the large-informal-group tier. Organization is
the one the business is built on: audit trail, unlimited history and export, for
committees and treasurers who answer to somebody.

**`PREMIUM` is a retired tier, not a live one.** It stays in `PLAN_TIERS`,
`PLANS` and the Mongoose enums because existing groups, plan snapshots and
historical receipts still carry the value, and dropping it would strand that data
behind an enum that no longer accepts it. It is absent from `SELLABLE_TIERS`, so
checkout, promo creation and every pricing surface reject or omit it, while
`PLAN_RANK` scores it level with `ORG` (identical entitlements) so a legacy group
renewing onto Organization reads as a lateral move rather than a blocked
downgrade. The app-owner override still offers it — that is the tool for
repairing a legacy row.

- **Razorpay** order creation and **HMAC signature verification** on callback.
- **Idempotent** payment recording — a replayed callback does not double-credit.
- **Lazy expiry** — entitlement is computed on read from the group's `plan` + `planExpiresAt`, so no cron job is needed. After expiry a **7-day grace period** preserves full access; past that the group falls back to `FREE` and over-limit resources go read-only.
- **One lookup governs every gate** — `getGroupPlan(groupId)` reads the group's own fields, so the answer is identical for every member and the UI gates on the exact plan the API will enforce (shipped on `GET /group/:id` as `subscription`).
- **Group count is not a plan limit.** With per-group plans nothing account-level could raise it, so `MAX_ACTIVE_OWNED_GROUPS` is a flat anti-abuse cap rather than a billing lever.
- **Promo codes** with tracked redemptions, one per group, guarded against downgrading a group already on a higher active tier.

A group without the **member role** is *flat*: it has no role below ADMIN, so
everyone admitted lands as `ADMIN` and can manage it. Demotion is the only path
that mints a `MEMBER`, so that is where the gate sits; promotion stays free on
every tier, or a lapsed group could end up with nobody able to administer it.
A group that lapses keeps the `MEMBER`s it already has rather than silently
promoting them — handing out management rights on expiry would be the one
downgrade that *adds* privilege.

The named report presets — `this_month`, `last_month`, and `all_time` — are free on every tier; only hand-picked custom date ranges are gated. Closed groups are exempt regardless of tier, since the month presets are meaningless on frozen history.

### Migrating an existing database

Plans used to live on the `user` document. Deploying the per-group model against
a database that predates it leaves every paying customer's groups on `FREE`,
because the new gates read fields that are empty on existing group documents.
Run once, before or immediately after the deploy:

```bash
cd Backend
npm run migrate:group-plans            # dry run — reports, writes nothing
npm run migrate:group-plans -- --apply
```

It copies each user's live paid tier onto every open group they own (preserving
the original expiry dates), backfills `SubscriptionPayment.groupId` on historical
receipts, and drops the superseded `promoCodeId_1_userId_1` unique index now that
promo redemption is one-per-group. It is idempotent, never downgrades a group
that already has a plan, and leaves the old user fields in place so the deploy
stays reversible.

---

## Export & Audit Pack

`GET /api/export/:groupId/:sheet` — `ledger`, `expenses`, `members`, or
`audit-pack` (all three under banners in one file). Admins only, unlike the
in-app reports any member can read: an export is the whole group's financial
record in one portable file, so reading a chart and walking away with the roster
are treated as different acts.

- **Amounts are hydrated, never `.lean()`.** Money fields carry the rupee↔paise
  getters; `lean()` returns raw BSON with getters bypassed, which would export
  every amount ×100. Slower hydration is the right trade on a financial record.
- **Reversed entries are included and flagged**, not dropped — "what was entered
  and later reversed" is exactly what an audit asks about.
- **CSV injection is neutralised.** A cell starting `=`, `+`, `-` or `@` is
  formula-evaluated by Excel and Sheets, so an expense titled `=HYPERLINK(...)`
  would become live code in the treasurer's spreadsheet. `helpers/csv` prefixes a
  tab, and emits a BOM so Excel on Windows doesn't mangle non-ASCII names.
- **Export outlives the subscription.** Every other gate freezes on lapse; this
  one reads the *stored* tier via `canExportData`, so a group whose card expired
  mid-audit can still hand a CSV to its auditor. Withholding a customer's own
  records to force a renewal turns a billing conversation into a chargeback.
  `helpers/plans.canExport` mirrors the rule on the client so the button doesn't
  hide a download the API would serve.

## Demand Signal (paywall analytics)

Every 402 is recorded to `paywall_hit` from the global error handler — one choke
point, so gates added later are captured with no per-call-site bookkeeping.
Writes are fire-and-forget: instrumentation must never turn a clean 402 into a
500 or make the user wait.

This is the only place the product records *intent* rather than behaviour. A
paywall hit is a customer stating, with their hands rather than a survey, which
capability they wanted enough to walk into a wall for. `GET /api/admin/demand`
aggregates it, sorted by **distinct groups** rather than raw hits: many hits from
few groups is one loud customer retrying, while hits spread across many groups is
a tier boundary drawn in the wrong place — and moving it is usually worth more
than building anything new. Rows expire after two years.

## Reports

Three group-scoped report endpoints under `/api/groupreport`, all available to any member:

- **Category breakdown** — spend per category, with special categories bucketed separately.
- **Member breakdown** — attribution per member: expenses they shared in, plus unsplit expenses they paid for.
- **Spend trend** — spend over time.

Report cards deep-link into a pre-filtered expense list, and the list's server-side filters (category, payer, spender, funding group, date range) mirror the report's attribution so the drill-through always reconciles with the chart.

The **funded-by** filter has three states rather than two: unset, a connected group, or the literal `own` for expenses drawn from the group's own wallet. The sentinel exists because "not funded by anyone" is a question the id-only form can't ask — and because `{ fundedByGroup: null }` also matches expenses written before the field existed. The connections page's "tagged to expenses" total links straight into this filtered view.

An `all_time` range starts at the group's **first expense**, not its creation date, so a group set up months before anyone spent anything doesn't open on a run of empty leading buckets.

Attribution stays user-keyed: a connected group that funds this one is a contributor, not a member, and never appears in the member breakdown.

---

## Realtime & Notifications

- **socket.io** server (`backend/sockets`) and `socket.io-client` on the frontend push live updates for expenses, categories, balance, membership, roles, contributions, settlements, leave requests, group connections, and activity events.
- **In-app notifications** cover the membership lifecycle — invites, join requests (emailed or via a join link), join approvals, leave requests, role changes, departures, and group deletion — plus the connection lifecycle: requested, approved, rejected, revoked, and funded.
- A funding transfer changes two wallets, so `group:link:updated` is emitted to **both** group rooms; whichever side is on screen refetches.
- **Transactional email** via Resend for password reset and the public contact form. Optional: without an API key the app still boots and email degrades to a logged warning.

---

## MCP Server

A hosted MCP server (`arkalyn-mcp/`) lets a Claude.ai user operate on their **own** Arkalyn Kitty data through a personal API key generated from their profile. Every call is scoped to the key's owner.

**Read tools:** `get_my_balance`, `get_my_expenses`, `get_group_details`, `get_group_activity`, `get_my_members`, `get_group_subscription`
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
- Join-link tokens are 192-bit url-safe randoms and are **not** credentials — they buy only the right to ask, and an admin still approves every request. A revoked link and an invented one return the same error, so the token space can't be probed for which groups exist
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
| `/api/joinlink` | create/rotate, revoke, read the group's link; preview a token and request to join |
| `/api/grouplink` | request, approve, reject, revoke a funding link; send funds; list both directions |
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
- **No data import.** CSV *export* ships on the Organization tier (see above);
  there is no import path.
- **Contribution requests are catalogued but not built.** The
  `contributionRequests` feature flag is set on Organization and rendered in the
  pricing table; no route enforces it yet, because the collect-by-UPI flow it
  names is not implemented. It must be built or removed from the catalogue before
  the tier is sold on that promise.
- **Splitting supports equal and exact amounts only** — no percentage, shares, or multiple payers.
- **Expense text search is client-side** over the loaded page; the server-side filters are the ones that scale.
- **`groupType: "SPLIT"`** exists in the schema but is unimplemented — `POOL` is
  the only live mode. Note this is a *different, unrelated* field from the group
  TYPE described above, which is stored in `purpose`; the dead `groupType` field is
  a naming collision worth retiring.
- **Chit funds are the simple rotating kind only.** There is no auction or
  bidding, no discount, no dividend and no organiser commission — see Chit Funds
  above for why that is a design choice rather than an omission. A group wanting a
  bid-based chit is not served.
- **Chit contributions are recorded by hand.** Money is settled offline and an
  organiser marks it received; there is no payment rail, so nothing reconciles
  automatically against a bank or UPI feed.
- **A chit cannot be resized once started.** Amount, participants and order freeze
  at activation, and a member cannot be substituted — the only exits are running
  the scheme out or cancelling it. One person's life event can therefore end a
  20-cycle scheme, which a participant-replacement flow would fix.
- **Chit data is not in the CSV export.** The audit pack covers the ledger,
  expenses and members; chit cycles and contributions appear only through the
  ledger rows they produce.
- **No repayment between connected groups.** Funding is a one-way contribution by design; there is no inter-group debt or settle-up, and over-attributing spend to a funder warns rather than blocks.
- **The MCP `add_expense` tool can't set a funding group** — the field is optional, so the tool keeps working, but attribution has to be set from the web app.

---

## Design Philosophy

The goal was not the most feature-rich expense app — it was one with **defensible decisions at every layer**. Financial data requires consistency above all else; every constraint exists because its absence would create ambiguous state.

> Simple → Maintainable → Scalable
