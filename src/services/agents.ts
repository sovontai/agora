import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";
import { db, sqlite } from "../db/index.js";
import { agents } from "../db/schema.js";
import type {
  RegisterAgentInput,
  UpdateAgentInput,
  SearchParams,
} from "../types/index.js";
import { fetchMcpTools } from "./mcp.js";

function capabilitiesText(caps: any[]): string {
  return caps.map((c) => `${c.name} ${c.description || ""}`).join(" ");
}

function toolsText(tools: any[]): string {
  return tools
    .map((t) => `${t.name || ""} ${t.description || ""}`)
    .join(" ")
    .trim();
}

/**
 * Convert a user search string into a safe FTS5 MATCH query.
 * Every token is treated as a phrase, so arbitrary characters in the user
 * input cannot execute FTS5 operators. Empty input returns null.
 */
export function escapeFtsQuery(q: string): string | null {
  const tokens = q
    .split(/[^\p{L}\p{N}_-]+/u)
    .map((t) => t.trim())
    .filter(Boolean);
  if (tokens.length === 0) return null;
  return tokens.map((t) => `"${t.replace(/"/g, '""')}"*`).join(" ");
}

function indexFts(
  id: string,
  data: {
    name: string;
    description: string;
    categories: string[];
    tags: string[];
    capabilities: any[];
    mcpTools?: any[];
  }
) {
  sqlite.prepare(`DELETE FROM agents_fts WHERE id = ?`).run(id);
  sqlite
    .prepare(
      `INSERT INTO agents_fts (id, name, description, categories, tags, capabilities_text, tool_text)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      data.name,
      data.description,
      data.categories.join(" "),
      data.tags.join(" "),
      capabilitiesText(data.capabilities),
      toolsText(data.mcpTools ?? [])
    );
}

export async function createAgent(input: RegisterAgentInput, ownerKeyId: string) {
  const id = uuidv4();
  const now = new Date().toISOString();

  // Best-effort fetch of MCP tools, non-fatal.
  let mcpTools: any[] = [];
  if (input.protocols?.mcp?.serverUrl) {
    try {
      mcpTools = await fetchMcpTools(input.protocols.mcp.serverUrl);
    } catch {
      mcpTools = [];
    }
  }

  const record = {
    id,
    ownerKeyId,
    name: input.name,
    description: input.description,
    url: input.url,
    version: input.version ?? null,
    providerOrg: input.provider?.organization ?? null,
    providerContact: input.provider?.contact ?? null,
    providerUrl: input.provider?.url ?? null,
    capabilities: JSON.stringify(input.capabilities ?? []),
    categories: JSON.stringify(input.categories ?? []),
    tags: JSON.stringify(input.tags ?? []),
    a2aAgentCardUrl: input.protocols?.a2a?.agentCardUrl ?? null,
    mcpServerUrl: input.protocols?.mcp?.serverUrl ?? null,
    mcpTools: JSON.stringify(mcpTools),
    authSchemes: JSON.stringify(input.authSchemes ?? []),
    registeredAt: now,
    updatedAt: now,
  };

  await db.insert(agents).values(record);
  indexFts(id, {
    name: input.name,
    description: input.description,
    categories: input.categories ?? [],
    tags: input.tags ?? [],
    capabilities: input.capabilities ?? [],
    mcpTools,
  });

  return formatAgent({ ...record, verified: false, status: "active" });
}

export async function getAgent(id: string) {
  const [agent] = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
  if (!agent) return null;
  return formatAgent(agent);
}

/** Find a previously-imported A2A agent owned by this key. Used for idempotent imports. */
export async function findByA2aSource(ownerKeyId: string, agentCardUrl: string) {
  const row = sqlite
    .prepare(
      `SELECT * FROM agents WHERE owner_key_id = ? AND a2a_agent_card_url = ? LIMIT 1`
    )
    .get(ownerKeyId, agentCardUrl) as any;
  return row ? formatAgent(row) : null;
}

export async function updateAgent(
  id: string,
  input: UpdateAgentInput,
  ownerKeyId: string
) {
  const [existing] = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
  if (!existing) return null;
  if (existing.ownerKeyId !== ownerKeyId) return { error: "forbidden" as const };

  const updates: Record<string, any> = { updatedAt: new Date().toISOString() };

  if (input.name !== undefined) updates.name = input.name;
  if (input.description !== undefined) updates.description = input.description;
  if (input.url !== undefined) {
    updates.url = input.url;
    // URL change invalidates any prior domain verification.
    if (input.url !== existing.url) {
      updates.verified = false;
      updates.verifiedAt = null;
      updates.verificationToken = null;
      updates.verificationDomain = null;
      updates.verificationCheckedAt = null;
    }
  }
  if (input.version !== undefined) updates.version = input.version;
  if (input.provider?.organization !== undefined)
    updates.providerOrg = input.provider.organization;
  if (input.provider?.contact !== undefined)
    updates.providerContact = input.provider.contact;
  if (input.provider?.url !== undefined) updates.providerUrl = input.provider.url;
  if (input.capabilities !== undefined)
    updates.capabilities = JSON.stringify(input.capabilities);
  if (input.categories !== undefined)
    updates.categories = JSON.stringify(input.categories);
  if (input.tags !== undefined) updates.tags = JSON.stringify(input.tags);
  if (input.protocols?.a2a?.agentCardUrl !== undefined)
    updates.a2aAgentCardUrl = input.protocols.a2a.agentCardUrl;

  // Refresh MCP tools whenever the MCP URL changes.
  let nextMcpTools: any[] | null = null;
  if (input.protocols?.mcp?.serverUrl !== undefined) {
    updates.mcpServerUrl = input.protocols.mcp.serverUrl;
    if (
      input.protocols.mcp.serverUrl &&
      input.protocols.mcp.serverUrl !== existing.mcpServerUrl
    ) {
      try {
        nextMcpTools = await fetchMcpTools(input.protocols.mcp.serverUrl);
      } catch {
        nextMcpTools = [];
      }
      updates.mcpTools = JSON.stringify(nextMcpTools);
    }
  }

  if (input.authSchemes !== undefined)
    updates.authSchemes = JSON.stringify(input.authSchemes);

  await db.update(agents).set(updates).where(eq(agents.id, id));

  const merged = { ...existing, ...updates };
  indexFts(id, {
    name: merged.name,
    description: merged.description,
    categories: JSON.parse(merged.categories),
    tags: JSON.parse(merged.tags),
    capabilities: JSON.parse(merged.capabilities),
    mcpTools: nextMcpTools ?? JSON.parse(merged.mcpTools ?? "[]"),
  });

  return formatAgent(merged);
}

export async function deleteAgent(id: string, ownerKeyId: string) {
  const [existing] = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
  if (!existing) return null;
  if (existing.ownerKeyId !== ownerKeyId) return { error: "forbidden" as const };

  await db.delete(agents).where(eq(agents.id, id));
  sqlite.prepare(`DELETE FROM agents_fts WHERE id = ?`).run(id);
  return true;
}

export async function searchAgents(params: SearchParams) {
  const bindings: any[] = [];
  const conditions: string[] = [];

  let ftsMatch: string | null = null;
  if (params.q) {
    ftsMatch = escapeFtsQuery(params.q);
    if (ftsMatch) {
      conditions.push(
        `agents.id IN (SELECT id FROM agents_fts WHERE agents_fts MATCH ?)`
      );
      bindings.push(ftsMatch);
    }
  }

  if (params.category) {
    conditions.push(
      `EXISTS (SELECT 1 FROM json_each(agents.categories) WHERE json_each.value = ?)`
    );
    bindings.push(params.category);
  }

  if (params.tag) {
    conditions.push(
      `EXISTS (SELECT 1 FROM json_each(agents.tags) WHERE json_each.value = ?)`
    );
    bindings.push(params.tag);
  }

  if (params.tool) {
    conditions.push(
      `EXISTS (SELECT 1 FROM json_each(agents.mcp_tools) AS t WHERE LOWER(json_extract(t.value, '$.name')) = LOWER(?))`
    );
    bindings.push(params.tool);
  }

  if (params.protocol === "a2a") {
    conditions.push(`agents.a2a_agent_card_url IS NOT NULL`);
  } else if (params.protocol === "mcp") {
    conditions.push(`agents.mcp_server_url IS NOT NULL`);
  }

  if (params.verified !== undefined) {
    conditions.push(`agents.verified = ?`);
    bindings.push(params.verified ? 1 : 0);
  }

  if (params.status) {
    conditions.push(`agents.status = ?`);
    bindings.push(params.status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Ranking:
  //  - if FTS query, sort by FTS rank ascending (lower = better) with a boost for
  //    verified/healthy agents
  //  - otherwise, sort by (verified DESC, healthy DESC, registered_at DESC)
  let select: string;
  let orderBy: string;
  if (ftsMatch) {
    select = `agents.*,
      (SELECT rank FROM agents_fts WHERE agents_fts.id = agents.id AND agents_fts MATCH ?) AS fts_rank`;
    bindings.unshift(ftsMatch);
    orderBy = `ORDER BY
      (CASE WHEN agents.verified = 1 THEN -1 ELSE 0 END) +
      (CASE WHEN agents.last_ping_status LIKE 'healthy%' THEN -0.5 ELSE 0 END) +
      fts_rank ASC,
      agents.registered_at DESC`;
  } else {
    select = `agents.*`;
    orderBy = `ORDER BY agents.verified DESC,
      (CASE WHEN agents.last_ping_status LIKE 'healthy%' THEN 1 ELSE 0 END) DESC,
      agents.registered_at DESC`;
  }

  let query = `SELECT ${select} FROM agents ${where} ${orderBy} LIMIT ? OFFSET ?`;

  // Count bindings should match the WHERE-only bindings (no FTS rank).
  const whereBindings = bindings.slice(ftsMatch ? 1 : 0);
  const countQuery = `SELECT COUNT(*) as total FROM agents ${where}`;
  const countResult = sqlite.prepare(countQuery).get(...whereBindings) as any;
  const total = countResult?.total ?? 0;

  bindings.push(params.limit, params.offset);
  const rows = sqlite.prepare(query).all(...bindings) as any[];

  return {
    agents: rows.map(formatAgent),
    total,
    limit: params.limit,
    offset: params.offset,
  };
}

export async function getStats() {
  const totals = sqlite
    .prepare(
      `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN verified = 1 THEN 1 ELSE 0 END) AS verified,
        SUM(CASE WHEN a2a_agent_card_url IS NOT NULL THEN 1 ELSE 0 END) AS a2a,
        SUM(CASE WHEN mcp_server_url IS NOT NULL THEN 1 ELSE 0 END) AS mcp,
        SUM(CASE WHEN last_ping_status LIKE 'healthy%' THEN 1 ELSE 0 END) AS healthy
       FROM agents`
    )
    .get() as any;

  return {
    totalAgents: totals?.total ?? 0,
    verifiedAgents: totals?.verified ?? 0,
    a2aAgents: totals?.a2a ?? 0,
    mcpAgents: totals?.mcp ?? 0,
    healthyAgents: totals?.healthy ?? 0,
  };
}

function safeParse<T>(s: any, fallback: T): T {
  if (Array.isArray(s) || typeof s === "object") return s as T;
  if (typeof s !== "string") return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

/** Public agent shape. Accepts either Drizzle-cased or snake_case raw rows. */
export function formatAgent(a: any) {
  const a2a = a.a2aAgentCardUrl ?? a.a2a_agent_card_url ?? null;
  const mcp = a.mcpServerUrl ?? a.mcp_server_url ?? null;
  return {
    id: a.id,
    name: a.name,
    description: a.description,
    url: a.url,
    version: a.version ?? null,
    provider: {
      organization: a.providerOrg ?? a.provider_org ?? null,
      contact: a.providerContact ?? a.provider_contact ?? null,
      url: a.providerUrl ?? a.provider_url ?? null,
    },
    capabilities: safeParse(a.capabilities, []),
    categories: safeParse(a.categories, []),
    tags: safeParse(a.tags, []),
    protocols: {
      a2a: a2a ? { agentCardUrl: a2a } : null,
      mcp: mcp ? { serverUrl: mcp } : null,
    },
    mcpTools: safeParse(a.mcpTools ?? a.mcp_tools, []),
    authSchemes: safeParse(a.authSchemes ?? a.auth_schemes, []),
    verification: {
      domain: a.verificationDomain ?? a.verification_domain ?? null,
      verified: Boolean(a.verified),
      verifiedAt: a.verifiedAt ?? a.verified_at ?? null,
      checkedAt: a.verificationCheckedAt ?? a.verification_checked_at ?? null,
    },
    health: {
      status: a.lastPingStatus ?? a.last_ping_status ?? null,
      checkedAt: a.lastPingAt ?? a.last_ping_at ?? null,
      consecutiveFailures:
        a.consecutivePingFailures ?? a.consecutive_ping_failures ?? 0,
    },
    status: a.status,
    registeredAt: a.registeredAt ?? a.registered_at,
    updatedAt: a.updatedAt ?? a.updated_at,
  };
}
