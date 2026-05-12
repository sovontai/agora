/**
 * Agora MCP server.
 *
 * Exposes the Agora agent registry as Model Context Protocol tools so any
 * MCP client (Claude Desktop, Cursor, Zed, Continue, …) can search,
 * inspect, and register agents from inside an AI conversation.
 *
 * Configuration via environment:
 *   AGORA_BASE_URL  - registry to talk to (default https://agora.sovont.com)
 *   AGORA_KEY       - API key, enables auth-gated tools (register, verify, ping)
 *
 * The server speaks stdio by default. Most clients run it via npx:
 *
 *   {
 *     "mcpServers": {
 *       "agora": { "command": "npx", "args": ["-y", "@sovont/agora-mcp"] }
 *     }
 *   }
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = (process.env.AGORA_BASE_URL || "https://agora.sovont.com").replace(
  /\/$/,
  ""
);
const API_KEY = process.env.AGORA_KEY;
const VERSION = "0.3.0";
const USER_AGENT = `agora-mcp/${VERSION}`;

type Json = unknown;

async function api<T = Json>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": USER_AGENT,
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (API_KEY) headers["Authorization"] = `Bearer ${API_KEY}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  const text = await res.text();
  let body: any = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* keep raw */
  }
  if (!res.ok) {
    const detail = typeof body === "string" ? body : JSON.stringify(body);
    throw new Error(`Agora API ${res.status}: ${detail}`);
  }
  return body as T;
}

function text(payload: unknown): {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
} {
  const body =
    typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  return { content: [{ type: "text", text: body }] };
}

function error(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

const requireKey = () => {
  if (!API_KEY) {
    return error(
      "This tool requires authentication. Set AGORA_KEY in the MCP server's environment to enable write operations."
    );
  }
  return null;
};

const server = new McpServer(
  {
    name: "agora",
    version: VERSION,
  },
  {
    instructions: `Agora is an open registry for AI agents — "DNS for AI agents."

Use 'search_agents' to find agents by free-text query, category, tag, MCP
tool name, or supported protocol. Verified agents and healthy agents are
boosted automatically.

Use 'get_agent' for full details on one agent (capabilities, MCP tools,
provider, verification status, health).

Use 'list_categories' to browse what people register agents under.

If AGORA_KEY is configured, you can also 'register_agent', 'verify_domain'
(DNS-TXT, like SSL), and 'ping_agent'.

Agora at ${BASE_URL}.`,
  }
);

// ── Read tools ──────────────────────────────────────────────────────────────

server.registerTool(
  "search_agents",
  {
    title: "Search agents",
    description:
      "Search the Agora registry. Combine any of: free-text query, category, tag, MCP tool name, protocol. Results are ranked verified+healthy first.",
    inputSchema: {
      query: z
        .string()
        .optional()
        .describe(
          "Free-text query across name, description, capabilities, MCP tool names."
        ),
      category: z.string().optional().describe("Filter by category slug."),
      tag: z.string().optional().describe("Filter by tag."),
      tool: z
        .string()
        .optional()
        .describe(
          "Filter to agents whose MCP server exposes a tool with this name."
        ),
      protocol: z
        .enum(["a2a", "mcp"])
        .optional()
        .describe("Filter to agents speaking a specific protocol."),
      verified_only: z
        .boolean()
        .optional()
        .describe("If true, only return domain-verified agents."),
      limit: z.number().int().min(1).max(50).optional().describe("Default 10."),
    },
  },
  async (args) => {
    const qs = new URLSearchParams();
    if (args.query) qs.set("q", args.query);
    if (args.category) qs.set("category", args.category);
    if (args.tag) qs.set("tag", args.tag);
    if (args.tool) qs.set("tool", args.tool);
    if (args.protocol) qs.set("protocol", args.protocol);
    if (args.verified_only) qs.set("verified", "true");
    qs.set("limit", String(args.limit ?? 10));

    try {
      const data = await api<any>(`/v1/agents?${qs.toString()}`);
      const agents = (data.agents ?? []).map((a: any) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        url: a.url,
        provider: a.provider?.organization || null,
        protocols: Object.keys(a.protocols || {}).filter((k) => a.protocols[k]),
        categories: a.categories,
        tags: a.tags,
        verified: a.verification?.verified ?? false,
        health: a.health?.status ?? "unknown",
        mcpTools: (a.mcpTools || []).map((t: any) => t.name),
        page: `${BASE_URL}/agents/${a.id}`,
      }));
      return text({
        total: data.total,
        showing: agents.length,
        agents,
      });
    } catch (err: any) {
      return error(err.message);
    }
  }
);

server.registerTool(
  "get_agent",
  {
    title: "Get agent details",
    description:
      "Fetch full details for one agent: capabilities, MCP tools, provider, verification status, health, and the public detail page URL.",
    inputSchema: {
      id: z.string().describe("Agent id (UUID) from search results."),
    },
  },
  async ({ id }) => {
    try {
      const agent = await api<any>(`/v1/agents/${encodeURIComponent(id)}`);
      return text({ ...agent, page: `${BASE_URL}/agents/${id}` });
    } catch (err: any) {
      return error(err.message);
    }
  }
);

server.registerTool(
  "list_categories",
  {
    title: "List categories",
    description: "List all categories currently in the registry with counts.",
    inputSchema: {},
  },
  async () => {
    try {
      const data = await api<any>(`/v1/categories`);
      return text(data.categories);
    } catch (err: any) {
      return error(err.message);
    }
  }
);

server.registerTool(
  "registry_stats",
  {
    title: "Registry stats",
    description:
      "Get registry-wide counts: total agents, verified, A2A, MCP, healthy.",
    inputSchema: {},
  },
  async () => {
    try {
      const data = await api<any>(`/v1/stats`);
      return text({ ...data, instance: BASE_URL });
    } catch (err: any) {
      return error(err.message);
    }
  }
);

// ── Write tools (require AGORA_KEY) ─────────────────────────────────────────

server.registerTool(
  "register_agent",
  {
    title: "Register an agent",
    description:
      "Register a new agent in the registry. Requires AGORA_KEY. Returns the created agent with its page URL.",
    inputSchema: {
      name: z.string().min(1).max(200),
      description: z.string().min(1).max(2000),
      url: z.string().url(),
      version: z.string().optional(),
      categories: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      capabilities: z
        .array(
          z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().optional(),
          })
        )
        .optional(),
      a2a_agent_card_url: z.string().url().optional(),
      mcp_server_url: z.string().url().optional(),
      provider_organization: z.string().optional(),
      provider_url: z.string().url().optional(),
    },
  },
  async (args) => {
    const err0 = requireKey();
    if (err0) return err0;
    const body: any = {
      name: args.name,
      description: args.description,
      url: args.url,
      version: args.version,
      categories: args.categories ?? [],
      tags: args.tags ?? [],
      capabilities: args.capabilities ?? [],
    };
    if (args.a2a_agent_card_url || args.mcp_server_url) {
      body.protocols = {};
      if (args.a2a_agent_card_url)
        body.protocols.a2a = { agentCardUrl: args.a2a_agent_card_url };
      if (args.mcp_server_url)
        body.protocols.mcp = { serverUrl: args.mcp_server_url };
    }
    if (args.provider_organization || args.provider_url) {
      body.provider = {
        organization: args.provider_organization,
        url: args.provider_url,
      };
    }
    try {
      const agent = await api<any>(`/v1/agents`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      return text({ ...agent, page: `${BASE_URL}/agents/${agent.id}` });
    } catch (e: any) {
      return error(e.message);
    }
  }
);

server.registerTool(
  "import_a2a",
  {
    title: "Import an A2A agent card",
    description:
      "Import an agent from its A2A `/.well-known/agent.json`. Idempotent — re-importing updates the existing entry.",
    inputSchema: { url: z.string().url() },
  },
  async ({ url }) => {
    const err0 = requireKey();
    if (err0) return err0;
    try {
      const result = await api<any>(`/v1/import/a2a`, {
        method: "POST",
        body: JSON.stringify({ url }),
      });
      return text(result);
    } catch (e: any) {
      return error(e.message);
    }
  }
);

server.registerTool(
  "verify_domain",
  {
    title: "Initiate domain verification",
    description:
      "Start domain verification for an agent you own. Returns the DNS TXT record to add.",
    inputSchema: {
      id: z.string(),
      domain: z
        .string()
        .describe(
          "The domain to verify (must equal or be a parent/subdomain of the agent URL host)."
        ),
    },
  },
  async ({ id, domain }) => {
    const err0 = requireKey();
    if (err0) return err0;
    try {
      const result = await api<any>(
        `/v1/agents/${encodeURIComponent(id)}/verify`,
        { method: "POST", body: JSON.stringify({ domain }) }
      );
      return text(result);
    } catch (e: any) {
      return error(e.message);
    }
  }
);

server.registerTool(
  "verify_confirm",
  {
    title: "Confirm domain verification",
    description:
      "Confirm a pending verification by re-checking the DNS TXT record.",
    inputSchema: { id: z.string() },
  },
  async ({ id }) => {
    const err0 = requireKey();
    if (err0) return err0;
    try {
      const result = await api<any>(
        `/v1/agents/${encodeURIComponent(id)}/verify/confirm`,
        { method: "POST" }
      );
      return text(result);
    } catch (e: any) {
      return error(e.message);
    }
  }
);

server.registerTool(
  "ping_agent",
  {
    title: "Health-probe an agent",
    description:
      "Probe an agent's URL to check it's reachable. Updates Agora's health state.",
    inputSchema: { id: z.string() },
  },
  async ({ id }) => {
    const err0 = requireKey();
    if (err0) return err0;
    try {
      const result = await api<any>(
        `/v1/agents/${encodeURIComponent(id)}/ping`,
        { method: "POST" }
      );
      return text(result);
    } catch (e: any) {
      return error(e.message);
    }
  }
);

// ── Boot ────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Stderr is fine here; stdout is reserved for the MCP framing.
  process.stderr.write(
    `agora-mcp v${VERSION} connected — backend ${BASE_URL}${
      API_KEY ? " (authenticated)" : " (read-only)"
    }\n`
  );
}

main().catch((err) => {
  process.stderr.write(`agora-mcp fatal: ${err?.stack ?? err}\n`);
  process.exit(1);
});
