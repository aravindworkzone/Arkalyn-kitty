# Expense Tracker – Group Wallet System

A production-oriented, group-based expense management system built on the MERN stack. The core design prioritizes financial integrity, role-based access, and a clear audit trail over feature complexity.

---

## Architecture Decision – Why a Pooled Wallet?

Most expense-sharing apps implement a debt-splitting model (e.g., Splitwise), which requires resolving circular debts and maintaining per-user balances between members. This introduces significant state complexity.

This system deliberately uses a **pooled wallet model** instead:

- Members contribute to a single shared balance
- Expenses are deducted from that pool
- Individual contributions are tracked for transparency, not for settlement

This trade-off keeps the financial logic deterministic and the data model simple — a conscious architectural choice, not a limitation.

---

## How It Works

1. A member contributes an amount → group balance increases, contribution record is created
2. An admin adds an expense → balance decreases, expense is logged with category and metadata
3. The system enforces a hard constraint: **expenses cannot exceed available balance**
4. All mutations are logged — there is no silent state change

---

## Data Model Overview

**Group**
- `balance` — current available funds
- `members` — array of user references with role and contribution total
- `expenses` — referenced collection, not embedded, to support pagination and reporting

**Contribution**
- `userId`, `groupId`, `amount`, `createdAt`
- Immutable after creation — corrections require a new entry

**Expense**
- `title`, `amount`, `category`, `createdBy`, `groupId`, `createdAt`
- No edit operation exposed — delete and recreate enforces a clear audit trail

---

## Role-Based Access Control

Permissions are enforced at the middleware level, not just the UI.

| Role        | Capabilities                                                |
|-------------|-------------------------------------------------------------|
| Member      | Add expenses, view group balance and transaction history    |
| Admin       | All member actions + manage categories, delete any expense  |
| Super Admin | All admin actions + delete group, manage member roles       |

Role checks are applied per route using middleware, so unauthorized actions are rejected at the API layer regardless of client-side state.

---

## System Constraints

- Balance cannot go negative — validated server-side before any expense write
- No duplicate members within a group — enforced at the database layer
- Expenses are immutable after creation — no PATCH endpoint exists by design
- All balance-affecting operations update the group document atomically

---

## Tech Stack

**Frontend**
- React with Redux Toolkit for global state
- RTK Query for server state, caching, and optimistic updates
- Tailwind CSS for styling

**Backend**
- Node.js + Express with a layered architecture (routes → middleware → controllers → models)
- Controllers handle request logic and interact directly with Mongoose models for data operations
- Mongoose for schema enforcement and query abstraction

**Database**
- MongoDB — document model fits the nested group/member/expense relationship

---

## API Design Approach

- RESTful conventions throughout
- All protected routes require a valid JWT (verified via middleware)
- Error responses follow a consistent structure: `{ success, message, data }`
- Validation runs at both the schema level (Mongoose) and the request level (middleware)

---

## Project Status

In active development — core features functional, currently hardening edge cases and structuring for deployment.

---

## Planned Enhancements

- Expense split mode alongside the pooled model
- Settlement and payout tracking between members
- Webhook or in-app notifications on balance threshold
- Aggregated analytics dashboard (spending by category, contribution trends)

---

## Design Philosophy

The goal was not to build the most feature-rich expense app — it was to build one with **defensible decisions at every layer**. Financial data requires consistency above all else. Every constraint in this system exists because a missing one would create ambiguous state.

> Simple → Maintainable → Scalable
