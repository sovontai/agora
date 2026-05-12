import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const agents = sqliteTable(
  "agents",
  {
    id: text("id").primaryKey(),
    /** API key row id that owns this agent. */
    ownerKeyId: text("owner_key_id").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    url: text("url").notNull(),
    version: text("version"),

    // Provider info
    providerOrg: text("provider_org"),
    providerContact: text("provider_contact"),
    providerUrl: text("provider_url"),

    // Capabilities stored as JSON
    capabilities: text("capabilities").notNull().default("[]"),

    // Categories and tags stored as JSON arrays
    categories: text("categories").notNull().default("[]"),
    tags: text("tags").notNull().default("[]"),

    // Protocol support
    a2aAgentCardUrl: text("a2a_agent_card_url"),
    mcpServerUrl: text("mcp_server_url"),
    /** Cached MCP tools manifest, JSON array. */
    mcpTools: text("mcp_tools").notNull().default("[]"),

    // Auth schemes supported by the agent
    authSchemes: text("auth_schemes").notNull().default("[]"),

    // Verification
    verificationDomain: text("verification_domain"),
    verificationToken: text("verification_token"),
    verified: integer("verified", { mode: "boolean" }).notNull().default(false),
    verifiedAt: text("verified_at"),
    verificationCheckedAt: text("verification_checked_at"),

    // Status & health
    status: text("status").notNull().default("active"),
    lastPingAt: text("last_ping_at"),
    lastPingStatus: text("last_ping_status"),
    consecutivePingFailures: integer("consecutive_ping_failures")
      .notNull()
      .default(0),

    // Timestamps
    registeredAt: text("registered_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    ownerIdx: index("idx_agents_owner").on(t.ownerKeyId),
    statusIdx: index("idx_agents_status").on(t.status),
  })
);

export const apiKeys = sqliteTable("api_keys", {
  id: text("id").primaryKey(),
  keyHash: text("key_hash").notNull().unique(),
  name: text("name"),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
  lastUsedAt: text("last_used_at"),
});

export const categories = sqliteTable("categories", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  agentCount: integer("agent_count").notNull().default(0),
});
