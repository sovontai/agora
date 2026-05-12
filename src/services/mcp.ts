/**
 * Best-effort fetch of an MCP server's tool manifest.
 *
 * MCP servers expose their tools via JSON-RPC (`tools/list`). Many also expose
 * a static HTTP descriptor at `/.well-known/mcp.json` or return the tool list
 * from a GET on the root URL — we try the cheap HTTP paths first and fall back
 * to JSON-RPC. Anything that fails returns an empty list; this is observational,
 * not authoritative.
 */
export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: any;
}

const FETCH_TIMEOUT_MS = 5_000;

async function fetchJson(url: string, init?: RequestInit): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(init?.headers as Record<string, string> | undefined),
      },
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function normalizeTools(raw: any): McpTool[] {
  const list = Array.isArray(raw) ? raw : raw?.tools ?? raw?.result?.tools ?? [];
  if (!Array.isArray(list)) return [];
  return list
    .filter((t) => t && typeof t.name === "string")
    .map((t) => ({
      name: t.name,
      description: typeof t.description === "string" ? t.description : undefined,
      inputSchema: t.inputSchema ?? t.input_schema ?? undefined,
    }));
}

export async function fetchMcpTools(serverUrl: string): Promise<McpTool[]> {
  const tryUrls: string[] = [];
  try {
    const u = new URL(serverUrl);
    tryUrls.push(`${u.origin}/.well-known/mcp.json`);
    tryUrls.push(`${u.origin}/mcp.json`);
  } catch {
    return [];
  }

  for (const url of tryUrls) {
    try {
      const j = await fetchJson(url);
      const tools = normalizeTools(j);
      if (tools.length) return tools;
    } catch {
      /* try next */
    }
  }

  // JSON-RPC fallback (best-effort).
  try {
    const j = await fetchJson(serverUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }),
    });
    return normalizeTools(j);
  } catch {
    return [];
  }
}
