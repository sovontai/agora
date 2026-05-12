# @sovont/agora

TypeScript SDK for the [Agora](https://github.com/sovontai/agora) agent registry — discover and register AI agents.

## Install

```bash
npm install @sovont/agora
```

## Quick start

```ts
import { Agora } from '@sovont/agora';

// Anonymous reads (no API key needed)
const agora = new Agora();

const results = await agora.search({ q: 'invoice parsing' });
const cats = await agora.categories();
const stats = await agora.stats();

// Search MCP tool names directly
const emailers = await agora.search({ tool: 'send_email' });
```

## Register an agent

```ts
const auth = new Agora({ apiKey: 'agora_…' });

const agent = await auth.register({
  name: 'My Agent',
  description: 'Does amazing things with data',
  url: 'https://myagent.com',
  capabilities: [{ id: 'analyze', name: 'Data Analysis' }],
  categories: ['analytics', 'data'],
  tags: ['data', 'ml'],
  protocols: {
    a2a: { agentCardUrl: 'https://myagent.com/.well-known/agent.json' },
    mcp: { serverUrl: 'https://myagent.com/mcp' },
  },
});
```

If the agent advertises an MCP endpoint, Agora fetches its tool manifest and indexes the tool names so they show up in `agora.search({ tool: '…' })`.

## Verify domain ownership

```ts
const { instructions } = await auth.verify(agent.id, 'myagent.com');
console.log(`Add TXT record: ${instructions.record} = ${instructions.value}`);
// …add the TXT record at your DNS provider…
await auth.verifyConfirm(agent.id);
```

The domain you claim must equal, be a parent of, or be a subdomain of the agent URL's host. Verification is re-checked every 24 hours and automatically revoked if the TXT record disappears.

## Import an A2A Agent Card

Idempotent — calling twice with the same URL updates instead of duplicating:

```ts
const { agent, updated } = await auth.importA2A(
  'https://example.com/.well-known/agent.json'
);
```

## Verification badge

```ts
const url = auth.badgeUrl(agent.id);                 // "registered" / "verified"
const healthUrl = auth.badgeUrl(agent.id, 'health'); // healthy / reachable / unhealthy
```

Embed on your agent's website:

```html
<a href="https://agora.sovont.com/agents/AGENT_ID">
  <img src="https://agora.sovont.com/v1/badge/AGENT_ID.svg" alt="Listed on Agora"/>
</a>
```

## Self-hosted

```ts
const agora = new Agora({
  baseUrl: 'https://your-agora-instance.com',
  apiKey: 'your-key',
});
```

## API

| Method | Description | Auth |
|--------|-------------|------|
| `search(params)` | Search & list agents | — |
| `get(id)` | Get agent by ID | — |
| `categories()` | List categories with counts | — |
| `stats()` | Registry stats | — |
| `badgeUrl(id, kind?)` | URL of the badge SVG | — |
| `register(input)` | Register agent | bearer |
| `update(id, input)` | Update agent | bearer |
| `delete(id)` | Delete agent | bearer |
| `importA2A(url)` | Import A2A card (idempotent) | bearer |
| `verify(id, domain)` | Start domain verification | bearer |
| `verifyConfirm(id)` | Confirm DNS TXT record | bearer |
| `ping(id)` | Health-probe an agent | bearer |

Search parameters: `q`, `category`, `tag`, `tool`, `protocol` (`a2a`/`mcp`), `verified`, `status`, `limit`, `offset`.

## License

Apache 2.0
