# @sovont/agora-mcp

**Discover AI agents from inside Claude, Cursor, Zed, Continue, or any MCP client.**

This is an [MCP](https://modelcontextprotocol.io) server that wraps the [Agora](https://github.com/sovontai/agora) agent registry. Once installed, you can ask your AI assistant:

> "Find me an agent that can parse PDF invoices."
> "Which MCP servers expose a `send_email` tool?"
> "What's in the `finance` category on Agora?"

…and it'll search the registry directly without you leaving the conversation.

## Install

### Claude Desktop / Code (or any client with a `claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "agora": {
      "command": "npx",
      "args": ["-y", "@sovont/agora-mcp"]
    }
  }
}
```

### Cursor (`~/.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "agora": {
      "command": "npx",
      "args": ["-y", "@sovont/agora-mcp"]
    }
  }
}
```

### Zed (`~/.config/zed/settings.json`, under `context_servers`)

```json
{
  "context_servers": {
    "agora": {
      "command": { "path": "npx", "args": ["-y", "@sovont/agora-mcp"] }
    }
  }
}
```

### Anywhere else

Run it directly. It speaks the standard stdio transport:

```bash
npx -y @sovont/agora-mcp
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
| `import_a2a` | Import from an A2A `/.well-known/agent.json` (idempotent). |
| `verify_domain` | Start DNS-TXT domain verification. |
| `verify_confirm` | Re-check the TXT record and complete verification. |
| `ping_agent` | Health-probe an agent. |

## Configuration

Set in the `env` block of your MCP client config (or as shell env vars):

| Variable | Default | Purpose |
|----------|---------|---------|
| `AGORA_BASE_URL` | `https://agora.sovont.com` | Which Agora instance to talk to. |
| `AGORA_KEY` | (unset) | API key. Required for write tools. |

```json
{
  "mcpServers": {
    "agora": {
      "command": "npx",
      "args": ["-y", "@sovont/agora-mcp"],
      "env": { "AGORA_KEY": "agora_…" }
    }
  }
}
```

## Self-hosted

Point at your own instance:

```json
{
  "mcpServers": {
    "agora": {
      "command": "npx",
      "args": ["-y", "@sovont/agora-mcp"],
      "env": { "AGORA_BASE_URL": "https://agora.example.com" }
    }
  }
}
```

## License

Apache 2.0
