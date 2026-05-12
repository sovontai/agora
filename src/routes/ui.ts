import { Hono } from "hono";
import { html, raw } from "hono/html";
import { getAgent, searchAgents, getStats } from "../services/agents.js";
import { sqlite } from "../db/index.js";

const app = new Hono();

const SITE_NAME = "Agora";
const SITE_TAGLINE = "Discover AI agents";
const DEFAULT_DESC =
  "The open registry for AI agents. Search by capability, protocol, or category. Built for the A2A and MCP ecosystem.";

function siteUrl(c: any, path = ""): string {
  const proto =
    c.req.header("x-forwarded-proto") ||
    (c.req.url.startsWith("https") ? "https" : "http");
  const host = c.req.header("x-forwarded-host") || c.req.header("host") || "agora";
  return `${proto}://${host}${path}`;
}

function esc(s: any): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const baseStyles = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg: #0a0a0b; --surface: #141416; --surface-2: #1c1c20; --border: #2a2a30;
  --text: #e4e4e7; --text-muted: #8b8b94;
  --accent: #6366f1; --accent-dim: #4f46e5;
  --green: #22c55e; --green-dim: rgba(34,197,94,0.12);
  --blue: #3b82f6; --blue-dim: rgba(59,130,246,0.12);
  --orange: #f59e0b; --orange-dim: rgba(245,158,11,0.12);
  --red: #ef4444;
  --radius: 8px; --radius-lg: 12px;
}
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  background: var(--bg); color: var(--text);
  line-height: 1.6; min-height: 100vh;
}
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
.container { max-width: 1040px; margin: 0 auto; padding: 0 20px; }
header { border-bottom: 1px solid var(--border); padding: 18px 0; position: sticky; top: 0; background: rgba(10,10,11,0.92); backdrop-filter: blur(10px); z-index: 10; }
.header-inner { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.logo { font-size: 1.35rem; font-weight: 700; color: var(--text); display: flex; align-items: center; gap: 10px; }
.logo-icon { font-size: 1.6rem; }
.header-links { display: flex; gap: 18px; font-size: 0.875rem; }
.header-links a { color: var(--text-muted); }
.header-links a:hover { color: var(--text); text-decoration: none; }
.tag { font-size: 0.72rem; padding: 3px 10px; border-radius: 12px; background: var(--surface-2); color: var(--text-muted); border: 1px solid var(--border); }
.protocol-badge { font-size: 0.72rem; padding: 3px 10px; border-radius: 12px; font-weight: 600; letter-spacing: 0.02em; }
.protocol-mcp { background: var(--blue-dim); color: var(--blue); }
.protocol-a2a { background: var(--orange-dim); color: var(--orange); }
.verified-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 0.72rem; color: var(--green); background: var(--green-dim); padding: 3px 10px; border-radius: 12px; font-weight: 500; }
.health-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; vertical-align: middle; margin-right: 4px; }
.health-healthy { background: var(--green); }
.health-reachable { background: var(--blue); }
.health-unhealthy { background: var(--orange); }
.health-unreachable { background: var(--red); }
.health-unknown { background: var(--text-muted); }
footer { border-top: 1px solid var(--border); margin-top: 60px; padding: 24px 0; text-align: center; font-size: 0.8rem; color: var(--text-muted); }
footer a { color: var(--text-muted); }
footer a:hover { color: var(--text); }
`;

const indexStyles = `
.hero { text-align: center; padding: 60px 0 28px; }
.hero h1 { font-size: 2.5rem; font-weight: 800; letter-spacing: -0.03em; margin-bottom: 12px; }
.hero h1 span { color: var(--accent); }
.hero p { font-size: 1.05rem; color: var(--text-muted); max-width: 600px; margin: 0 auto 24px; }
.stats-bar { display: flex; justify-content: center; gap: 32px; margin-bottom: 32px; font-size: 0.875rem; flex-wrap: wrap; }
.stat { text-align: center; }
.stat-num { font-size: 1.5rem; font-weight: 700; color: var(--text); }
.stat-label { color: var(--text-muted); margin-top: 2px; }
.search-box { position: relative; max-width: 640px; margin: 0 auto 18px; }
.search-box input { width: 100%; padding: 14px 20px 14px 48px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); color: var(--text); font-size: 1rem; outline: none; transition: border-color 0.2s; }
.search-box input:focus { border-color: var(--accent); }
.search-icon { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 1.1rem; pointer-events: none; }
.filters { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-bottom: 28px; }
.filter-btn { padding: 6px 14px; border-radius: 20px; font-size: 0.8rem; background: var(--surface); border: 1px solid var(--border); color: var(--text-muted); cursor: pointer; transition: all 0.18s; text-decoration: none; }
.filter-btn:hover, .filter-btn.active { border-color: var(--accent); color: var(--accent); background: rgba(99,102,241,0.08); text-decoration: none; }
.agents-grid { display: flex; flex-direction: column; gap: 12px; }
.agent-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 20px 24px; transition: border-color 0.18s; display: block; color: inherit; }
.agent-card:hover { border-color: var(--accent-dim); text-decoration: none; }
.agent-header { display: flex; align-items: start; justify-content: space-between; margin-bottom: 8px; gap: 12px; }
.agent-name { font-size: 1.1rem; font-weight: 600; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.agent-provider { font-size: 0.8rem; color: var(--text-muted); margin-bottom: 8px; }
.agent-desc { font-size: 0.92rem; color: var(--text-muted); line-height: 1.55; margin-bottom: 12px; }
.agent-meta { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.empty { text-align: center; padding: 60px 20px; color: var(--text-muted); }
.empty-icon { font-size: 3rem; margin-bottom: 16px; }
.button-cta { display: inline-flex; align-items: center; padding: 10px 18px; background: var(--accent); color: white; border-radius: 8px; font-size: 0.9rem; font-weight: 500; }
.button-cta:hover { background: var(--accent-dim); text-decoration: none; }
.button-cta.button-secondary { background: transparent; border: 1px solid var(--border); color: var(--text); }
.button-cta.button-secondary:hover { background: var(--surface); border-color: var(--accent-dim); color: var(--accent); }
.pagination { display: flex; justify-content: center; gap: 8px; margin-top: 32px; }
.pagination a { padding: 6px 14px; border-radius: 8px; background: var(--surface); border: 1px solid var(--border); color: var(--text-muted); font-size: 0.85rem; }
.pagination a:hover { color: var(--text); text-decoration: none; border-color: var(--accent-dim); }
.pagination .current { color: var(--text); }
@media (max-width: 600px) {
  .hero h1 { font-size: 1.8rem; }
  .stats-bar { gap: 20px; }
  .agent-card { padding: 16px; }
  .header-links { gap: 12px; }
}
`;

const agentStyles = `
.agent-page { padding: 40px 0; }
.breadcrumb { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 16px; }
.breadcrumb a { color: var(--text-muted); }
.title-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
.title-row h1 { font-size: 1.8rem; letter-spacing: -0.02em; }
.title-row .small { font-size: 0.8rem; color: var(--text-muted); }
.provider { color: var(--text-muted); font-size: 0.95rem; margin-bottom: 18px; }
.desc { font-size: 1.05rem; color: var(--text); line-height: 1.6; margin-bottom: 28px; max-width: 720px; }
.grid { display: grid; grid-template-columns: 2fr 1fr; gap: 32px; }
.section { margin-bottom: 28px; }
.section h3 { font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 10px; font-weight: 600; }
.kv { display: grid; grid-template-columns: 130px 1fr; gap: 6px 12px; font-size: 0.9rem; }
.kv dt { color: var(--text-muted); }
.kv dd { color: var(--text); word-break: break-word; }
.cap-list { list-style: none; display: flex; flex-direction: column; gap: 8px; }
.cap-list li { padding: 12px 14px; background: var(--surface-2); border-radius: var(--radius); border: 1px solid var(--border); }
.cap-name { font-weight: 600; font-size: 0.95rem; }
.cap-desc { color: var(--text-muted); font-size: 0.85rem; margin-top: 4px; }
.tag-list { display: flex; flex-wrap: wrap; gap: 6px; }
.sidebar { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 20px; position: sticky; top: 90px; align-self: start; }
.sidebar .row { padding: 8px 0; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; font-size: 0.85rem; gap: 8px; }
.sidebar .row:last-child { border-bottom: none; }
.sidebar .label { color: var(--text-muted); }
.sidebar .value { color: var(--text); text-align: right; word-break: break-word; }
.embed { margin-top: 16px; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius); padding: 10px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.78rem; color: var(--text-muted); overflow-x: auto; white-space: nowrap; }
.button { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; background: var(--accent); color: white; border-radius: 8px; font-size: 0.85rem; font-weight: 500; }
.button:hover { background: var(--accent-dim); text-decoration: none; }
@media (max-width: 760px) {
  .grid { grid-template-columns: 1fr; }
  .sidebar { position: static; }
}
`;

function headerBlock() {
  return html`<header>
    <div class="container header-inner">
      <a class="logo" href="/" style="color:inherit;text-decoration:none"><span class="logo-icon">${raw("&#x1f3db;")}</span> Agora</a>
      <div class="header-links">
        <a href="/v1/docs">Docs</a>
        <a href="/v1/openapi.json">API</a>
        <a href="https://github.com/sovontai/agora#typescript-sdk" target="_blank">SDK</a>
        <a href="https://github.com/sovontai/agora/tree/main/mcp" target="_blank">MCP</a>
        <a href="https://github.com/sovontai/agora" target="_blank">GitHub</a>
        <a href="https://github.com/sovontai/agora#register-an-agent" style="color:var(--accent);font-weight:500;">+ Register</a>
      </div>
    </div>
  </header>`;
}

function footerBlock() {
  return html`<footer>
    <div class="container">
      Agora v0.3.0 — <a href="/v1/openapi.json">OpenAPI</a> — <a href="/v1/docs">Docs</a> — <a href="/.well-known/agora">.well-known</a> — <a href="/llms.txt">llms.txt</a> — <a href="https://github.com/sovontai/agora">Apache 2.0</a>
    </div>
  </footer>`;
}

function metaBlock(opts: {
  title: string;
  description: string;
  url: string;
  image?: string;
  jsonLd?: object;
}) {
  return html`<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${opts.title}</title>
<meta name="description" content="${opts.description}">
<link rel="canonical" href="${opts.url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Agora">
<meta property="og:title" content="${opts.title}">
<meta property="og:description" content="${opts.description}">
<meta property="og:url" content="${opts.url}">
${opts.image ? html`<meta property="og:image" content="${opts.image}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">` : ""}
<meta name="twitter:card" content="${opts.image ? "summary_large_image" : "summary"}">
<meta name="twitter:title" content="${opts.title}">
<meta name="twitter:description" content="${opts.description}">
${opts.image ? html`<meta name="twitter:image" content="${opts.image}">` : ""}
${
  opts.jsonLd
    ? html`<script type="application/ld+json">${raw(JSON.stringify(opts.jsonLd))}</script>`
    : ""
}`;
}

// ── Index page ──────────────────────────────────────────────────────────────

app.get("/", async (c) => {
  const url = new URL(c.req.url);
  const q = url.searchParams.get("q") || "";
  const category = url.searchParams.get("category") || "";
  const protocol = (url.searchParams.get("protocol") as "a2a" | "mcp" | null) || null;
  const verifiedParam = url.searchParams.get("verified");
  const verified =
    verifiedParam === "true" ? true : verifiedParam === "false" ? false : undefined;
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const limit = 24;
  const offset = (page - 1) * limit;

  const [stats, list] = await Promise.all([
    getStats(),
    searchAgents({
      q: q || undefined,
      category: category || undefined,
      protocol: protocol || undefined,
      verified,
      limit,
      offset,
    } as any),
  ]);

  // Pull category facets from a separate query so they don't depend on the page.
  const facets = await searchAgents({ limit: 100, offset: 0 } as any);
  const cats = new Set<string>();
  for (const a of facets.agents) (a.categories || []).forEach((x: string) => cats.add(x));
  const allCats = [...cats].sort();

  const totalPages = Math.max(1, Math.ceil(list.total / limit));
  const currentUrl = siteUrl(c, "/");

  return c.html(html`<!DOCTYPE html>
<html lang="en">
<head>
${metaBlock({
  title: `${SITE_NAME} — ${SITE_TAGLINE}`,
  description: DEFAULT_DESC,
  url: currentUrl,
  image: siteUrl(c, "/v1/og/site.svg"),
  jsonLd: {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: currentUrl,
    description: DEFAULT_DESC,
    potentialAction: {
      "@type": "SearchAction",
      target: `${currentUrl}?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  },
})}
<style>${raw(baseStyles)}${raw(indexStyles)}</style>
</head>
<body>
${headerBlock()}
<main class="container">
  <section class="hero">
    <h1>Discover <span>AI agents</span></h1>
    <p>${DEFAULT_DESC}</p>
    <div class="hero-actions" style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:20px;">
      <a href="https://github.com/sovontai/agora/tree/main/mcp#install" class="button-cta">Use from Claude / Cursor</a>
      <a href="https://github.com/sovontai/agora#register-an-agent" class="button-cta button-secondary">Register your agent</a>
    </div>
  </section>

  <div class="stats-bar">
    <div class="stat"><div class="stat-num">${stats.totalAgents}</div><div class="stat-label">Agents</div></div>
    <div class="stat"><div class="stat-num">${stats.mcpAgents}</div><div class="stat-label">MCP</div></div>
    <div class="stat"><div class="stat-num">${stats.a2aAgents}</div><div class="stat-label">A2A</div></div>
    <div class="stat"><div class="stat-num">${stats.verifiedAgents}</div><div class="stat-label">Verified</div></div>
    <div class="stat"><div class="stat-num">${stats.healthyAgents}</div><div class="stat-label">Healthy</div></div>
  </div>

  <form class="search-box" method="get" action="/">
    <span class="search-icon">${raw("&#x2315;")}</span>
    <input type="text" name="q" value="${esc(q)}" placeholder="Search by name, capability, tool, or description…" autofocus />
    ${category ? html`<input type="hidden" name="category" value="${esc(category)}">` : ""}
    ${protocol ? html`<input type="hidden" name="protocol" value="${esc(protocol)}">` : ""}
    ${verified === true ? html`<input type="hidden" name="verified" value="true">` : ""}
  </form>

  <nav class="filters" aria-label="Filters">
    ${filterChip("All", "/", !category && !protocol && verified === undefined)}
    ${filterChip("Verified", "/?verified=true", verified === true)}
    ${filterChip("A2A", "/?protocol=a2a", protocol === "a2a")}
    ${filterChip("MCP", "/?protocol=mcp", protocol === "mcp")}
    ${allCats.map((c0) =>
      filterChip(c0, `/?category=${encodeURIComponent(c0)}`, category === c0)
    )}
  </nav>

  <section class="agents-grid" aria-label="Agents">
    ${
      list.agents.length === 0
        ? html`<div class="empty"><div class="empty-icon">${raw("&#x1f50d;")}</div>No agents match. Try a different search.</div>`
        : list.agents.map((a: any) => agentCardHtml(a))
    }
  </section>

  ${
    totalPages > 1
      ? html`<div class="pagination">
          ${page > 1
            ? html`<a href="${paginateHref(url, page - 1)}">${raw("&larr;")} Prev</a>`
            : ""}
          <span class="current">Page ${page} of ${totalPages}</span>
          ${page < totalPages
            ? html`<a href="${paginateHref(url, page + 1)}">Next ${raw("&rarr;")}</a>`
            : ""}
        </div>`
      : ""
  }
</main>
${footerBlock()}
</body>
</html>`);
});

function filterChip(label: string, href: string, active: boolean) {
  return html`<a class="filter-btn ${active ? "active" : ""}" href="${href}">${esc(label)}</a>`;
}

function paginateHref(url: URL, page: number): string {
  const u = new URL(url.toString());
  u.searchParams.set("page", String(page));
  return `${u.pathname}?${u.searchParams.toString()}`;
}

function agentCardHtml(a: any) {
  const protocols: any[] = [];
  if (a.protocols?.mcp) protocols.push(html`<span class="protocol-badge protocol-mcp">MCP</span>`);
  if (a.protocols?.a2a) protocols.push(html`<span class="protocol-badge protocol-a2a">A2A</span>`);
  const verified = a.verification?.verified
    ? html`<span class="verified-badge">${raw("&#x2713;")} Verified</span>`
    : "";
  const tags = (a.tags || []).slice(0, 4).map((t: string) => html`<span class="tag">${esc(t)}</span>`);
  const provider = a.provider?.organization
    ? html`<div class="agent-provider">by ${esc(a.provider.organization)}</div>`
    : "";
  return html`<a class="agent-card" href="/agents/${esc(a.id)}">
    <div class="agent-header">
      <div class="agent-name">${esc(a.name)} ${verified}</div>
    </div>
    ${provider}
    <div class="agent-desc">${esc(a.description)}</div>
    <div class="agent-meta">${protocols}${tags}</div>
  </a>`;
}

// ── Individual agent page (SSR) ─────────────────────────────────────────────

app.get("/agents/:id", async (c) => {
  const id = c.req.param("id");
  const agent = await getAgent(id);
  if (!agent) {
    c.status(404);
    return c.html(html`<!doctype html><html><head><title>Agent not found — Agora</title>
    <meta name="viewport" content="width=device-width,initial-scale=1"><style>${raw(baseStyles)}</style></head>
    <body>${headerBlock()}
    <main class="container" style="text-align:center;padding:80px 20px;">
      <h1 style="font-size:1.5rem;margin-bottom:12px;">Agent not found</h1>
      <p style="color:var(--text-muted);">No agent with id <code>${esc(id)}</code> exists in this registry.</p>
      <p style="margin-top:20px;"><a href="/">${raw("&larr;")} Back to all agents</a></p>
    </main>${footerBlock()}</body></html>`);
  }

  const pageUrl = siteUrl(c, `/agents/${agent.id}`);
  const badgeUrl = siteUrl(c, `/v1/badge/${agent.id}.svg`);
  const desc = (agent.description || "").slice(0, 240);
  const verifiedLabel = agent.verification.verified
    ? `Verified for ${agent.verification.domain}`
    : "Unverified";
  const title = `${agent.name} — Agora`;
  const healthClass = (() => {
    const s = agent.health?.status || "";
    if (s === "healthy") return "health-healthy";
    if (s === "reachable") return "health-reachable";
    if (s.startsWith("unhealthy")) return "health-unhealthy";
    if (s.startsWith("unreachable")) return "health-unreachable";
    return "health-unknown";
  })();

  const jsonLd: any = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: agent.name,
    description: agent.description,
    url: pageUrl,
    applicationCategory: "AI Agent",
    operatingSystem: "Web",
    sameAs: [agent.url],
  };
  if (agent.provider?.organization) {
    jsonLd.author = { "@type": "Organization", name: agent.provider.organization };
  }
  if (agent.protocols?.a2a?.agentCardUrl) jsonLd.sameAs.push(agent.protocols.a2a.agentCardUrl);
  if (agent.protocols?.mcp?.serverUrl) jsonLd.sameAs.push(agent.protocols.mcp.serverUrl);

  const embed = `<a href="${pageUrl}"><img src="${badgeUrl}" alt="Listed on Agora"/></a>`;

  return c.html(html`<!doctype html>
<html lang="en">
<head>
${metaBlock({
  title,
  description: desc || DEFAULT_DESC,
  url: pageUrl,
  image: siteUrl(c, `/v1/og/agents/${agent.id}.svg`),
  jsonLd,
})}
<style>${raw(baseStyles)}${raw(agentStyles)}</style>
</head>
<body>
${headerBlock()}
<main class="container agent-page">
  <div class="breadcrumb"><a href="/">Agora</a> / Agents / ${esc(agent.name)}</div>
  <div class="title-row">
    <h1>${esc(agent.name)}</h1>
    ${agent.protocols?.a2a ? html`<span class="protocol-badge protocol-a2a">A2A</span>` : ""}
    ${agent.protocols?.mcp ? html`<span class="protocol-badge protocol-mcp">MCP</span>` : ""}
    ${
      agent.verification.verified
        ? html`<span class="verified-badge">${raw("&#x2713;")} ${esc(verifiedLabel)}</span>`
        : ""
    }
    ${agent.version ? html`<span class="small">v${esc(agent.version)}</span>` : ""}
  </div>
  ${
    agent.provider?.organization
      ? html`<div class="provider">by ${
          agent.provider.url
            ? html`<a href="${esc(agent.provider.url)}" target="_blank" rel="noopener">${esc(agent.provider.organization)}</a>`
            : esc(agent.provider.organization)
        }</div>`
      : ""
  }
  <p class="desc">${esc(agent.description)}</p>

  <div class="grid">
    <div>
      ${
        agent.capabilities?.length
          ? html`<section class="section">
              <h3>Capabilities</h3>
              <ul class="cap-list">
                ${agent.capabilities.map(
                  (cap: any) => html`<li>
                    <div class="cap-name">${esc(cap.name)}</div>
                    ${cap.description ? html`<div class="cap-desc">${esc(cap.description)}</div>` : ""}
                  </li>`
                )}
              </ul>
            </section>`
          : ""
      }
      ${
        agent.mcpTools?.length
          ? html`<section class="section">
              <h3>MCP tools (${agent.mcpTools.length})</h3>
              <ul class="cap-list">
                ${agent.mcpTools
                  .slice(0, 30)
                  .map(
                    (t: any) => html`<li>
                      <div class="cap-name">${esc(t.name)}</div>
                      ${t.description ? html`<div class="cap-desc">${esc(t.description)}</div>` : ""}
                    </li>`
                  )}
              </ul>
            </section>`
          : ""
      }
      ${
        agent.tags?.length
          ? html`<section class="section">
              <h3>Tags</h3>
              <div class="tag-list">${agent.tags.map((t: string) => html`<a class="tag" href="/?q=${encodeURIComponent(t)}">${esc(t)}</a>`)}</div>
            </section>`
          : ""
      }
      ${
        agent.categories?.length
          ? html`<section class="section">
              <h3>Categories</h3>
              <div class="tag-list">${agent.categories.map((cat: string) => html`<a class="tag" href="/?category=${encodeURIComponent(cat)}">${esc(cat)}</a>`)}</div>
            </section>`
          : ""
      }
    </div>

    <aside class="sidebar">
      <div class="row"><span class="label">URL</span><span class="value"><a href="${esc(agent.url)}" target="_blank" rel="noopener">${esc(agent.url)}</a></span></div>
      <div class="row"><span class="label">Health</span><span class="value"><span class="health-dot ${healthClass}"></span>${esc(agent.health?.status || "unknown")}</span></div>
      <div class="row"><span class="label">Status</span><span class="value">${esc(agent.status)}</span></div>
      <div class="row"><span class="label">Registered</span><span class="value">${esc(new Date(agent.registeredAt).toISOString().slice(0, 10))}</span></div>
      ${
        agent.protocols?.a2a
          ? html`<div class="row"><span class="label">A2A card</span><span class="value"><a href="${esc(agent.protocols.a2a.agentCardUrl)}" target="_blank" rel="noopener">JSON</a></span></div>`
          : ""
      }
      ${
        agent.protocols?.mcp
          ? html`<div class="row"><span class="label">MCP server</span><span class="value"><a href="${esc(agent.protocols.mcp.serverUrl)}" target="_blank" rel="noopener">${esc(agent.protocols.mcp.serverUrl)}</a></span></div>`
          : ""
      }
      <div class="section" style="margin-top:14px;">
        <h3>Embed</h3>
        <img alt="Agora badge" src="${badgeUrl}" />
        <div class="embed">${esc(embed)}</div>
      </div>
      <div class="section" style="margin-top:14px;">
        <a class="button" href="${esc(agent.url)}" target="_blank" rel="noopener">Visit agent ${raw("&rarr;")}</a>
      </div>
    </aside>
  </div>
</main>
${footerBlock()}
</body>
</html>`);
});

// ── Category landing pages (SEO-targeted) ──────────────────────────────────

app.get("/categories/:slug", async (c) => {
  const slug = c.req.param("slug").toLowerCase();
  const pretty = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const url = new URL(c.req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const limit = 24;
  const offset = (page - 1) * limit;

  const list = await searchAgents({
    category: slug,
    limit,
    offset,
  } as any);

  if (list.total === 0) {
    c.status(404);
    return c.html(html`<!doctype html><html><head><title>${esc(pretty)} agents — Agora</title>
    <meta name="viewport" content="width=device-width,initial-scale=1"><style>${raw(baseStyles)}</style></head>
    <body>${headerBlock()}
    <main class="container" style="text-align:center;padding:80px 20px;">
      <h1 style="font-size:1.5rem;margin-bottom:12px;">No agents in the "${esc(pretty)}" category yet</h1>
      <p style="color:var(--text-muted);">Be the first — <a href="https://github.com/sovontai/agora#register-an-agent">register an agent</a>.</p>
      <p style="margin-top:20px;"><a href="/">${raw("&larr;")} Browse all agents</a></p>
    </main>${footerBlock()}</body></html>`);
  }

  // Common tags across the category for internal links
  const tagRows = sqlite
    .prepare(
      `SELECT json_each.value AS tag, COUNT(*) AS count
       FROM agents, json_each(agents.categories) AS cat, json_each(agents.tags)
       WHERE cat.value = ?
       GROUP BY json_each.value
       ORDER BY count DESC LIMIT 20`
    )
    .all(slug) as Array<{ tag: string; count: number }>;

  const totalPages = Math.max(1, Math.ceil(list.total / limit));
  const pageUrl = siteUrl(c, `/categories/${encodeURIComponent(slug)}`);
  const title = `Best ${pretty} AI agents — Agora`;
  const description = `Discover ${list.total} AI agent${list.total === 1 ? "" : "s"} in the ${pretty} category. ${list.agents
    .slice(0, 3)
    .map((a: any) => a.name)
    .join(", ")}${list.agents.length > 3 ? ", and more." : "."}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    url: pageUrl,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: list.total,
      itemListElement: list.agents.slice(0, 10).map((a: any, i: number) => ({
        "@type": "ListItem",
        position: i + 1,
        url: siteUrl(c, `/agents/${a.id}`),
        name: a.name,
      })),
    },
  };

  return c.html(html`<!DOCTYPE html>
<html lang="en">
<head>
${metaBlock({
  title,
  description,
  url: pageUrl,
  image: siteUrl(c, `/v1/og/categories/${encodeURIComponent(slug)}.svg`),
  jsonLd,
})}
<style>${raw(baseStyles)}${raw(indexStyles)}</style>
</head>
<body>
${headerBlock()}
<main class="container">
  <section class="hero" style="padding-top:32px;padding-bottom:24px;">
    <div class="breadcrumb" style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px;"><a href="/" style="color:inherit;">Agora</a> / Categories / ${esc(pretty)}</div>
    <h1 style="font-size:2rem;letter-spacing:-0.02em;margin-bottom:8px;">${esc(pretty)} <span>agents</span></h1>
    <p style="color:var(--text-muted);max-width:620px;margin:0 auto;">${list.total} agent${list.total === 1 ? "" : "s"} registered under ${esc(pretty)}. Verified and healthy agents are shown first.</p>
  </section>

  ${
    tagRows.length
      ? html`<nav class="filters" aria-label="Popular tags">
          ${tagRows.map(
            (t) => html`<a class="filter-btn" href="/?category=${encodeURIComponent(slug)}&tag=${encodeURIComponent(t.tag)}">${esc(t.tag)} <span style="color:var(--text-muted);margin-left:4px;">${t.count}</span></a>`
          )}
        </nav>`
      : ""
  }

  <section class="agents-grid" aria-label="Agents">
    ${list.agents.map((a: any) => agentCardHtml(a))}
  </section>

  ${
    totalPages > 1
      ? html`<div class="pagination">
          ${page > 1
            ? html`<a href="${pageUrl}?page=${page - 1}">${raw("&larr;")} Prev</a>`
            : ""}
          <span class="current">Page ${page} of ${totalPages}</span>
          ${page < totalPages
            ? html`<a href="${pageUrl}?page=${page + 1}">Next ${raw("&rarr;")}</a>`
            : ""}
        </div>`
      : ""
  }
</main>
${footerBlock()}
</body>
</html>`);
});

export default app;
