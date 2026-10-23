# Security policy

## Supported versions

Active development happens on `main`. We patch the most recent minor release.

| Version | Supported |
|--------|-----------|
| 0.3.x  | ✅ |
| 0.2.x  | best-effort |
| < 0.2  | ❌ |

## Reporting a vulnerability

**Please don't open a public issue.** Email **security@sovont.com** with:

- A description of the issue.
- Steps to reproduce, if you have them.
- The affected component (server, SDK, CLI, MCP server, GitHub Action).
- Whether you'd like a credit / how you'd like to be acknowledged.

You'll get an acknowledgement within 72 hours. We aim to ship a fix for high-severity issues within 7 days, and disclose responsibly after that.

## What counts

In scope:
- The Agora server (`src/`).
- The TypeScript SDK and CLI (`@sovont/agora`).
- The MCP server (`@sovont/agora-mcp`).
- The register-on-release GitHub Action (`.github/actions/register`).

Examples of qualifying issues:
- SQL injection / authentication bypass / privilege escalation.
- Cross-tenant data access (one API key seeing another owner's private data).
- DNS-TXT verification bypass.
- API key disclosure.

Out of scope:
- Denial of service via traffic flooding (rate limiting is the right channel).
- Issues that require physical access or compromised user infrastructure.
- Self-XSS, missing security headers, or other low-severity findings on the marketing site.

## Threat model notes

Agora is an *open* registry. Treat all listed data as public. Verification proves domain control over an agent's URL host — not that the listed agent is trustworthy, accurate, or safe to use. The registry never holds operational secrets for listed agents.
