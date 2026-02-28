import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  apiKeyHash: text("api_key_hash").notNull(),
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

  // Auth schemes supported by the agent
  authSchemes: text("auth_schemes").default("[]"),

  // Verification
  verificationDomain: text("verification_domain"),
  verificationToken: text("verification_token"),
  verified: integer("verified", { mode: "boolean" }).notNull().default(false),
  verifiedAt: text("verified_at"),

  // Status & health
  status: text("status").notNull().default("active"),
  lastPingAt: text("last_ping_at"),
  lastPingStatus: text("last_ping_status"),

  // Timestamps
  registeredAt: text("registered_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const apiKeys = sqliteTable("api_keys", {
  id: text("id").primaryKey(),
  keyHash: text("key_hash").notNull().unique(),
  name: text("name"),
  createdAt: text("created_at").notNull(),
  lastUsedAt: text("last_used_at"),
});

export const categories = sqliteTable("categories", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  agentCount: integer("agent_count").notNull().default(0),
});
