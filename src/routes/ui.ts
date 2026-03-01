import { Hono } from "hono";
import { html } from "hono/html";

const app = new Hono();

const page = (content: string) => html`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agora — Agent Registry & Discovery</title>
  <meta name="description" content="Open agent registry and discovery service. DNS for AI agents.">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    
    :root {
      --bg: #0a0a0b;
      --surface: #141416;
      --surface-2: #1c1c20;
      --border: #2a2a30;
      --text: #e4e4e7;
      --text-muted: #8b8b94;
      --accent: #6366f1;
      --accent-dim: #4f46e5;
      --green: #22c55e;
      --green-dim: rgba(34, 197, 94, 0.12);
      --blue: #3b82f6;
      --blue-dim: rgba(59, 130, 246, 0.12);
      --orange: #f59e0b;
      --orange-dim: rgba(245, 158, 11, 0.12);
      --radius: 8px;
      --radius-lg: 12px;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      min-height: 100vh;
    }

    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }

    .container { max-width: 960px; margin: 0 auto; padding: 0 20px; }

    /* Header */
    header {
      border-bottom: 1px solid var(--border);
      padding: 20px 0;
    }
    .header-inner {
      display: flex; align-items: center; justify-content: space-between;
    }
    .logo {
      font-size: 1.5rem; font-weight: 700; color: var(--text);
      display: flex; align-items: center; gap: 10px;
    }
    .logo-icon { font-size: 1.8rem; }
    .header-links { display: flex; gap: 20px; font-size: 0.875rem; }
    .header-links a { color: var(--text-muted); }
    .header-links a:hover { color: var(--text); text-decoration: none; }

    /* Hero */
    .hero {
      text-align: center;
      padding: 60px 0 40px;
    }
    .hero h1 {
      font-size: 2.5rem; font-weight: 800; letter-spacing: -0.03em;
      margin-bottom: 12px;
    }
    .hero h1 span { color: var(--accent); }
    .hero p {
      font-size: 1.1rem; color: var(--text-muted); max-width: 560px; margin: 0 auto 32px;
    }

    /* Stats bar */
    .stats-bar {
      display: flex; justify-content: center; gap: 40px;
      margin-bottom: 40px; font-size: 0.875rem;
    }
    .stat { text-align: center; }
    .stat-num { font-size: 1.5rem; font-weight: 700; color: var(--text); }
    .stat-label { color: var(--text-muted); margin-top: 2px; }

    /* Search */
    .search-box {
      position: relative; max-width: 600px; margin: 0 auto 16px;
    }
    .search-box input {
      width: 100%; padding: 14px 20px 14px 48px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--radius-lg); color: var(--text);
      font-size: 1rem; outline: none; transition: border-color 0.2s;
    }
    .search-box input:focus { border-color: var(--accent); }
    .search-box input::placeholder { color: var(--text-muted); }
    .search-icon {
      position: absolute; left: 16px; top: 50%; transform: translateY(-50%);
      color: var(--text-muted); font-size: 1.1rem; pointer-events: none;
    }

    /* Filters */
    .filters {
      display: flex; flex-wrap: wrap; justify-content: center; gap: 8px;
      margin-bottom: 40px;
    }
    .filter-btn {
      padding: 6px 14px; border-radius: 20px; font-size: 0.8rem;
      background: var(--surface); border: 1px solid var(--border);
      color: var(--text-muted); cursor: pointer; transition: all 0.2s;
    }
    .filter-btn:hover, .filter-btn.active {
      border-color: var(--accent); color: var(--accent); background: rgba(99, 102, 241, 0.08);
    }

    /* Agent cards */
    .agents-grid { display: flex; flex-direction: column; gap: 12px; }
    
    .agent-card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--radius-lg); padding: 20px 24px;
      transition: border-color 0.2s; cursor: pointer;
    }
    .agent-card:hover { border-color: var(--accent-dim); }

    .agent-header { display: flex; align-items: start; justify-content: space-between; margin-bottom: 8px; }
    .agent-name {
      font-size: 1.1rem; font-weight: 600;
      display: flex; align-items: center; gap: 8px;
    }
    .verified-badge {
      display: inline-flex; align-items: center; gap: 3px;
      font-size: 0.7rem; color: var(--green); background: var(--green-dim);
      padding: 2px 8px; border-radius: 10px; font-weight: 500;
    }
    .agent-provider {
      font-size: 0.8rem; color: var(--text-muted); margin-bottom: 8px;
    }
    .agent-desc {
      font-size: 0.9rem; color: var(--text-muted); line-height: 1.5;
      margin-bottom: 12px;
    }
    .agent-meta { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .tag {
      font-size: 0.72rem; padding: 3px 10px; border-radius: 12px;
      background: var(--surface-2); color: var(--text-muted); border: 1px solid var(--border);
    }
    .protocol-badge {
      font-size: 0.72rem; padding: 3px 10px; border-radius: 12px;
      font-weight: 600; letter-spacing: 0.02em;
    }
    .protocol-mcp { background: var(--blue-dim); color: var(--blue); }
    .protocol-a2a { background: var(--orange-dim); color: var(--orange); }

    /* Agent detail modal */
    .modal-overlay {
      display: none; position: fixed; inset: 0;
      background: rgba(0,0,0,0.7); z-index: 100;
      align-items: center; justify-content: center; padding: 20px;
    }
    .modal-overlay.active { display: flex; }
    .modal {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--radius-lg); max-width: 640px; width: 100%;
      max-height: 80vh; overflow-y: auto; padding: 32px;
    }
    .modal-close {
      float: right; background: none; border: none; color: var(--text-muted);
      font-size: 1.5rem; cursor: pointer; line-height: 1;
    }
    .modal-close:hover { color: var(--text); }
    .modal h2 { font-size: 1.3rem; margin-bottom: 4px; }
    .modal-provider { color: var(--text-muted); font-size: 0.85rem; margin-bottom: 16px; }
    .modal-desc { margin-bottom: 20px; color: var(--text-muted); font-size: 0.95rem; line-height: 1.6; }
    .modal-section { margin-bottom: 16px; }
    .modal-section h3 { font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
    .modal-url { word-break: break-all; }
    .cap-list { list-style: none; }
    .cap-list li {
      padding: 8px 12px; background: var(--surface-2); border-radius: var(--radius);
      margin-bottom: 6px; font-size: 0.875rem;
    }
    .cap-name { font-weight: 600; }
    .cap-desc { color: var(--text-muted); font-size: 0.8rem; }

    /* Empty state */
    .empty { text-align: center; padding: 60px 20px; color: var(--text-muted); }
    .empty-icon { font-size: 3rem; margin-bottom: 16px; }

    /* Footer */
    footer {
      border-top: 1px solid var(--border); margin-top: 60px;
      padding: 24px 0; text-align: center;
      font-size: 0.8rem; color: var(--text-muted);
    }
    footer a { color: var(--text-muted); }
    footer a:hover { color: var(--text); }

    /* Loading */
    .loading { text-align: center; padding: 40px; color: var(--text-muted); }

    @media (max-width: 600px) {
      .hero h1 { font-size: 1.8rem; }
      .stats-bar { gap: 24px; }
      .agent-card { padding: 16px; }
      .header-links { gap: 12px; }
    }
  </style>
</head>
<body>
  <header>
    <div class="container header-inner">
      <div class="logo"><span class="logo-icon">🏛️</span> Agora</div>
      <div class="header-links">
        <a href="/v1/agents" target="_blank">API</a>
        <a href="https://github.com/sovontai/agora" target="_blank">GitHub</a>
        <a href="https://sovont.com/blog/introducing-agora-dns-for-ai-agents" target="_blank">Blog</a>
        <a href="https://sovont.com" target="_blank">Sovont</a>
      </div>
    </div>
  </header>

  <main class="container">
    <div class="hero">
      <h1>Discover <span>AI Agents</span></h1>
      <p>The open registry for AI agents. Search by capability, protocol, or category. Built for the A2A and MCP ecosystem.</p>
    </div>

    <div class="stats-bar" id="stats">
      <div class="stat"><div class="stat-num" id="stat-total">—</div><div class="stat-label">Agents</div></div>
      <div class="stat"><div class="stat-num" id="stat-mcp">—</div><div class="stat-label">MCP</div></div>
      <div class="stat"><div class="stat-num" id="stat-a2a">—</div><div class="stat-label">A2A</div></div>
      <div class="stat"><div class="stat-num" id="stat-verified">—</div><div class="stat-label">Verified</div></div>
    </div>

    <div class="search-box">
      <span class="search-icon">⌕</span>
      <input type="text" id="search" placeholder="Search agents by name, capability, or description..." autofocus />
    </div>

    <div class="filters" id="filters"></div>

    <div class="agents-grid" id="agents">
      <div class="loading">Loading agents...</div>
    </div>
  </main>

  <div class="modal-overlay" id="modal-overlay">
    <div class="modal" id="modal"></div>
  </div>

  <footer>
    <div class="container">
      Agora v0.1.0 — Open Agent Registry & Discovery — 
      <a href="https://github.com/sovontai/agora">Apache 2.0</a> — 
      Built by <a href="https://sovont.com">Sovont</a>
    </div>
  </footer>

  <script>
    const API = '/v1';
    let allAgents = [];
    let activeCategory = null;

    async function init() {
      const [statsRes, agentsRes] = await Promise.all([
        fetch(API + '/stats').then(r => r.json()),
        fetch(API + '/agents?limit=100').then(r => r.json())
      ]);

      document.getElementById('stat-total').textContent = statsRes.totalAgents;
      document.getElementById('stat-mcp').textContent = statsRes.mcpAgents;
      document.getElementById('stat-a2a').textContent = statsRes.a2aAgents;
      document.getElementById('stat-verified').textContent = statsRes.verifiedAgents;

      allAgents = agentsRes.agents || [];
      
      // Extract categories
      const cats = new Set();
      allAgents.forEach(a => (a.categories || []).forEach(c => cats.add(c)));
      renderFilters([...cats].sort());
      renderAgents(allAgents);
    }

    function renderFilters(categories) {
      const el = document.getElementById('filters');
      el.innerHTML = '<button class="filter-btn active" data-cat="">All</button>' +
        categories.map(c => '<button class="filter-btn" data-cat="' + c + '">' + c + '</button>').join('');
      
      el.addEventListener('click', (e) => {
        if (!e.target.matches('.filter-btn')) return;
        el.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        activeCategory = e.target.dataset.cat || null;
        filterAndRender();
      });
    }

    function filterAndRender() {
      const q = document.getElementById('search').value.toLowerCase().trim();
      let filtered = allAgents;

      if (q) {
        filtered = filtered.filter(a =>
          a.name.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          (a.tags || []).some(t => t.toLowerCase().includes(q)) ||
          (a.categories || []).some(c => c.toLowerCase().includes(q)) ||
          (a.capabilities || []).some(c => c.name.toLowerCase().includes(q))
        );
      }

      if (activeCategory) {
        filtered = filtered.filter(a => (a.categories || []).includes(activeCategory));
      }

      renderAgents(filtered);
    }

    function renderAgents(agents) {
      const el = document.getElementById('agents');
      if (!agents.length) {
        el.innerHTML = '<div class="empty"><div class="empty-icon">🔍</div>No agents found. Try a different search.</div>';
        return;
      }

      el.innerHTML = agents.map(a => {
        const protocols = [];
        if (a.protocols?.mcp) protocols.push('<span class="protocol-badge protocol-mcp">MCP</span>');
        if (a.protocols?.a2a) protocols.push('<span class="protocol-badge protocol-a2a">A2A</span>');
        
        const tags = (a.tags || []).slice(0, 4).map(t => '<span class="tag">' + t + '</span>').join('');
        const verified = a.verification?.verified ? '<span class="verified-badge">✓ Verified</span>' : '';
        const provider = a.provider?.organization ? '<div class="agent-provider">by ' + a.provider.organization + '</div>' : '';
        
        return '<div class="agent-card" data-id="' + a.id + '">' +
          '<div class="agent-header"><div class="agent-name">' + esc(a.name) + ' ' + verified + '</div></div>' +
          provider +
          '<div class="agent-desc">' + esc(a.description) + '</div>' +
          '<div class="agent-meta">' + protocols.join('') + tags + '</div>' +
          '</div>';
      }).join('');

      el.querySelectorAll('.agent-card').forEach(card => {
        card.addEventListener('click', () => showAgent(card.dataset.id));
      });
    }

    async function showAgent(id) {
      const a = allAgents.find(x => x.id === id);
      if (!a) return;

      const protocols = [];
      if (a.protocols?.mcp) protocols.push('<span class="protocol-badge protocol-mcp">MCP</span>');
      if (a.protocols?.a2a) protocols.push('<span class="protocol-badge protocol-a2a">A2A</span>');

      const caps = (a.capabilities || []).map(c =>
        '<li><span class="cap-name">' + esc(c.name) + '</span>' +
        (c.description ? '<div class="cap-desc">' + esc(c.description) + '</div>' : '') + '</li>'
      ).join('');

      const tags = (a.tags || []).map(t => '<span class="tag">' + t + '</span>').join(' ');
      const verified = a.verification?.verified
        ? '<span class="verified-badge">✓ Verified — ' + a.verification.domain + '</span>'
        : '<span style="color:var(--text-muted);font-size:0.8rem">Not verified</span>';

      document.getElementById('modal').innerHTML =
        '<button class="modal-close" id="modal-close">&times;</button>' +
        '<h2>' + esc(a.name) + ' ' + protocols.join(' ') + '</h2>' +
        (a.provider?.organization ? '<div class="modal-provider">by ' + esc(a.provider.organization) + '</div>' : '') +
        '<div class="modal-desc">' + esc(a.description) + '</div>' +
        '<div class="modal-section"><h3>URL</h3><a class="modal-url" href="' + esc(a.url) + '" target="_blank">' + esc(a.url) + '</a></div>' +
        (a.version ? '<div class="modal-section"><h3>Version</h3>' + esc(a.version) + '</div>' : '') +
        '<div class="modal-section"><h3>Verification</h3>' + verified + '</div>' +
        (caps ? '<div class="modal-section"><h3>Capabilities</h3><ul class="cap-list">' + caps + '</ul></div>' : '') +
        '<div class="modal-section"><h3>Tags</h3><div class="agent-meta">' + tags + '</div></div>' +
        '<div class="modal-section" style="margin-top:20px;font-size:0.75rem;color:var(--text-muted)">Registered: ' + new Date(a.registeredAt).toLocaleDateString() + '</div>';

      const overlay = document.getElementById('modal-overlay');
      overlay.classList.add('active');
      document.getElementById('modal-close').addEventListener('click', () => overlay.classList.remove('active'));
      overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('active'); });
    }

    function esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    document.getElementById('search').addEventListener('input', debounce(filterAndRender, 200));
    function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') document.getElementById('modal-overlay').classList.remove('active');
    });

    init();
  </script>
</body>
</html>`;

app.get("/", (c) => {
  return c.html(page(""));
});

export default app;
