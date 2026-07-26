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
        "Overview across every group you belong to: for each one the group ID, " +
            "name, status, your role and its pool balance, plus a combined " +
            "totalBalance and groupCount. All amounts are INR, ready to use as-is. " +
            "Balance is money left in the group's shared pool — it is NOT what any " +
            "person owes. Arkalyn Kitty tracks no per-person debt figure, so for " +
            "who has put in what, use get_group_details (per-member contribution " +
            "and settled status) or get_my_members. Start here for \"how much is " +
            "left\" or \"what are my groups\"; use get_group_details for one group " +
            "in depth.",
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
        "Individual expense rows across your groups, newest first. Each row has id, " +
            "title, amount (INR), paymentType, date, group, category and paidBy. The " +
            "response echoes the filters actually applied plus a count, so totals you " +
            "compute can be trusted against it. If no limit is given this returns ALL " +
            "matching expenses, so pass from/to, group or category to keep a monthly " +
            "or per-group question narrow rather than fetching a whole history. For " +
            "the audit trail — edits, deletions, joins, contributions — use " +
            "get_group_activity instead; this tool lists only current expenses.",
        {
            limit: z
                .number()
                .int()
                .positive()
                .describe("Max rows to return. Omit for every match — there is no cap.")
                .optional(),
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
                const params = new URLSearchParams();
                if (limit) params.set("limit", String(limit));
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
        "Every member of every group you belong to, as flat rows: group name, group " +
            "ID, member name, role (SUPER_ADMIN, ADMIN or MEMBER) and that member's " +
            "contribution in INR. Spans all your groups at once — use this to find " +
            "someone by name or to compare rosters. For one group only, with " +
            "settlement and pending-leave status included, use get_group_details.",
        async () => {
            try {
                return ok(await callAPI("/api/mcp/members", apiKey));
            } catch (err) {
                return fail(err);
            }
        },
    );

    server.tool(
        "get_group_details",
        "One group's full profile: name, groupId, purpose, groupType (POOL or SPLIT), " +
            "status (ACTIVE, INACTIVE or CLOSED), createdAt, createdBy, balance and " +
            "totalContribution in INR, memberCount, an admins name list, and the " +
            "roster with each member's role, contribution, settled flag and whether " +
            "they have requested to leave. Use this for \"tell me about this group\", " +
            "\"who are the admins\", \"when was it created\" or \"has X settled\". " +
            "Groups have no free-text description field — purpose (FAMILY, FRIENDS, " +
            "ROOMMATES, TEAM, OTHER) is the nearest equivalent, so do not invent one. " +
            "Note INACTIVE is a third state between ACTIVE and CLOSED.",
        {
            group: z
                .string()
                .describe(
                    "Group name or group ID, case-insensitive and partial. An exact " +
                        "name or ID beats a partial match; a fragment matching several " +
                        "of your groups returns an error listing them, which is the " +
                        "moment to ask which one was meant.",
                ),
        },
        async ({ group }) => {
            try {
                const params = new URLSearchParams({ group });
                return ok(await callAPI(`/api/mcp/group?${params}`, apiKey));
            } catch (err) {
                return fail(err);
            }
        },
    );

    server.tool(
        "get_group_activity",
        "One group's audit history, newest first. Each entry is { when, kind, who, " +
            "target, what, amount }: 'who' is the person who performed it, 'target' " +
            "the person it was done to (member and role changes only, otherwise null), " +
            "'what' a ready-to-read summary, 'amount' INR or null. Answers \"what " +
            "changed\", \"who joined\", \"who was removed\", \"what happened in July\". " +
            "Two quirks to rely on rather than guess around: deleting an expense is " +
            "recorded as kind 'refund', never a delete event; and category create, " +
            "update and delete all arrive as 'category_changed' with the specifics in " +
            "'what'. If no limit is given, returns everything in the visible window. " +
            "That window depends on the group OWNER's plan, not yours — always check " +
            "the response's 'retention' field before saying nothing happened, because " +
            "an empty result may simply predate what the plan can show.",
        {
            group: z
                .string()
                .describe(
                    "Group name or group ID, case-insensitive and partial. Ambiguous " +
                        "fragments return an error naming the candidate groups.",
                ),
            limit: z
                .number()
                .int()
                .positive()
                .describe("Max entries to return. Omit for the whole window — there is no cap.")
                .optional(),
            from: z
                .string()
                .describe("Only entries on/after this date (ISO 8601, e.g. 2026-01-01)")
                .optional(),
            to: z
                .string()
                .describe("Only entries on/before this date (ISO 8601, e.g. 2026-01-31)")
                .optional(),
            kind: z
                .enum([
                    "member_added",
                    "member_removed",
                    "role_changed",
                    "category_changed",
                    "group_created",
                    "group_closed",
                    "credit_removed",
                    "expense_edited",
                    "contribution",
                    "expense_added",
                    "refund",
                ])
                .describe(
                    "Return only this kind. Use 'refund' for expense deletions, " +
                        "'expense_added' for new expense ledger entries, 'contribution' " +
                        "for money paid into the pool, 'category_changed' for any " +
                        "category create/update/delete.",
                )
                .optional(),
        },
        async ({ group, limit, from, to, kind }) => {
            try {
                const params = new URLSearchParams({ group });
                if (limit) params.set("limit", String(limit));
                if (from) params.set("from", from);
                if (to) params.set("to", to);
                if (kind) params.set("kind", kind);
                return ok(await callAPI(`/api/mcp/group/activity?${params}`, apiKey));
            } catch (err) {
                return fail(err);
            }
        },
    );

    server.tool(
        "get_my_subscription",
        "Your effective plan: tier, planName, status (active, grace or expired), " +
            "renewalDate (null on FREE, which never renews) and isReadOnly. Note tier " +
            "is the EFFECTIVE tier — once a paid plan is past its grace period it " +
            "reverts to FREE and isReadOnly turns true, which is why a group that " +
            "previously allowed more members or categories can start rejecting writes " +
            "on FREE limits. Check this when a write fails with a limit error. Caveat: " +
            "get_group_activity's history window follows the group OWNER's plan, not " +
            "yours, so this tool does not predict it for groups you did not create.",
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
        "Records one expense in a group, deducting it from that group's pool balance. " +
            "Any member can do this — no admin role needed. Defaults: paidBy = you, " +
            "paymentType = Cash, date = today, so only group, title, amount and " +
            "category are actually required. The category is matched " +
            "case-insensitively, exact name first then partial. Fails if: no such " +
            "category exists in that group (call add_category first) or a partial name " +
            "matches several, the amount exceeds the group's remaining pool balance, or " +
            "the group is CLOSED. Each call creates a new expense, so do not retry one " +
            "that already succeeded — check with get_my_expenses first.",
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
        "Creates a new expense category in a group, so add_expense can then use it. " +
            "Requires that you are SUPER_ADMIN or ADMIN of that group — a plain MEMBER " +
            "cannot. Fails if the name already exists in the group, if the group has " +
            "hit its plan's category cap (FREE allows 10), or if the group is CLOSED. " +
            "Check the existing categories via get_group_details before creating a " +
            "near-duplicate like \"Food\" alongside \"Foods\".",
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
        "Pays money INTO a group's shared pool, increasing its balance and the " +
            "crediting member's recorded contribution. This is the opposite of " +
            "add_expense — use it for \"I put in 500\", not for a purchase. Requires " +
            "SUPER_ADMIN or ADMIN. Defaults to crediting you; pass a member name or " +
            "email to credit someone else. Fails if the group is CLOSED, and each call " +
            "adds a separate credit, so do not repeat one that already succeeded.",
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
