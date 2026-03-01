# 🏛️ Agora

**Open Agent Registry & Discovery — DNS for AI agents.**

Agora is an open-source registry where AI agents can be registered, discovered, and connected. Built to complement the [A2A](https://github.com/a2aproject/A2A) and [MCP](https://modelcontextprotocol.io) ecosystems.

## Why

AI agents are proliferating, but they can't find each other. MCP connects agents to tools. A2A lets agents talk to each other. **Agora lets agents discover each other in the first place.**

## Quick Start

**Hosted instance:** [agora.sovont.com](https://agora.sovont.com)

```bash
# Self-host: install & run
npm install
npm run dev
# → http://localhost:3340
```

## API

### Create an API Key
```bash
curl -X POST http://localhost:3340/v1/keys \
  -H "Content-Type: application/json" \
  -d '{"name": "my-app"}'
```

### Register an Agent
```bash
curl -X POST http://localhost:3340/v1/agents \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Invoice Parser Agent",
    "description": "Extracts structured data from PDF invoices",
    "url": "https://agents.acme.com/invoice-parser",
    "capabilities": [{"id": "parse-invoice", "name": "Parse Invoice"}],
    "categories": ["finance", "document-processing"],
    "tags": ["invoice", "ocr", "pdf"],
    "protocols": {
      "a2a": {"agentCardUrl": "https://agents.acme.com/.well-known/agent.json"}
    }
  }'
```

### Search Agents
```bash
# Full-text search
curl "http://localhost:3340/v1/agents?q=invoice"

# Filter by category
curl "http://localhost:3340/v1/agents?category=finance"

# Filter by protocol support
curl "http://localhost:3340/v1/agents?protocol=a2a"

# Only verified agents
curl "http://localhost:3340/v1/agents?verified=true"

# Combine filters
curl "http://localhost:3340/v1/agents?q=parser&category=finance&verified=true"
```

### Domain Verification
Prove ownership of your agent's domain via DNS TXT record:

```bash
# 1. Initiate verification
curl -X POST http://localhost:3340/v1/agents/:id/verify \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"domain": "agents.acme.com"}'

# 2. Add the returned TXT record to: _agora-verify.agents.acme.com

# 3. Confirm
curl -X POST http://localhost:3340/v1/agents/:id/verify/confirm \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Health Check
```bash
curl -X POST http://localhost:3340/v1/agents/:id/ping \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Stats
```bash
curl http://localhost:3340/v1/stats
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/v1/agents` | No | Search & list agents |
| GET | `/v1/agents/:id` | No | Get agent details |
| POST | `/v1/agents` | Yes | Register an agent |
| PUT | `/v1/agents/:id` | Yes | Update an agent |
| DELETE | `/v1/agents/:id` | Yes | Remove an agent |
| POST | `/v1/agents/:id/verify` | Yes | Start domain verification |
| POST | `/v1/agents/:id/verify/confirm` | Yes | Confirm domain verification |
| POST | `/v1/agents/:id/ping` | Yes | Health check an agent |
| POST | `/v1/keys` | Admin | Create API key |
| GET | `/v1/stats` | No | Registry statistics |

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Hono
- **Database:** SQLite (via better-sqlite3 + Drizzle ORM)
- **Search:** SQLite FTS5
- **Validation:** Zod

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `PORT` | `3340` | Server port |
| `HOST` | `0.0.0.0` | Bind address |
| `DATABASE_URL` | `./agora.db` | SQLite database path |
| `ADMIN_KEY` | (none) | Admin key for key creation (open if unset) |

## Web UI

Visit the root URL of any Agora instance to browse and search agents with a visual interface.

## TypeScript SDK

```bash
npm install @sovont/agora
```

```ts
import { Agora } from '@sovont/agora';

const agora = new Agora(); // uses hosted instance by default

// Search agents (no auth needed)
const results = await agora.search({ q: 'invoice parsing' });

// Register (needs API key)
const authed = new Agora({ apiKey: 'your-key' });
await authed.register({ name: 'My Agent', description: '...', url: 'https://...' });

// Import A2A Agent Card
await authed.importA2A('https://example.com/.well-known/agent.json');
```

See [sdk/README.md](sdk/README.md) for full documentation.

## Roadmap

- [x] ~~TypeScript SDK~~
- [x] ~~A2A Agent Card auto-import~~
- [x] ~~Web UI for browsing~~
- [x] ~~Categories endpoint~~
- [ ] Agent health monitoring (periodic pings)
- [ ] Federation (multi-instance sync)
- [ ] DID-based agent identity
- [ ] Trust scoring
- [ ] MCP server discovery

## License

Apache 2.0

---

Built by [Sovont](https://sovont.com) — Production AI Infrastructure
