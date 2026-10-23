# @sovont/agora-mcp

**Discover AI agents from inside Claude, Cursor, Zed, Continue, or any MCP client.**

This is an [MCP](https://modelcontextprotocol.io) server that wraps the [Agora](https://github.com/sovontai/agora) agent registry. Once installed, you can ask your AI assistant:

> "Find me an agent that can parse PDF invoices."
> "Which MCP servers expose a `send_email` tool?"
> "What's in the `finance` category on Agora?"

…and it'll search the registry directly without you leaving the conversation.

## Install

The package isn't on npm yet, so build it from the [Agora repo](https://github.com/sovontai/agora):

```bash
git clone https://github.com/sovontai/agora.git
cd agora/mcp && npm ci && npm run build
```

That produces `dist/index.js`. Point your client at it with `node`, and set `AGORA_BASE_URL` to your Agora instance. You'll need one running: see [Quick Start](../README.md#quick-start) to self-host.

### Claude Desktop / Code (or any client with a `claude_desktop_config.json`)

```json
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

### Cursor (`~/.cursor/mcp.json`)

```json
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

### Zed (`~/.config/zed/settings.json`, under `context_servers`)

```json
{
  "context_servers": {
    "agora": {
      "command": {
        "path": "node",
        "args": ["/path/to/agora/mcp/dist/index.js"],
        "env": { "AGORA_BASE_URL": "http://localhost:3340" }
      }
    }
  }
}
```

### Anywhere else

Run it directly. It speaks the standard stdio transport:

```bash
AGORA_BASE_URL=http://localhost:3340 node /path/to/agora/mcp/dist/index.js
```

## Tools

Read-only (no key required):

| Tool | What it does |
|------|---------------|
| `search_agents` | Free-text + filter search across the registry. Verified+healthy boosted. |
| `get_agent` | Full agent details — capabilities, MCP tools, verification, health. |
| `list_categories` | Browse categories with counts. |
| `registry_stats` | Totals: agents / verified / A2A / MCP / healthy. |

Write tools, enabled when `AGORA_KEY` is set:

| Tool | What it does |
|------|---------------|
| `register_agent` | Register a new agent. |
| `import_a2a` | Import from an A2A Agent Card URL, usually `/.well-known/agent-card.json` (idempotent). |
| `verify_domain` | Start DNS-TXT domain verification. |
| `verify_confirm` | Re-check the TXT record and complete verification. |
| `ping_agent` | Health-probe an agent. |

## Configuration

Set in the `env` block of your MCP client config (or as shell env vars):

| Variable | Default | Purpose |
|----------|---------|---------|
| `AGORA_BASE_URL` | `http://localhost:3340` | Which Agora instance to talk to. The default is a local server on Agora's default port. |
| `AGORA_KEY` | (unset) | API key. Required for write tools. |

```json
{
  "mcpServers": {
    "agora": {
      "command": "node",
      "args": ["/path/to/agora/mcp/dist/index.js"],
      "env": {
        "AGORA_BASE_URL": "https://agora.example.com",
        "AGORA_KEY": "agora_…"
      }
    }
  }
}
```

## License

Apache 2.0. See the [LICENSE](../LICENSE) in the repo root.
