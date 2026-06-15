# Arkalyn Kitty — MCP Server

A small, hosted **MCP SSE server** that lets a Claude.ai user read their own
Arkalyn Kitty data through a personal API key. Everything is **read-only** — the
server only ever issues `GET` requests to the backend.

## Tools

| Tool | Input | Backend call |
| --- | --- | --- |
| `get_my_balance` | — | `GET /api/mcp/balance` |
| `get_my_expenses` | `{ limit?: number }` (default 10) | `GET /api/mcp/expenses?limit=…` |
| `get_my_members` | — | `GET /api/mcp/members` |
| `get_my_subscription` | — | `GET /api/mcp/subscription` |

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
| 404 | `No data found` |
| 500 | `Arkalyn Kitty API unavailable` |
| network failure | `Arkalyn Kitty API unavailable` |
