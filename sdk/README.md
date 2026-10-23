# @sovont/agora

TypeScript SDK for the [Agora](https://github.com/sovontai/agora) agent registry — discover and register AI agents.

## Install

The package isn't on npm yet. Build it from the [Agora repo](https://github.com/sovontai/agora) and install it into your project from the folder:

```bash
git clone https://github.com/sovontai/agora.git
cd agora/sdk && npm ci && npm run build
cd /your/project && npm install /path/to/agora/sdk
```

You'll also need an Agora instance to talk to: see [Quick Start](../README.md#quick-start) to self-host one.

## Quick start

```ts
import { Agora } from '@sovont/agora';

// Anonymous reads (no API key needed). Without baseUrl, the SDK uses http://localhost:3340.
const agora = new Agora({ baseUrl: 'http://localhost:3340' });

const results = await agora.search({ q: 'invoice parsing' });
const cats = await agora.categories();
const stats = await agora.stats();

// Search MCP tool names directly
const emailers = await agora.search({ tool: 'send_email' });
```

## Register an agent

```ts
const auth = new Agora({ baseUrl: 'http://localhost:3340', apiKey: 'agora_…' });

const agent = await auth.register({
  name: 'My Agent',
  description: 'Does amazing things with data',
  url: 'https://myagent.com',
  capabilities: [{ id: 'analyze', name: 'Data Analysis' }],
  categories: ['analytics', 'data'],
  tags: ['data', 'ml'],
  protocols: {
    a2a: { agentCardUrl: 'https://myagent.com/.well-known/agent-card.json' },
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
  'https://example.com/.well-known/agent-card.json'
);
```

## Verification badge

```ts
const url = auth.badgeUrl(agent.id);                 // "registered" / "verified"
const healthUrl = auth.badgeUrl(agent.id, 'health'); // healthy / reachable / unhealthy
```

Embed on your agent's website. Replace `agora.example.com` with your instance's public URL:

```html
<a href="https://agora.example.com/agents/AGENT_ID">
  <img src="https://agora.example.com/v1/badge/AGENT_ID.svg" alt="Listed on Agora"/>
</a>
```

## Pointing at an instance

Without `baseUrl`, the SDK talks to `http://localhost:3340`, the default address of a local Agora server. Pass your instance's URL otherwise:

```ts
const agora = new Agora({
  baseUrl: 'https://agora.example.com',
  apiKey: 'your-key',
});
```

## CLI

The same package includes a command-line tool. After building, run it with `node dist/cli.js`, or `npm link` it to get an `agora` command:

```bash
agora search "invoice parsing"
agora get <id>
agora register agent.json
agora import https://example.com/.well-known/agent-card.json
agora verify <id> <domain>
agora verify confirm <id>
agora ping <id>
agora stats
agora init      # save a base URL and API key to ~/.config/agora/config.json
agora whoami
```

It reads `AGORA_BASE_URL` and `AGORA_KEY` from the environment first, then the config file, and falls back to `http://localhost:3340`.

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

Apache 2.0. See the [LICENSE](../LICENSE) in the repo root.
