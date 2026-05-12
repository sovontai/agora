import { Hono } from "hono";
import { getAgent } from "../services/agents.js";

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

function badgeSvg(label: string, value: string, color: string): string {
  const labelW = label.length * 6.5 + 14;
  const valueW = value.length * 6.5 + 14;
  const total = labelW + valueW;
  const labelX = labelW / 2;
  const valueX = labelW + valueW / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${total.toFixed(0)}" height="20" role="img" aria-label="${escapeXml(label)}: ${escapeXml(value)}">
  <linearGradient id="b" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <mask id="a"><rect width="${total.toFixed(0)}" height="20" rx="3" fill="#fff"/></mask>
  <g mask="url(#a)">
    <rect width="${labelW.toFixed(0)}" height="20" fill="#555"/>
    <rect x="${labelW.toFixed(0)}" width="${valueW.toFixed(0)}" height="20" fill="${color}"/>
    <rect width="${total.toFixed(0)}" height="20" fill="url(#b)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,DejaVu Sans,Geneva,sans-serif" font-size="11">
    <text x="${labelX.toFixed(1)}" y="15" fill="#010101" fill-opacity=".3">${escapeXml(label)}</text>
    <text x="${labelX.toFixed(1)}" y="14">${escapeXml(label)}</text>
    <text x="${valueX.toFixed(1)}" y="15" fill="#010101" fill-opacity=".3">${escapeXml(value)}</text>
    <text x="${valueX.toFixed(1)}" y="14">${escapeXml(value)}</text>
  </g>
</svg>`;
}

function svgResponse(svg: string): Response {
  return new Response(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}

// Strip `.svg` if present; Hono v4 won't capture `:id` when the route has a `.svg` literal.
function stripExt(slug: string): string {
  return slug.endsWith(".svg") ? slug.slice(0, -4) : slug;
}

/** Verification badge — embedded by agent owners. `/v1/badge/<id>` or `/v1/badge/<id>.svg`. */
app.get("/:slug", async (c) => {
  const id = stripExt(c.req.param("slug"));
  const agent = await getAgent(id);
  if (!agent) {
    return svgResponse(badgeSvg("agora", "not found", "#888"));
  }
  const verified = agent.verification.verified;
  return svgResponse(
    badgeSvg(
      "agora",
      verified ? "verified" : "registered",
      verified ? "#22c55e" : "#6366f1"
    )
  );
});

/** Health badge. `/v1/badge/<id>/health.svg`. */
app.get("/:slug/health.svg", async (c) => {
  const id = stripExt(c.req.param("slug"));
  const agent = await getAgent(id);
  if (!agent) return svgResponse(badgeSvg("agora", "not found", "#888"));
  const status = agent.health.status ?? "unknown";
  const color =
    status === "healthy"
      ? "#22c55e"
      : status === "reachable"
      ? "#3b82f6"
      : status.startsWith("unhealthy")
      ? "#f59e0b"
      : status.startsWith("unreachable")
      ? "#ef4444"
      : "#888";
  const label = status.split(":")[0];
  return svgResponse(badgeSvg("agora health", label, color));
});

export default app;
