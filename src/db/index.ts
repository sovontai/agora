import Database from "better-sqlite3";
import type { Database as BetterSqliteDatabase } from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

export type SqliteHandle = BetterSqliteDatabase;

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    owner_key_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    url TEXT NOT NULL,
    version TEXT,
    provider_org TEXT,
    provider_contact TEXT,
    provider_url TEXT,
    capabilities TEXT NOT NULL DEFAULT '[]',
    categories TEXT NOT NULL DEFAULT '[]',
    tags TEXT NOT NULL DEFAULT '[]',
    a2a_agent_card_url TEXT,
    mcp_server_url TEXT,
    mcp_tools TEXT NOT NULL DEFAULT '[]',
    auth_schemes TEXT NOT NULL DEFAULT '[]',
    verification_domain TEXT,
    verification_token TEXT,
    verified INTEGER NOT NULL DEFAULT 0,
    verified_at TEXT,
    verification_checked_at TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    last_ping_at TEXT,
    last_ping_status TEXT,
    consecutive_ping_failures INTEGER NOT NULL DEFAULT 0,
    registered_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    key_hash TEXT NOT NULL UNIQUE,
    name TEXT,
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    last_used_at TEXT
  );

  CREATE TABLE IF NOT EXISTS categories (
    slug TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    agent_count INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_agents_owner ON agents(owner_key_id);
  CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
  CREATE INDEX IF NOT EXISTS idx_agents_a2a ON agents(a2a_agent_card_url) WHERE a2a_agent_card_url IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_agents_mcp ON agents(mcp_server_url) WHERE mcp_server_url IS NOT NULL;
`;

const FTS_SQL = `
  CREATE VIRTUAL TABLE IF NOT EXISTS agents_fts USING fts5(
    id UNINDEXED,
    name,
    description,
    categories,
    tags,
    capabilities_text,
    tool_text,
    tokenize='porter unicode61'
  );
`;

export interface AgoraDb {
  sqlite: Database.Database;
  db: ReturnType<typeof drizzle>;
}

export function createDb(path: string): AgoraDb {
  const sqlite = new Database(path);
  if (path !== ":memory:") {
    sqlite.pragma("journal_mode = WAL");
  }
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(SCHEMA_SQL);
  sqlite.exec(FTS_SQL);
  runMigrations(sqlite);
  const db = drizzle(sqlite, { schema });
  return { sqlite, db };
}

/**
 * Idempotent ALTER TABLE migrations for instances created before later columns existed.
 * Each column add is wrapped in a try/catch since SQLite has no IF NOT EXISTS for ALTER.
 */
function runMigrations(sqlite: Database.Database) {
  const additions: Array<[string, string]> = [
    ["agents", "mcp_tools TEXT NOT NULL DEFAULT '[]'"],
    ["agents", "consecutive_ping_failures INTEGER NOT NULL DEFAULT 0"],
    ["agents", "verification_checked_at TEXT"],
    ["api_keys", "is_admin INTEGER NOT NULL DEFAULT 0"],
  ];
  for (const [table, column] of additions) {
    try {
      sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column}`);
    } catch (e: any) {
      // duplicate column — ignore
      if (!/duplicate column/i.test(e.message ?? "")) throw e;
    }
  }
  // Rename legacy column if it still exists.
  const cols = sqlite
    .prepare("PRAGMA table_info(agents)")
    .all() as Array<{ name: string }>;
  const hasLegacy = cols.some((c) => c.name === "api_key_hash");
  const hasNew = cols.some((c) => c.name === "owner_key_id");
  if (hasLegacy && hasNew) {
    sqlite.exec(
      `UPDATE agents SET owner_key_id = api_key_hash WHERE owner_key_id IS NULL OR owner_key_id = ''`
    );
  } else if (hasLegacy && !hasNew) {
    sqlite.exec(`ALTER TABLE agents RENAME COLUMN api_key_hash TO owner_key_id`);
  }
}

const DB_PATH = process.env.DATABASE_URL || "./agora.db";

const handle = createDb(DB_PATH);
export const db = handle.db;
export const sqlite: SqliteHandle = handle.sqlite;

/** Drop and recreate all tables. Test-only. */
export function resetDb() {
  sqlite.exec(`
    DROP TABLE IF EXISTS agents_fts;
    DROP TABLE IF EXISTS agents;
    DROP TABLE IF EXISTS api_keys;
    DROP TABLE IF EXISTS categories;
  `);
  sqlite.exec(SCHEMA_SQL);
  sqlite.exec(FTS_SQL);
}
