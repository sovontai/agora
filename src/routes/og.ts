import { Hono } from "hono";
import { getAgent, getStats } from "../services/agents.js";

const app = new Hono();

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) =>
    c === "<"
      ? "&lt;"
      : c === ">"
      ? "&gt;"
      : c === "&"
      ? "&amp;"
      : c === '"'
      ? "&quot;"
      : "&#39;"
  );
}

function svg(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=600, s-maxage=3600",
    },
  });
}

function wrap(text: string, charsPerLine: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (lines.length >= maxLines) break;
    if (!cur) {
      cur = w;
      continue;
    }
    if ((cur + " " + w).length > charsPerLine) {
      lines.push(cur);
      cur = w;
    } else {
      cur += " " + w;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length === maxLines && words.length > 0) {
    const last = lines[maxLines - 1];
    if (last.length > charsPerLine - 1) {
      lines[maxLines - 1] = last.slice(0, charsPerLine - 1) + "…";
    } else if (
      words.join(" ").length >
      lines.join(" ").length + (lines.length > 1 ? lines.length - 1 : 0)
    ) {
      lines[maxLines - 1] = last + "…";
    }
  }
  return lines;
}

function stripExt(slug: string): string {
  return slug.endsWith(".svg") ? slug.slice(0, -4) : slug;
}

/** Per-agent OG card. 1200x630. */
app.get("/agents/:slug", async (c) => {
  const id = stripExt(c.req.param("slug"));
  const agent = await getAgent(id);
  if (!agent) {
    return svg(brandedFrame("Agent not found", "", null));
  }
  const subtitle = agent.provider?.organization
    ? `by ${agent.provider.organization}`
    : "";
  return svg(brandedFrame(agent.name, agent.description, subtitle, {
    verified: agent.verification.verified,
    protocols: [
      agent.protocols?.a2a ? "A2A" : null,
      agent.protocols?.mcp ? "MCP" : null,
    ].filter(Boolean) as string[],
    tags: agent.tags ?? [],
  }));
});

/** Per-category OG card. */
app.get("/categories/:slug", async (c) => {
  const slug = stripExt(c.req.param("slug"));
  const pretty = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return svg(
    brandedFrame(
      `${pretty} agents`,
      `Browse AI agents in the ${pretty} category on Agora — the open registry for AI agents.`,
      "Agora",
      { protocols: ["category"], tags: [] }
    )
  );
});

/** Default homepage card. */
app.get("/site.svg", async () => {
  const stats = await getStats();
  return svg(
    brandedFrame(
      "Agora",
      `Open registry for AI agents. ${stats.totalAgents.toLocaleString()} agents indexed · ${stats.verifiedAgents.toLocaleString()} verified.`,
      "DNS for AI agents",
      { protocols: ["A2A", "MCP"], tags: [] }
    )
  );
});

function brandedFrame(
  title: string,
  description: string,
  subtitle: string | null,
  meta: {
    verified?: boolean;
    protocols?: string[];
    tags?: string[];
  } = {}
): string {
  const titleLines = wrap(title, 26, 2);
  const descLines = wrap(description, 60, 3);

  let y = 240;
  const titleSvg = titleLines
    .map((line) => {
      const t = `<text x="80" y="${y}" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="72" font-weight="800" fill="#e4e4e7" letter-spacing="-2">${escapeXml(line)}</text>`;
      y += 90;
      return t;
    })
    .join("\n");

  y += 8;
  const descY0 = y;
  const descSvg = descLines
    .map((line) => {
      const t = `<text x="80" y="${y}" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="32" font-weight="400" fill="#a1a1aa">${escapeXml(line)}</text>`;
      y += 44;
      return t;
    })
    .join("\n");

  let badges = "";
  let bx = 80;
  if (meta.verified) {
    badges += `<rect x="${bx}" y="540" width="120" height="38" rx="19" fill="#22c55e"/>
      <text x="${bx + 60}" y="566" text-anchor="middle" font-family="sans-serif" font-size="18" font-weight="600" fill="#0a0a0b">✓ Verified</text>`;
    bx += 132;
  }
  for (const p of meta.protocols ?? []) {
    const w = p.length > 4 ? p.length * 13 + 30 : 64;
    const color = p === "MCP" ? "#3b82f6" : p === "A2A" ? "#f59e0b" : "#6366f1";
    badges += `<rect x="${bx}" y="540" width="${w}" height="38" rx="19" fill="${color}"/>
      <text x="${bx + w / 2}" y="566" text-anchor="middle" font-family="sans-serif" font-size="18" font-weight="600" fill="#0a0a0b">${escapeXml(p)}</text>`;
    bx += w + 12;
  }

  const subtitleSvg = subtitle
    ? `<text x="80" y="170" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="24" font-weight="500" fill="#6366f1">${escapeXml(subtitle)}</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a0a0b"/>
      <stop offset="100%" stop-color="#141416"/>
    </linearGradient>
    <radialGradient id="glow" cx="85%" cy="20%" r="50%">
      <stop offset="0%" stop-color="#6366f1" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#6366f1" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>

  <!-- Brand -->
  <g transform="translate(80,90)">
    <text font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="28" font-weight="700" fill="#e4e4e7">
      <tspan>🏛️</tspan>
      <tspan dx="14">Agora</tspan>
    </text>
  </g>

  ${subtitleSvg}
  ${titleSvg}
  ${descSvg}
  ${badges}

  <!-- Footer -->
  <text x="80" y="610" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="22" fill="#71717a">agora.sovont.com</text>
  <text x="1120" y="610" text-anchor="end" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="22" fill="#71717a">open agent registry</text>
</svg>`;
}

export default app;
