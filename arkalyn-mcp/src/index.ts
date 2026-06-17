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
// Arkalyn Kitty API client. callAPI issues GETs for the read tools; postAPI
// issues POSTs for the write tools. Both attach the caller's API key, and the
// backend scopes every request to that key's owner.
// ---------------------------------------------------------------------------
class ApiError extends Error {
    constructor(
        public readonly status: number,
        public readonly detail?: string,
    ) {
        super(detail ?? `Arkalyn Kitty API responded ${status}`);
        this.name = "ApiError";
    }
}

async function callAPI<T = unknown>(path: string, apiKey: string): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${path}`, {
        method: "GET",
        headers: {
            "x-api-key": apiKey,
            Accept: "application/json",
        },
    });

    if (!res.ok) throw new ApiError(res.status);
    return (await res.json()) as T;
}

// Reads the backend's `{ message }` so a 400/403/404 surfaces the actual reason
// (e.g. "Group is closed", "requires SUPER_ADMIN or ADMIN") instead of a bare
// status code — these write failures are usually user-correctable.
async function postAPI<T = unknown>(path: string, apiKey: string, body: unknown): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${path}`, {
        method: "POST",
        headers: {
            "x-api-key": apiKey,
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        let detail: string | undefined;
        try {
            const data = (await res.json()) as { message?: string };
            detail = typeof data?.message === "string" ? data.message : undefined;
        } catch {
            // Non-JSON error body — fall back to the status-based message.
        }
        throw new ApiError(res.status, detail);
    }
    return (await res.json()) as T;
}

// Maps a thrown error to a user-facing message. When the backend explained the
// failure (validation, closed group, insufficient role/balance, …) that detail
// is preferred, since it tells the user how to fix the call.
function errorText(err: unknown): string {
    if (err instanceof ApiError) {
        if (err.status === 401) return "Invalid or expired API key";
        if (err.detail) return err.detail;
        switch (err.status) {
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

    // ── Write tools ──────────────────────────────────────────────────────────
    // Each writes only to one of YOUR groups; the backend re-checks group status
    // and your role before applying the change.

    server.tool(
        "add_expense",
        "Adds an expense to one of your groups. The category must already exist " +
            "in that group (use add_category first if needed). Amounts are in the " +
            "group currency (INR). Defaults: paidBy = you, paymentType = Cash, " +
            "date = today. Any group member can add an expense.",
        {
            group: z.string().describe("Group name or group ID the expense belongs to"),
            title: z.string().min(3).max(100).describe("What the expense was for"),
            amount: z.number().positive().describe("Amount in INR (must not exceed the group balance)"),
            category: z.string().describe("Existing category name in the group"),
            paymentType: z
                .enum(["Cash", "Card", "UPI", "Net Banking"])
                .describe("How it was paid (default Cash)")
                .optional(),
            date: z
                .string()
                .describe("Expense date (ISO 8601, e.g. 2026-06-17). Defaults to today.")
                .optional(),
            paidBy: z
                .string()
                .describe("Member name or email who paid (default: you)")
                .optional(),
        },
        async (args) => {
            try {
                return ok(await postAPI("/api/mcp/expenses", apiKey, args));
            } catch (err) {
                return fail(err);
            }
        },
    );

    server.tool(
        "add_category",
        "Creates a new expense category in one of your groups. Requires that you " +
            "are an admin (SUPER_ADMIN or ADMIN) of the group.",
        {
            group: z.string().describe("Group name or group ID to add the category to"),
            name: z.string().describe("Category name (must be unique within the group)"),
            color: z
                .string()
                .describe("Optional hex colour for the category, e.g. #4f46e5")
                .optional(),
        },
        async (args) => {
            try {
                return ok(await postAPI("/api/mcp/categories", apiKey, args));
            } catch (err) {
                return fail(err);
            }
        },
    );

    server.tool(
        "add_contribution",
        "Adds a contribution (credit) into one of your groups' pool. Requires that " +
            "you are an admin (SUPER_ADMIN or ADMIN). Defaults to crediting you; pass " +
            "a member name/email to credit someone else.",
        {
            group: z.string().describe("Group name or group ID to contribute to"),
            amount: z.number().positive().describe("Contribution amount in INR"),
            member: z
                .string()
                .describe("Member name or email to credit (default: you)")
                .optional(),
            description: z.string().describe("Optional note for the contribution").optional(),
        },
        async (args) => {
            try {
                return ok(await postAPI("/api/mcp/contributions", apiKey, args));
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
