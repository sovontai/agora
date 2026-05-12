import { describe, it, expect } from "vitest";
import { call, mintKey, sampleAgent } from "./helpers.js";

describe("SEO surfaces", () => {
  it("/robots.txt allows AI crawlers and links the sitemap", async () => {
    const res = await call("GET", "/robots.txt");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    const body = res.body as string;
    expect(body).toContain("User-agent: GPTBot");
    expect(body).toContain("User-agent: ClaudeBot");
    expect(body).toContain("User-agent: PerplexityBot");
    expect(body).toContain("Sitemap:");
  });

  it("/sitemap.xml includes registered agents", async () => {
    const key = await mintKey();
    const a = (await call("POST", "/v1/agents", { body: sampleAgent(), key })).body;
    const res = await call("GET", "/sitemap.xml");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("xml");
    const xml = res.body as string;
    expect(xml).toContain("<urlset");
    expect(xml).toContain(`/agents/${a.id}`);
  });

  it("/llms.txt describes the registry in markdown", async () => {
    const key = await mintKey();
    await call("POST", "/v1/agents", { body: sampleAgent(), key });
    const res = await call("GET", "/llms.txt");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    const body = res.body as string;
    expect(body).toContain("# Agora");
    expect(body).toContain("## Top categories");
  });
});

describe("OG image endpoints", () => {
  it("returns SVG for an agent", async () => {
    const key = await mintKey();
    const a = (await call("POST", "/v1/agents", { body: sampleAgent(), key })).body;
    const res = await call("GET", `/v1/og/agents/${a.id}.svg`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("svg");
    expect(res.body as string).toContain("<svg");
    expect(res.body as string).toContain("Agora");
    expect(res.body as string).toContain("Invoice Parser");
  });

  it("returns SVG for a category", async () => {
    const res = await call("GET", "/v1/og/categories/finance.svg");
    expect(res.status).toBe(200);
    expect(res.body as string).toContain("Finance");
  });

  it("returns SVG for the site", async () => {
    const res = await call("GET", "/v1/og/site.svg");
    expect(res.status).toBe(200);
    expect(res.body as string).toContain("DNS for AI agents");
  });
});

describe("Category landing pages", () => {
  it("renders a category page with structured data and links to agents", async () => {
    const key = await mintKey();
    const a = (await call("POST", "/v1/agents", {
      body: sampleAgent({ categories: ["finance"] }),
      key,
    })).body;
    const res = await call("GET", "/categories/finance");
    expect(res.status).toBe(200);
    const html = res.body as string;
    expect(html).toContain("Finance");
    expect(html).toContain("application/ld+json");
    expect(html).toContain("CollectionPage");
    expect(html).toContain(`/agents/${a.id}`);
  });

  it("returns 404 for a category with no agents", async () => {
    const res = await call("GET", "/categories/nonexistent-thing");
    expect(res.status).toBe(404);
  });
});
