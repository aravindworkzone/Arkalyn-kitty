# Arkalyn Kitty — MCP Server

A small, hosted **MCP server** that lets a Claude.ai user read *and* update their
own Arkalyn Kitty data through a personal API key. Every call is scoped to the
key's owner: reads only ever touch the owner's groups, and writes resolve their
target group from the owner's memberships and re-check group status/role on the
backend before applying — so a key can never reach another user's data.

## Tools

### Read

| Tool | Input | Backend call |
| --- | --- | --- |
| `get_my_balance` | — | `GET /api/mcp/balance` |
| `get_my_expenses` | `{ limit?: number (default 10, max 100), from?: ISO date, to?: ISO date, group?: string, category?: string }` | `GET /api/mcp/expenses?limit=…&from=…&to=…&group=…&category=…` |
| `get_my_members` | — | `GET /api/mcp/members` |
| `get_my_subscription` | — | `GET /api/mcp/subscription` |

### Write

| Tool | Input | Backend call | Who can |
| --- | --- | --- | --- |
| `add_expense` | `{ group, title, amount, category, paymentType?, date?, paidBy? }` | `POST /api/mcp/expenses` | any group member |
| `add_category` | `{ group, name, color? }` | `POST /api/mcp/categories` | SUPER_ADMIN / ADMIN |
| `add_contribution` | `{ group, amount, member?, description? }` | `POST /api/mcp/contributions` | SUPER_ADMIN / ADMIN |

Write notes:

- `group` accepts a group **name or display ID**, resolved against the caller's
  own groups; an ambiguous match is rejected so nothing is written to the wrong
  group.
- `add_expense` requires the **category to already exist** in the group (run
  `add_category` first). Defaults: `paidBy` = you, `paymentType` = `Cash`,
  `date` = today. Amounts are INR and can't exceed the group balance.
- `add_contribution` defaults to crediting **you**; pass `member` (name/email) to
  credit another member.
- Writes go through the same create services as the web app, so balance updates,
  transaction logs, audit events, and plan limits stay identical. Closed groups
  and over-limit/expired plans are rejected by the backend.

## How it works

1. The user generates an API key in Arkalyn Kitty (Profile → Developer).
2. They add this MCP server in Claude.ai as a custom connector, passing the key
   in the connector URL: `https://<host>/mcp?apiKey=ak_live_xxxxx`.
3. The server sends that key as the `x-api-key` header on every backend call.
   The backend scopes all data to the key's owner.

## Transports

- **Streamable HTTP** (`/mcp`) — the modern transport **Claude.ai connectors
  use**. Stateless: each request gets a fresh server, so there's no session to
  drop mid-call. Use this URL in the connector dialog.
- **HTTP+SSE** (`/sse` + `/messages`) — legacy two-endpoint transport, kept for
  the MCP Inspector and older clients.

The key may be passed as `?apiKey=…` (query), `x-api-key` header, or
`Authorization: Bearer …`.

## Endpoints

- `POST /mcp?apiKey=…` — Streamable HTTP (Claude.ai). `GET`/`DELETE` → 405.
- `GET /sse?apiKey=…` — legacy SSE event stream (one server per session).
- `POST /messages?sessionId=…` — legacy SSE client → server messages.
- `GET /health` — liveness probe.

## Local development

```bash
cp .env.example .env   # set API_BASE_URL to your backend
npm install
npm run dev            # tsx watch
```

## Deploy (Render)

- **Build:** `npm install && npm run build`
- **Start:** `node dist/index.js`
- **Env:** `API_BASE_URL` (your Arkalyn Kitty backend, no trailing slash), `PORT`

`render.yaml` in this folder describes the service.

## Error messages

| Backend status | Message returned to Claude |
| --- | --- |
| 401 | `Invalid or expired API key` |
| 400 / 402 / 403 / 404 / 409 (write) | the backend's own `message` (e.g. `Group is closed — no further changes are allowed`, `This action requires SUPER_ADMIN or ADMIN in the group`, `Category "Food" not found in this group — add it first.`) |
| 404 (read, no detail) | `No data found` |
| 500 | `Arkalyn Kitty API unavailable` |
| network failure | `Arkalyn Kitty API unavailable` |
