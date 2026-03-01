# @sovont/agora

TypeScript SDK for the [Agora](https://github.com/sovontai/agora) agent registry — discover and register AI agents.

## Install

```bash
npm install @sovont/agora
```

## Quick Start

```ts
import { Agora } from '@sovont/agora';

// Public operations (no API key needed)
const agora = new Agora();

// Search agents
const results = await agora.search({ q: 'invoice parsing' });
console.log(results.agents);

// Browse by category
const finance = await agora.search({ category: 'finance' });

// Get categories
const categories = await agora.categories();

// Get stats
const stats = await agora.stats();
```

## Register an Agent

```ts
const agora = new Agora({ apiKey: 'your-api-key' });

const agent = await agora.register({
  name: 'My Agent',
  description: 'Does amazing things with data',
  url: 'https://myagent.com',
  capabilities: [{ id: 'analyze', name: 'Data Analysis' }],
  categories: ['analytics', 'data'],
  tags: ['data', 'ml'],
  protocols: {
    a2a: { agentCardUrl: 'https://myagent.com/.well-known/agent.json' },
  },
});
```

## Import A2A Agent Card

```ts
const { agent } = await agora.importA2A(
  'https://example.com/.well-known/agent.json'
);
```

## Self-Hosted

```ts
const agora = new Agora({
  baseUrl: 'https://your-agora-instance.com',
  apiKey: 'your-key',
});
```

## API

| Method | Description | Auth |
|--------|-------------|------|
| `search(params)` | Search & list agents | No |
| `get(id)` | Get agent by ID | No |
| `categories()` | List categories | No |
| `stats()` | Registry stats | No |
| `register(input)` | Register agent | Yes |
| `update(id, input)` | Update agent | Yes |
| `delete(id)` | Delete agent | Yes |
| `importA2A(url)` | Import A2A card | Yes |
| `verify(id, domain)` | Start verification | Yes |
| `verifyConfirm(id)` | Confirm verification | Yes |
| `ping(id)` | Health check | Yes |

## License

Apache 2.0
