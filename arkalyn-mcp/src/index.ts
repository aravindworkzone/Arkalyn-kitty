import "dotenv/config";
import express, { type Request, type Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const API_BASE_URL = (process.env.API_BASE_URL ?? "").replace(/\/+$/, "");
const PORT = Number(process.env.PORT) || 3001;

if (!API_BASE_URL) {
    // Fail fast — every tool call needs a backend to talk to.
    console.error("Missing API_BASE_URL. Copy .env.example to .env and set it.");
    process.exit(1);
}

// ---------------------------------------------------------------------------
// Arkalyn Kitty API client — READ-ONLY. callAPI never issues anything but GET,
// so this server is structurally incapable of writing to the backend.
// ---------------------------------------------------------------------------
class ApiError extends Error {
    constructor(public readonly status: number) {
        super(`Arkalyn Kitty API responded ${status}`);
        this.name = "ApiError";
    }
}

async function callAPI<T = unknown>(path: string, apiKey: string): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${path}`, {
        method: "GET", // never POST/PUT/PATCH/DELETE
        headers: {
            "x-api-key": apiKey,
            Accept: "application/json",
        },
    });

    if (!res.ok) throw new ApiError(res.status);
    return (await res.json()) as T;
}

// Maps a thrown error to the user-facing message required by the spec.
function errorText(err: unknown): string {
    if (err instanceof ApiError) {
        switch (err.status) {
            case 401:
                return "Invalid or expired API key";
            case 404:
                return "No data found";
            case 500:
                return "Arkalyn Kitty API unavailable";
            default:
                return `Request failed (HTTP ${err.status})`;
        }
    }
    // Network failure / DNS / timeout — treat as the API being unreachable.
    return "Arkalyn Kitty API unavailable";
}

type ToolResult = {
    content: Array<{ type: "text"; text: string }>;
    isError?: boolean;
};

const ok = (data: unknown): ToolResult => ({
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
});

const fail = (err: unknown): ToolResult => ({
    content: [{ type: "text", text: `Error: ${errorText(err)}` }],
    isError: true,
});

// ---------------------------------------------------------------------------
// Per-connection MCP server. Each SSE session gets its own server instance with
// the session's API key captured in the tool closures, so one process can serve
// many users without ever mixing their keys/data.
// ---------------------------------------------------------------------------
function buildServer(apiKey: string): McpServer {
    const server = new McpServer({
        name: "arkalyn-kitty-mcp",
        version: "1.0.0",
    });

    server.tool(
        "get_my_balance",
        "Returns balance summary across all your Arkalyn Kitty groups",
        async () => {
            try {
                return ok(await callAPI("/api/mcp/balance", apiKey));
            } catch (err) {
                return fail(err);
            }
        },
    );

    server.tool(
        "get_my_expenses",
        "Returns your recent expenses. Use the optional filters to narrow results " +
            "by date range, group, or category instead of fetching everything — " +
            "results are capped at 100 per call.",
        {
            limit: z.number().int().positive().max(100).optional(),
            from: z
                .string()
                .describe("Only expenses on/after this date (ISO 8601, e.g. 2026-01-01)")
                .optional(),
            to: z
                .string()
                .describe("Only expenses on/before this date (ISO 8601, e.g. 2026-01-31)")
                .optional(),
            group: z
                .string()
                .describe("Filter by group name or group ID (case-insensitive)")
                .optional(),
            category: z
                .string()
                .describe("Filter by category name (case-insensitive)")
                .optional(),
        },
        async ({ limit, from, to, group, category }) => {
            try {
                const params = new URLSearchParams({ limit: String(limit ?? 10) });
                if (from) params.set("from", from);
                if (to) params.set("to", to);
                if (group) params.set("group", group);
                if (category) params.set("category", category);
                return ok(await callAPI(`/api/mcp/expenses?${params}`, apiKey));
            } catch (err) {
                return fail(err);
            }
        },
    );

    server.tool(
        "get_my_members",
        "Returns all members in your groups",
        async () => {
            try {
                return ok(await callAPI("/api/mcp/members", apiKey));
            } catch (err) {
                return fail(err);
            }
        },
    );

    server.tool(
        "get_my_subscription",
        "Returns your current plan and renewal date",
        async () => {
            try {
                return ok(await callAPI("/api/mcp/subscription", apiKey));
            } catch (err) {
                return fail(err);
            }
        },
    );

    return server;
}

// ---------------------------------------------------------------------------
// HTTP transport
// ---------------------------------------------------------------------------
const app = express();

// Active SSE transports keyed by sessionId, so POST /messages can route a
// client's JSON-RPC message back to its open event stream.
const transports = new Map<string, SSEServerTransport>();

// Pulls the API key from the request: ?apiKey=… (connector URL query string),
// or the x-api-key / Authorization: Bearer headers as fallbacks.
function readApiKey(req: Request): string {
    const fromQuery = typeof req.query.apiKey === "string" ? req.query.apiKey.trim() : "";
    if (fromQuery) return fromQuery;
    const header = req.header("x-api-key");
    if (header) return header.trim();
    const auth = req.header("authorization");
    if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
    return "";
}

// Health probe for Render / uptime monitors.
app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", sessions: transports.size, uptime: process.uptime() });
});

// ── Streamable HTTP (modern transport — what Claude.ai's custom connector uses) ──
// Connector URL: https://<host>/mcp?apiKey=ak_live_xxx
//
// Stateless: each request gets a fresh server+transport (sessionIdGenerator
// undefined), so there's no session to terminate mid-call — the failure mode the
// legacy SSE transport hits with Claude.ai. express.json() is scoped to this
// route only, so the SSE /messages route below still receives a raw stream.
app.post("/mcp", express.json(), async (req: Request, res: Response) => {
    const apiKey = readApiKey(req);
    if (!apiKey) {
        res.status(401).json({
            jsonrpc: "2.0",
            error: { code: -32001, message: "Missing apiKey (set ?apiKey= on the connector URL)" },
            id: null,
        });
        return;
    }

    try {
        const server = buildServer(apiKey);
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        res.on("close", () => {
            void transport.close();
            void server.close();
        });
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
    } catch {
        if (!res.headersSent) {
            res.status(500).json({
                jsonrpc: "2.0",
                error: { code: -32603, message: "Internal server error" },
                id: null,
            });
        }
    }
});

// Stateless mode has no standalone GET/DELETE stream — answer with the
// protocol's "method not allowed" JSON-RPC error rather than a hang.
const methodNotAllowed = (_req: Request, res: Response): void => {
    res.status(405).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Method not allowed." },
        id: null,
    });
};
app.get("/mcp", methodNotAllowed);
app.delete("/mcp", methodNotAllowed);

// ── Legacy HTTP+SSE transport (for the MCP Inspector / older clients) ──
// Opens the event stream with the API key as a query param: GET /sse?apiKey=…
// The key is held only for this session (in the server's tool closures) and
// dropped when the stream closes. Prefer /mcp above for Claude.ai.
app.get("/sse", async (req: Request, res: Response) => {
    const apiKey = typeof req.query.apiKey === "string" ? req.query.apiKey.trim() : "";
    if (!apiKey) {
        res.status(401).send("Missing apiKey query parameter");
        return;
    }

    const transport = new SSEServerTransport("/messages", res);
    transports.set(transport.sessionId, transport);

    res.on("close", () => {
        transports.delete(transport.sessionId);
    });

    const server = buildServer(apiKey);
    await server.connect(transport);
});

// Client → server JSON-RPC messages. The transport reads the raw request body
// itself, so we deliberately do NOT mount express.json() ahead of this route.
app.post("/messages", async (req: Request, res: Response) => {
    const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : "";
    const transport = transports.get(sessionId);
    if (!transport) {
        res.status(400).send("No transport found for sessionId");
        return;
    }
    await transport.handlePostMessage(req, res);
});

app.listen(PORT, () => {
    console.log(`Arkalyn Kitty MCP server on :${PORT} → API ${API_BASE_URL}`);
    console.log(`  Claude.ai connector URL:  /mcp?apiKey=ak_live_…  (Streamable HTTP)`);
    console.log(`  MCP Inspector (SSE):      /sse?apiKey=ak_live_…`);
});
