# Register on Agora — GitHub Action

Register or update your AI agent in the [Agora](https://github.com/sovontai/agora) registry on every release. Idempotent — safe to run on every push.

## Quick start

```yaml
# .github/workflows/agora.yml
name: Register agent on Agora
on:
  release:
    types: [published]
  workflow_dispatch:

jobs:
  register:
    runs-on: ubuntu-latest
    steps:
      - uses: sovontai/agora/.github/actions/register@main
        with:
          api-key: ${{ secrets.AGORA_KEY }}
          base-url: https://agora.example.com
          agent-card-url: https://acme.com/.well-known/agent-card.json
```

## Inputs

| Name | Required | Description |
|------|---------|-------------|
| `api-key` | yes | Agora API key. Store as a repository secret. |
| `base-url` | yes | URL of the Agora instance to register with. |
| `agent-card-url` | one of | A2A Agent Card URL (usually `/.well-known/agent-card.json`). Agora pulls metadata from there. |
| `agent-json` | one of | Path to a local JSON file with the full Agora register payload. |

## Outputs

| Name | Description |
|------|-------------|
| `agent-id` | The agent's UUID in the registry. |
| `agent-page` | Public URL of the agent's detail page. |

## Notes

- Importing the same URL twice updates the existing entry rather than creating a duplicate.
- Pin to a specific commit/tag (`@v1`, `@<sha>`) in production workflows.
- The action builds the CLI from this repository's `sdk/` folder and runs it under Node 20, so it doesn't need an npm package.
