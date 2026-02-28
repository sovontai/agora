# Agora — Open Agent Registry & Discovery

> DNS for AI agents. Register, discover, connect.

## Overview

Agora is an open-source agent registry and discovery service. It allows AI agents to register their capabilities and be discovered by other agents or applications. Built to complement the A2A and MCP ecosystems.

## Core Concepts

### Agent Card
An agent's public profile, extending the A2A Agent Card spec:
```json
{
  "id": "uuid",
  "name": "Invoice Parser Agent",
  "description": "Extracts structured data from invoices",
  "url": "https://agents.acme.com/invoice-parser",
  "version": "1.2.0",
  "provider": {
    "organization": "Acme Corp",
    "contact": "agents@acme.com",
    "url": "https://acme.com"
  },
  "capabilities": [
    {
      "id": "parse-invoice",
      "name": "Parse Invoice",
      "description": "Extract line items, totals, dates from PDF/image invoices",
      "inputModes": ["application/pdf", "image/png", "image/jpeg"],
      "outputModes": ["application/json"]
    }
  ],
  "categories": ["finance", "document-processing", "ocr"],
  "tags": ["invoice", "extraction", "pdf"],
  "protocols": {
    "a2a": { "agentCardUrl": "https://agents.acme.com/.well-known/agent.json" },
    "mcp": { "serverUrl": "https://agents.acme.com/mcp" }
  },
  "auth": {
    "schemes": ["bearer", "oauth2"],
    "oauth2": {
      "authorizationUrl": "https://acme.com/oauth/authorize",
      "tokenUrl": "https://acme.com/oauth/token"
    }
  },
  "verification": {
    "domain": "agents.acme.com",
    "verified": true,
    "verifiedAt": "2026-02-28T00:00:00Z",
    "method": "dns-txt"
  },
  "status": "active",
  "registeredAt": "2026-02-28T00:00:00Z",
  "updatedAt": "2026-02-28T00:00:00Z"
}
```

### Domain Verification
Agents verify ownership via DNS TXT record:
```
_agora-verify.agents.acme.com TXT "agora-verify=<token>"
```
Like SSL certificate validation — simple, proven, no crypto needed.

## API

### Public (no auth)
- `GET /v1/agents` — Search/list agents (query, category, tags, capabilities, protocol)
- `GET /v1/agents/:id` — Get agent details
- `GET /v1/categories` — List categories
- `GET /v1/stats` — Registry stats

### Authenticated (API key)
- `POST /v1/agents` — Register an agent
- `PUT /v1/agents/:id` — Update agent
- `DELETE /v1/agents/:id` — Remove agent
- `POST /v1/agents/:id/verify` — Initiate domain verification
- `POST /v1/agents/:id/verify/confirm` — Confirm verification
- `POST /v1/agents/:id/ping` — Health check (Agora pings the agent's URL)

### Search
Full-text search + filters:
```
GET /v1/agents?q=invoice+parsing&category=finance&protocol=a2a&verified=true
```

## Tech Stack
- **Runtime:** Node.js + TypeScript
- **Framework:** Hono (lightweight, fast, edge-ready)
- **Database:** SQLite (via Drizzle ORM) — simple, no infra needed, scales to 100k+ agents easily
- **Search:** SQLite FTS5 for full-text search
- **Validation:** Zod schemas
- **Auth:** API keys (phase 1), OAuth2 (phase 2)
- **Deployment:** Single binary via Docker, or direct Node.js

## Project Structure
```
agora/
├── src/
│   ├── index.ts              # Entry point
│   ├── app.ts                # Hono app setup
│   ├── config.ts             # Configuration
│   ├── db/
│   │   ├── schema.ts         # Drizzle schema
│   │   ├── migrate.ts        # Migrations
│   │   └── index.ts          # DB connection
│   ├── routes/
│   │   ├── agents.ts         # Agent CRUD + search
│   │   ├── categories.ts     # Category listing
│   │   ├── verify.ts         # Domain verification
│   │   └── stats.ts          # Registry stats
│   ├── services/
│   │   ├── agents.ts         # Agent business logic
│   │   ├── search.ts         # Search logic
│   │   ├── verification.ts   # Domain verification logic
│   │   └── health.ts         # Agent health checks
│   ├── middleware/
│   │   ├── auth.ts           # API key auth
│   │   ├── rateLimit.ts      # Rate limiting
│   │   └── errors.ts         # Error handling
│   └── types/
│       └── index.ts          # Shared types
├── sdk/                      # TypeScript SDK (npm package)
│   ├── src/
│   │   ├── index.ts
│   │   ├── client.ts         # Agora client
│   │   └── types.ts          # SDK types
│   └── package.json
├── tests/
├── docker/
│   └── Dockerfile
├── drizzle.config.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Phase 1 (MVP — Ship This)
- [x] Spec
- [ ] Agent CRUD (register, update, delete, get)
- [ ] Search (full-text + filters)
- [ ] API key auth for write operations
- [ ] Domain verification (DNS TXT)
- [ ] Categories & tags
- [ ] A2A Agent Card import (fetch from /.well-known/agent.json)
- [ ] Basic health check (ping agent URL)
- [ ] OpenAPI spec auto-generated
- [ ] Docker deployment
- [ ] README + docs

## Phase 2
- [ ] TypeScript SDK (`@agora/sdk`)
- [ ] Agent health monitoring (periodic pings, status tracking)
- [ ] Webhook notifications (new agents in category, status changes)
- [ ] Federation protocol (multiple Agora instances can sync)
- [ ] Web UI for browsing agents

## Phase 3
- [ ] DID-based agent identity
- [ ] Trust scoring (post-interaction ratings)
- [ ] MCP server discovery integration
- [ ] Usage analytics for registered agents
- [ ] Enterprise features (private registries, RBAC)

## Name
**Agora** (ἀγορά) — the ancient Greek public square where people gathered to exchange goods, ideas, and services. The marketplace where agents meet.

## License
Apache 2.0
