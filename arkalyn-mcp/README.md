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
2. They connect this MCP server in Claude.ai, passing the key in the SSE URL:
   `https://<host>/sse?apiKey=ak_live_xxxxx`.
3. The server stores that key per SSE session and sends it as the `x-api-key`
   header on every backend call. The backend scopes all data to the key's owner.

## Endpoints

- `GET /sse?apiKey=…` — opens the MCP event stream (one server per session).
- `POST /messages?sessionId=…` — client → server JSON-RPC messages.
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
