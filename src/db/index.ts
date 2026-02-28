import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

const DB_PATH = process.env.DATABASE_URL || "./agora.db";

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// Create FTS5 virtual table for full-text search
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    api_key_hash TEXT NOT NULL,
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
    auth_schemes TEXT DEFAULT '[]',
    verification_domain TEXT,
    verification_token TEXT,
    verified INTEGER NOT NULL DEFAULT 0,
    verified_at TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    last_ping_at TEXT,
    last_ping_status TEXT,
    registered_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    key_hash TEXT NOT NULL UNIQUE,
    name TEXT,
    created_at TEXT NOT NULL,
    last_used_at TEXT
  );
`);

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    slug TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    agent_count INTEGER NOT NULL DEFAULT 0
  );
`);

// FTS5 for full-text search (content-backed)
sqlite.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS agents_fts USING fts5(
    id UNINDEXED,
    name,
    description,
    categories,
    tags,
    capabilities_text,
    tokenize='porter unicode61'
  );
`);

export const db = drizzle(sqlite, { schema });
export { sqlite };
