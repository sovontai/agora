# Contributing to Agora

Thanks for the interest. Agora is small, opinionated, and aims to stay that way. The friendliest contributions are ones that follow these grooves.

## Reporting issues

- **Security issues:** read [SECURITY.md](SECURITY.md) — please don't open public issues for those.
- **Bugs:** include reproduction steps, what you saw, what you expected. A failing test case is even better.
- **Feature requests:** describe the user-facing problem first, then the proposed shape. A working agent that doesn't get found is a real problem; "more knobs" usually isn't.

## Development setup

```bash
git clone https://github.com/sovontai/agora && cd agora
npm install
ADMIN_KEY=$(openssl rand -hex 24) npm run dev   # http://localhost:3340
npm test                                        # vitest run
npm run typecheck                               # tsc --noEmit
```

The repo is a small monorepo:

| Path | What it is |
|------|------------|
| `src/` | The server (Hono + SQLite + Drizzle). |
| `sdk/` | `@sovont/agora` — TypeScript SDK + CLI. |
| `mcp/` | `@sovont/agora-mcp` — MCP server for Claude/Cursor/Zed. |
| `.github/actions/register/` | The "Register on Agora" GitHub Action. |

## Style

- TypeScript strict mode. `npm run typecheck` must pass.
- One commit, one concern. Lean PRs land faster than sprawling ones.
- Tests for behaviour, not implementation. New routes get an endpoint test. Stick to `vitest` and `app.request(…)` via the existing `tests/helpers.ts` wrapper.
- Comments explain *why*, not *what*. Skip them unless removing the comment would confuse a future reader.
- No emojis in commit messages, PR titles, code, or comments unless explicitly requested.

## Testing

`tests/` mirrors the surface: `agents.test.ts`, `verification.test.ts`, etc. DB is an in-memory SQLite — `tests/setup.ts` resets it before each test. DNS and fetch are mocked via `setDnsResolver` / `globalThis.fetch` stubs. Examples are in the existing test files.

## Pull requests

- Branch off `main`.
- Run `npm test && npm run typecheck && npm run build` before opening.
- Keep the description focused on *why* the change matters and what reviewers should look at.

## Releases

Server, SDK, and MCP server all version together for now (`0.x.y`). When something ships:

1. Bump versions in `package.json`, `sdk/package.json`, `mcp/package.json`.
2. Update the relevant README sections.
3. Tag `v0.x.y`.
4. Publish from CI.

## Code of conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Short version: be kind, assume good faith, focus on the work.
