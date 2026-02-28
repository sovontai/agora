import { v4 as uuidv4 } from "uuid";
import { eq, and, sql } from "drizzle-orm";
import { db, sqlite } from "../db/index.js";
import { agents } from "../db/schema.js";
import type { RegisterAgentInput, UpdateAgentInput, SearchParams } from "../types/index.js";
import { hashKey } from "../middleware/auth.js";

function capabilitiesText(caps: any[]): string {
  return caps.map((c) => `${c.name} ${c.description || ""}`).join(" ");
}

function indexFts(id: string, data: {
  name: string;
  description: string;
  categories: string[];
  tags: string[];
  capabilities: any[];
}) {
  // Remove old entry
  sqlite.exec(`DELETE FROM agents_fts WHERE id = '${id}'`);
  // Insert new
  const stmt = sqlite.prepare(
    `INSERT INTO agents_fts (id, name, description, categories, tags, capabilities_text) VALUES (?, ?, ?, ?, ?, ?)`
  );
  stmt.run(
    id,
    data.name,
    data.description,
    data.categories.join(" "),
    data.tags.join(" "),
    capabilitiesText(data.capabilities)
  );
}

export async function createAgent(input: RegisterAgentInput, apiKeyId: string) {
  const id = uuidv4();
  const now = new Date().toISOString();

  const record = {
    id,
    apiKeyHash: apiKeyId,
    name: input.name,
    description: input.description,
    url: input.url,
    version: input.version || null,
    providerOrg: input.provider?.organization || null,
    providerContact: input.provider?.contact || null,
    providerUrl: input.provider?.url || null,
    capabilities: JSON.stringify(input.capabilities),
    categories: JSON.stringify(input.categories),
    tags: JSON.stringify(input.tags),
    a2aAgentCardUrl: input.protocols?.a2a?.agentCardUrl || null,
    mcpServerUrl: input.protocols?.mcp?.serverUrl || null,
    authSchemes: JSON.stringify(input.authSchemes || []),
    registeredAt: now,
    updatedAt: now,
  };

  await db.insert(agents).values(record);

  indexFts(id, {
    name: input.name,
    description: input.description,
    categories: input.categories,
    tags: input.tags,
    capabilities: input.capabilities,
  });

  return formatAgent(record);
}

export async function getAgent(id: string) {
  const [agent] = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
  if (!agent) return null;
  return formatAgent(agent);
}

export async function updateAgent(id: string, input: UpdateAgentInput, apiKeyId: string) {
  const [existing] = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
  if (!existing) return null;
  if (existing.apiKeyHash !== apiKeyId) return { error: "forbidden" };

  const updates: Record<string, any> = { updatedAt: new Date().toISOString() };

  if (input.name !== undefined) updates.name = input.name;
  if (input.description !== undefined) updates.description = input.description;
  if (input.url !== undefined) updates.url = input.url;
  if (input.version !== undefined) updates.version = input.version;
  if (input.provider?.organization !== undefined) updates.providerOrg = input.provider.organization;
  if (input.provider?.contact !== undefined) updates.providerContact = input.provider.contact;
  if (input.provider?.url !== undefined) updates.providerUrl = input.provider.url;
  if (input.capabilities !== undefined) updates.capabilities = JSON.stringify(input.capabilities);
  if (input.categories !== undefined) updates.categories = JSON.stringify(input.categories);
  if (input.tags !== undefined) updates.tags = JSON.stringify(input.tags);
  if (input.protocols?.a2a?.agentCardUrl !== undefined) updates.a2aAgentCardUrl = input.protocols.a2a.agentCardUrl;
  if (input.protocols?.mcp?.serverUrl !== undefined) updates.mcpServerUrl = input.protocols.mcp.serverUrl;
  if (input.authSchemes !== undefined) updates.authSchemes = JSON.stringify(input.authSchemes);

  await db.update(agents).set(updates).where(eq(agents.id, id));

  const merged = { ...existing, ...updates };
  indexFts(id, {
    name: merged.name,
    description: merged.description,
    categories: JSON.parse(merged.categories),
    tags: JSON.parse(merged.tags),
    capabilities: JSON.parse(merged.capabilities),
  });

  return formatAgent(merged);
}

export async function deleteAgent(id: string, apiKeyId: string) {
  const [existing] = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
  if (!existing) return null;
  if (existing.apiKeyHash !== apiKeyId) return { error: "forbidden" };

  await db.delete(agents).where(eq(agents.id, id));
  sqlite.exec(`DELETE FROM agents_fts WHERE id = '${id}'`);
  return true;
}

export async function searchAgents(params: SearchParams) {
  let query: string;
  const bindings: any[] = [];

  const conditions: string[] = [];

  if (params.q) {
    // Get matching IDs from FTS
    conditions.push(`id IN (SELECT id FROM agents_fts WHERE agents_fts MATCH ?)`);
    bindings.push(params.q);
  }

  if (params.category) {
    conditions.push(`EXISTS (SELECT 1 FROM json_each(agents.categories) WHERE json_each.value = ?)`);
    bindings.push(params.category);
  }

  if (params.tag) {
    conditions.push(`EXISTS (SELECT 1 FROM json_each(agents.tags) WHERE json_each.value = ?)`);
    bindings.push(params.tag);
  }

  if (params.protocol === "a2a") {
    conditions.push(`a2a_agent_card_url IS NOT NULL`);
  } else if (params.protocol === "mcp") {
    conditions.push(`mcp_server_url IS NOT NULL`);
  }

  if (params.verified !== undefined) {
    conditions.push(`verified = ?`);
    bindings.push(params.verified ? 1 : 0);
  }

  if (params.status) {
    conditions.push(`status = ?`);
    bindings.push(params.status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  query = `SELECT * FROM agents ${where}`;

  // Count total
  const countQuery = `SELECT COUNT(*) as total FROM agents ${where}`;
  const countResult = sqlite.prepare(countQuery).get(...bindings) as any;
  const total = countResult?.total || 0;

  query += ` ORDER BY registered_at DESC LIMIT ? OFFSET ?`;
  bindings.push(params.limit, params.offset);

  const rows = sqlite.prepare(query).all(...bindings) as any[];

  return {
    agents: rows.map(formatAgentRow),
    total,
    limit: params.limit,
    offset: params.offset,
  };
}

export async function getStats() {
  const totalResult = sqlite.prepare("SELECT COUNT(*) as total FROM agents").get() as any;
  const verifiedResult = sqlite.prepare("SELECT COUNT(*) as total FROM agents WHERE verified = 1").get() as any;
  const a2aResult = sqlite.prepare("SELECT COUNT(*) as total FROM agents WHERE a2a_agent_card_url IS NOT NULL").get() as any;
  const mcpResult = sqlite.prepare("SELECT COUNT(*) as total FROM agents WHERE mcp_server_url IS NOT NULL").get() as any;

  return {
    totalAgents: totalResult.total,
    verifiedAgents: verifiedResult.total,
    a2aAgents: a2aResult.total,
    mcpAgents: mcpResult.total,
  };
}

function formatAgent(a: any) {
  return {
    id: a.id,
    name: a.name,
    description: a.description,
    url: a.url,
    version: a.version,
    provider: {
      organization: a.providerOrg || a.provider_org,
      contact: a.providerContact || a.provider_contact,
      url: a.providerUrl || a.provider_url,
    },
    capabilities: JSON.parse(typeof a.capabilities === "string" ? a.capabilities : "[]"),
    categories: JSON.parse(typeof a.categories === "string" ? a.categories : "[]"),
    tags: JSON.parse(typeof a.tags === "string" ? a.tags : "[]"),
    protocols: {
      a2a: (a.a2aAgentCardUrl || a.a2a_agent_card_url) ? { agentCardUrl: a.a2aAgentCardUrl || a.a2a_agent_card_url } : null,
      mcp: (a.mcpServerUrl || a.mcp_server_url) ? { serverUrl: a.mcpServerUrl || a.mcp_server_url } : null,
    },
    authSchemes: JSON.parse(typeof a.authSchemes === "string" ? a.authSchemes : (typeof a.auth_schemes === "string" ? a.auth_schemes : "[]")),
    verification: {
      domain: a.verificationDomain || a.verification_domain,
      verified: Boolean(a.verified),
      verifiedAt: a.verifiedAt || a.verified_at,
    },
    status: a.status,
    registeredAt: a.registeredAt || a.registered_at,
    updatedAt: a.updatedAt || a.updated_at,
  };
}

function formatAgentRow(row: any) {
  return formatAgent(row);
}
