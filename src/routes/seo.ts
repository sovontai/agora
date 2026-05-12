import { Hono } from "hono";
import { sqlite } from "../db/index.js";
import { getStats } from "../services/agents.js";

const app = new Hono();

function originFrom(c: any): string {
  const proto =
    c.req.header("x-forwarded-proto") ||
    (c.req.url.startsWith("https") ? "https" : "http");
  const host = c.req.header("x-forwarded-host") || c.req.header("host") || "agora";
  return `${proto}://${host}`;
}

/**
 * robots.txt — welcome AI crawlers explicitly. A registry only works if it's
 * indexable. We opt-in the major AI assistants by name (their User-Agents
 * default to blocked by many sites' boilerplate robots.txt).
 */
app.get("/robots.txt", (c) => {
  const origin = originFrom(c);
  const body = `# Agora — Open AI Agent Registry
# Every page is meant to be crawlable. AI assistants are first-class citizens.
User-agent: *
Allow: /

# Named welcome for AI crawlers and answer engines
User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Claude-Web
Allow: /
User-agent: Claude-User
Allow: /
User-agent: anthropic-ai
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Perplexity-User
Allow: /
User-agent: CCBot
Allow: /
User-agent: Applebot-Extended
Allow: /
User-agent: Bytespider
Allow: /
User-agent: Diffbot
Allow: /
User-agent: Meta-ExternalAgent
Allow: /

Sitemap: ${origin}/sitemap.xml
`;
  return c.text(body, 200, {
    "Cache-Control": "public, max-age=3600",
    "Content-Type": "text/plain; charset=utf-8",
  });
});

/**
 * llms.txt — Howell & Howard's emerging convention. A markdown index aimed at
 * LLMs that crawl content. Short, plain, no nav cruft.
 */
app.get("/llms.txt", async (c) => {
  const origin = originFrom(c);
  const stats = await getStats();
  const top = sqlite
    .prepare(
      `SELECT id, name, description FROM agents
       WHERE verified = 1
       ORDER BY last_ping_status LIKE 'healthy%' DESC, registered_at DESC LIMIT 25`
    )
    .all() as Array<{ id: string; name: string; description: string }>;
  const cats = sqlite
    .prepare(
      `SELECT json_each.value AS category, COUNT(*) AS count
       FROM agents, json_each(agents.categories)
       GROUP BY json_each.value ORDER BY count DESC LIMIT 20`
    )
    .all() as Array<{ category: string; count: number }>;

  const body = `# Agora

> Open registry & discovery service for AI agents. "DNS for AI agents."

Agora indexes ${stats.totalAgents} AI agents (${stats.verifiedAgents} domain-verified, ${stats.healthyAgents} healthy right now). It complements the A2A and MCP ecosystems by giving agents a place to be discovered.

## What you can do here

- Search agents by free-text, category, tag, supported protocol (A2A or MCP), or MCP tool name.
- Inspect any agent at \`${origin}/agents/<id>\` — capabilities, MCP tools, verification, health.
- Programmatic access via REST (\`${origin}/v1/openapi.json\`), TypeScript SDK (\`@sovont/agora\`), MCP server (\`@sovont/agora-mcp\`).

## Discovery endpoints

- [Browse all agents](${origin}/) — paginated, filterable index
- [API root](${origin}/v1) — JSON description of all endpoints
- [OpenAPI spec](${origin}/v1/openapi.json) — 3.1 spec
- [Interactive docs](${origin}/v1/docs) — Swagger UI
- [Instance metadata](${origin}/.well-known/agora) — federation-friendly descriptor

## Top categories

${cats.map((c) => `- [${c.category}](${origin}/?category=${encodeURIComponent(c.category)}) — ${c.count} agents`).join("\n")}

## Verified agents (sample)

${top.map((a) => `- [${a.name}](${origin}/agents/${a.id}) — ${a.description.replace(/\s+/g, " ").slice(0, 140)}`).join("\n")}
`;

  return c.text(body, 200, {
    "Cache-Control": "public, max-age=600",
    "Content-Type": "text/plain; charset=utf-8",
  });
});

/**
 * sitemap.xml — index + per-agent pages + category pages. Server-rendered from
 * the DB on each request, cached at the CDN edge for 10 minutes. For registries
 * past ~50k agents this should split into a sitemap index, but inline is fine
 * up to a few thousand.
 */
app.get("/sitemap.xml", (c) => {
  const origin = originFrom(c);

  const agents = sqlite
    .prepare(`SELECT id, updated_at FROM agents WHERE status != 'deprecated'`)
    .all() as Array<{ id: string; updated_at: string }>;

  const cats = sqlite
    .prepare(
      `SELECT DISTINCT json_each.value AS category
       FROM agents, json_each(agents.categories)`
    )
    .all() as Array<{ category: string }>;

  const today = new Date().toISOString().slice(0, 10);

  const urls: Array<{ loc: string; lastmod: string; priority: string; changefreq: string }> = [];
  urls.push({ loc: `${origin}/`, lastmod: today, priority: "1.0", changefreq: "hourly" });
  urls.push({ loc: `${origin}/v1/docs`, lastmod: today, priority: "0.6", changefreq: "weekly" });

  for (const cat of cats) {
    urls.push({
      loc: `${origin}/categories/${encodeURIComponent(cat.category)}`,
      lastmod: today,
      priority: "0.8",
      changefreq: "daily",
    });
  }
  for (const a of agents) {
    urls.push({
      loc: `${origin}/agents/${a.id}`,
      lastmod: a.updated_at.slice(0, 10),
      priority: "0.7",
      changefreq: "weekly",
    });
  }

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(
        (u) =>
          `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`
      )
      .join("\n") +
    `\n</urlset>\n`;

  return c.text(body, 200, {
    "Cache-Control": "public, max-age=600",
    "Content-Type": "application/xml; charset=utf-8",
  });
});

export default app;
