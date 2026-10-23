# 🏛️ Agora

**Open Agent Registry & Discovery — DNS for AI agents.**

Agora is an open-source registry where AI agents can be registered, discovered, and connected. Built to complement the [A2A](https://github.com/a2aproject/A2A) and [MCP](https://modelcontextprotocol.io) ecosystems.

## Why

AI agents are proliferating, but they can't find each other. MCP connects agents to tools. A2A lets agents talk to each other. **Agora lets agents discover each other in the first place.**

## Quick Start

Agora is self-hosted: you run your own instance. There's no public hosted registry right now.

```bash
git clone https://github.com/sovontai/agora.git && cd agora
npm install
export ADMIN_KEY=$(openssl rand -hex 24)   # keep this: it mints API keys
npm run dev
# → http://localhost:3340  (UI)
# → http://localhost:3340/v1/docs  (interactive API docs)
```

Set `ADMIN_KEY` before starting — `POST /v1/keys` is fail-closed and requires it. Then mint an API key for writes:

```bash
curl -X POST http://localhost:3340/v1/keys \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "me"}'
# → {"id": "…", "key": "agora_…", …}  use the key as $AGORA_KEY
```

Or run it with Docker. The image keeps its SQLite database at `/data/agora.db`, so mount a volume there:

```bash
docker build -t agora .
docker run -p 3340:3340 -e ADMIN_KEY -v agora-data:/data agora
```

## Use it from Claude, Cursor, Zed, or any MCP client

Agora ships an MCP server in [`mcp/`](mcp/), so your AI assistant can search your registry for you:

> "Find me an agent that parses PDF invoices."

The packages aren't on npm yet, so build the server from this repo:

```bash
cd mcp && npm ci && npm run build
```

Then point your MCP client at the build and at your Agora instance:

```jsonc
// claude_desktop_config.json (or any MCP client)
{
  "mcpServers": {
    "agora": {
      "command": "node",
      "args": ["/path/to/agora/mcp/dist/index.js"],
      "env": { "AGORA_BASE_URL": "http://localhost:3340" }
    }
  }
}
```

## Use it from the CLI

The CLI lives in [`sdk/`](sdk/). Build it, then run it with Node, or `npm link` it to get an `agora` command:

```bash
cd sdk && npm ci && npm run build
export AGORA_BASE_URL=http://localhost:3340   # the default, so optional for a local instance
node dist/cli.js search "invoice parsing"
node dist/cli.js import https://acme.com/.well-known/agent-card.json
```

## API

Browse the full interactive spec at **`/v1/docs`** (Swagger UI) or fetch the raw spec from **`/v1/openapi.json`**.

The examples below assume `AGORA_URL` points at your instance, for example `export AGORA_URL=http://localhost:3340`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/v1/agents` | — | Search & list agents (FTS + filters + ranked) |
| GET | `/v1/agents/:id` | — | Get agent details |
| POST | `/v1/agents` | Bearer | Register an agent |
| PUT | `/v1/agents/:id` | Bearer | Update an agent |
| DELETE | `/v1/agents/:id` | Bearer | Remove an agent |
| POST | `/v1/agents/:id/verify` | Bearer | Start domain verification (must be related to the agent URL) |
| POST | `/v1/agents/:id/verify/confirm` | Bearer | Confirm DNS TXT record |
| POST | `/v1/agents/:id/ping` | Bearer | Health probe an agent |
| POST | `/v1/import/a2a` | Bearer | Import A2A Agent Card (idempotent) |
| GET | `/v1/categories` | — | List categories with counts |
| GET | `/v1/stats` | — | Registry stats (total / verified / A2A / MCP / healthy) |
| GET | `/v1/badge/:id.svg` | — | Verification badge for embedding |
| GET | `/v1/badge/:id/health.svg` | — | Health badge for embedding |
| POST | `/v1/keys` | Admin | Mint API key (requires `ADMIN_KEY` or admin key) |
| POST | `/v1/health/check` | Admin | Trigger health sweep |
| POST | `/v1/health/reverify` | Admin | Re-check every verified agent's TXT record |
| GET | `/.well-known/agora` | — | Instance discovery metadata |
| GET | `/v1/openapi.json` | — | OpenAPI 3.1 spec |

### Search

```bash
# Full-text search across name, description, capabilities, MCP tool names
curl "$AGORA_URL/v1/agents?q=invoice"

# Filter by category, tag, protocol, verified, status
curl "$AGORA_URL/v1/agents?category=finance&protocol=a2a&verified=true"

# Find agents that expose a specific MCP tool
curl "$AGORA_URL/v1/agents?tool=send_email"

# Combine — verified+healthy+a2a results bubble to the top automatically
curl "$AGORA_URL/v1/agents?q=parser&category=finance"
```

Pagination: `?limit=20&offset=0`. Limit is capped at 100. Results are ordered by:
- For text queries: FTS rank, boosted for verified and healthy agents.
- Otherwise: verified first, healthy first, then newest.

### Register an agent

```bash
curl -X POST "$AGORA_URL/v1/agents" \
  -H "Authorization: Bearer $AGORA_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Invoice Parser",
    "description": "Extracts structured data from PDF invoices",
    "url": "https://agents.acme.com/invoice-parser",
    "capabilities": [{"id": "parse-invoice", "name": "Parse Invoice"}],
    "categories": ["finance", "document-processing"],
    "tags": ["invoice", "ocr", "pdf"],
    "protocols": {
      "a2a": {"agentCardUrl": "https://agents.acme.com/.well-known/agent-card.json"},
      "mcp": {"serverUrl": "https://agents.acme.com/mcp"}
    }
  }'
```

If `protocols.mcp.serverUrl` is provided, Agora fetches the server's tool manifest and indexes the tool names so they are searchable.

### Domain verification

```bash
# 1. Initiate
curl -X POST "$AGORA_URL/v1/agents/$ID/verify" \
  -H "Authorization: Bearer $AGORA_KEY" \
  -H "Content-Type: application/json" \
  -d '{"domain": "acme.com"}'

# 2. Add returned TXT to: _agora-verify.acme.com

# 3. Confirm
curl -X POST "$AGORA_URL/v1/agents/$ID/verify/confirm" \
  -H "Authorization: Bearer $AGORA_KEY"
```

The domain must equal, be a parent of, or be a subdomain of the agent URL's host — preventing claims of unrelated domains. The registry re-checks the TXT record every 24 hours; verification automatically drops if the record disappears.

### Verification badge

Embed a "Listed on Agora" badge on your agent's site. Replace `agora.example.com` with your instance's public URL:

```html
<a href="https://agora.example.com/agents/AGENT_ID">
  <img src="https://agora.example.com/v1/badge/AGENT_ID.svg" alt="Listed on Agora"/>
</a>
```

It updates automatically from "registered" → "verified" once your DNS TXT clears.

## TypeScript SDK

The SDK isn't on npm yet. Build it from [`sdk/`](sdk/) and install it into your project from the folder:

```bash
cd sdk && npm ci && npm run build
cd /your/project && npm install /path/to/agora/sdk
```

```ts
import { Agora } from '@sovont/agora';

const baseUrl = 'http://localhost:3340';             // your instance (this is also the default)
const agora = new Agora({ baseUrl });                // anonymous reads
const auth = new Agora({ baseUrl, apiKey: 'agora_…' }); // authenticated writes

const results = await agora.search({ q: 'invoice parsing' });
const tooling = await agora.search({ tool: 'send_email' });
const agent = await agora.get(id);

await auth.register({ name: 'My Agent', description: '…', url: 'https://…' });
const { instructions } = await auth.verify(agent.id, 'acme.com');
console.log(`Add TXT record: ${instructions.record} = ${instructions.value}`);
await auth.verifyConfirm(agent.id);

const badge = auth.badgeUrl(agent.id);  // /v1/badge/<id>.svg
```

See [sdk/README.md](sdk/README.md) for full docs.

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Hono (lightweight, edge-ready)
- **Database:** SQLite (better-sqlite3 + Drizzle ORM) — single-file, scales to 100k+ agents
- **Search:** SQLite FTS5 with safe query escaping + BM25-style ranking
- **Validation:** Zod
- **Tests:** Vitest — 50+ endpoint tests covering CRUD, auth, search, verification, health, import, SSR pages

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `PORT` | `3340` | Server port |
| `HOST` | `0.0.0.0` | Bind address |
| `DATABASE_URL` | `./agora.db` | SQLite database path (use `:memory:` for tests) |
| `ADMIN_KEY` | (unset) | Required to mint API keys via `POST /v1/keys` |
| `RATE_LIMIT` | `60` | Requests/minute per IP for `/v1/*` (set `0` to disable) |

## Web UI

Visit the root URL of any Agora instance. Pages are server-rendered with crawlable agent URLs (`/agents/:id`), Open Graph cards, and JSON-LD `SoftwareApplication` markup — so agents are linkable, shareable, and discoverable by other agents that index the web.

## Operations

Agora runs two background loops:

- **Health sweep** every hour: probes each registered agent's URL (HEAD, falls back to GET). After 24 consecutive failures, an agent is moved to `inactive`. One successful ping returns it to `active`.
- **Re-verification** every 24h: re-checks every previously-verified agent's TXT record. Verification drops automatically if the record disappears.

Both can also be triggered on demand: `POST /v1/health/check` and `POST /v1/health/reverify` (admin auth).

## Distribution & ecosystem

| Package | What it is |
|---------|-----------|
| [`@sovont/agora`](sdk/) | TypeScript SDK + CLI (single install). `import { Agora }` in code; `node sdk/dist/cli.js` (or `agora` after `npm link`) from a terminal. |
| [`@sovont/agora-mcp`](mcp/) | MCP server. Talk to Agora from Claude, Cursor, Zed, Continue. |
| [`sovontai/agora/.github/actions/register`](.github/actions/register/) | GitHub Action to register-on-release. |

Neither package is published to npm yet. Build them from this repo as shown above.

```bash
# CLI, from the repo root, after building sdk/
node sdk/dist/cli.js search "invoice parsing"
node sdk/dist/cli.js stats
node sdk/dist/cli.js import https://acme.com/.well-known/agent-card.json
```

```yaml
# GitHub Action — register your agent on every release
- uses: sovontai/agora/.github/actions/register@main
  with:
    api-key: ${{ secrets.AGORA_KEY }}
    base-url: https://agora.example.com
    agent-card-url: https://acme.com/.well-known/agent-card.json
```

## SEO & crawlability

Every agent page is server-rendered with `<title>`, `<meta description>`, canonical URLs, OG/Twitter cards (with per-agent SVG OG images at `/v1/og/agents/<id>.svg`), and JSON-LD `SoftwareApplication` markup. The registry exposes:

- `/robots.txt` — explicit allow for GPTBot, ClaudeBot, PerplexityBot, Google-Extended, and friends
- `/sitemap.xml` — every agent + category page, regenerated from the DB
- `/llms.txt` — markdown index for LLM crawlers (top categories + sample verified agents)
- `/categories/:slug` — SEO-targeted category landing pages with structured `CollectionPage` data

## Claiming an imported listing

Admins can bulk-import agents from a list of A2A card URLs:

```bash
curl -X POST "$AGORA_URL/v1/import/bulk" \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "urls": [
    "https://a.example.com/.well-known/agent-card.json",
    "https://b.example.com/.well-known/agent-card.json"
  ]}'
```

Imported listings are owned by a `claimable:*` sentinel — the real owner can claim it via DNS-TXT verification, exactly like ACME for SSL. Claiming both takes ownership and marks the agent verified in one step. A fresh API key is returned to the new owner.

```bash
# 1. Begin a claim (anonymous)
curl -X POST "$AGORA_URL/v1/agents/$ID/claim"
# → returns TXT record to add at _agora-verify.<host>

# 2. After DNS propagates
curl -X POST "$AGORA_URL/v1/agents/$ID/claim/confirm"
# → returns { claimed: true, apiKey: { key: "agora_…" } }
```

## Roadmap

- [x] Agent CRUD + full-text search with safe FTS escaping
- [x] DNS-TXT domain verification bound to the agent URL host
- [x] Periodic re-verification + auto-revocation on stale records
- [x] Health sweep with HEAD/GET fallback + auto-deactivation
- [x] A2A Agent Card import (idempotent) + bulk import
- [x] MCP tool manifest fetching + indexed search (`?tool=…`)
- [x] **MCP server** (`@sovont/agora-mcp`) — discover agents from inside Claude/Cursor/Zed
- [x] **TypeScript SDK + CLI** (`@sovont/agora`)
- [x] **GitHub Action** — register-on-release
- [x] Server-rendered agent + category landing pages (OG + JSON-LD)
- [x] OG image generation (per-agent, per-category, site)
- [x] robots.txt + sitemap.xml + llms.txt with AI-crawler allow-list
- [x] Verification + health badge SVGs
- [x] OpenAPI 3.1 spec + Swagger UI at `/v1/docs`
- [x] `.well-known/agora` discovery endpoint
- [x] Rate limiting
- [x] **Claim-your-listing flow** for imported agents
- [ ] Publish `@sovont/agora` and `@sovont/agora-mcp` to npm
- [ ] Public hosted registry
- [ ] Federation (multi-instance sync)
- [ ] Cryptographic agent identity (DID / signed cards)
- [ ] Trust scoring (uptime + verification + curation signals)
- [ ] Postgres backend for federation/scale
- [ ] Moderation / takedown surface
- [ ] Slug-based handles (`@org/agent`)

## License

Apache 2.0. See [LICENSE](LICENSE).

---

Built by [Sovont](https://sovont.com) — AI infrastructure, from power to production.
