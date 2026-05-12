import { describe, it, expect } from "vitest";
import { call, mintKey, sampleAgent } from "./helpers.js";

describe("public surface", () => {
  it("/health returns ok", async () => {
    const res = await call("GET", "/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("/v1 returns API info with endpoints", async () => {
    const res = await call("GET", "/v1");
    expect(res.status).toBe(200);
    expect(res.body.endpoints.agents).toBe("/v1/agents");
    expect(res.body.endpoints.openapi).toBeTruthy();
  });

  it("/v1/openapi.json is valid OpenAPI", async () => {
    const res = await call("GET", "/v1/openapi.json");
    expect(res.status).toBe(200);
    expect(res.body.openapi).toMatch(/^3\./);
    expect(res.body.paths["/v1/agents"].get.summary).toBeTruthy();
  });

  it("/.well-known/agora describes the instance", async () => {
    const res = await call("GET", "/.well-known/agora");
    expect(res.status).toBe(200);
    expect(res.body.protocol).toBe("agora/1");
    expect(res.body.endpoints.agents).toBe("/v1/agents");
  });

  it("/ renders HTML with OG tags", async () => {
    const res = await call("GET", "/");
    expect(res.status).toBe(200);
    const html = res.body as string;
    expect(html).toContain("<title>");
    expect(html).toContain("og:title");
    expect(html).toContain("application/ld+json");
  });

  it("/agents/:id renders an SSR page with JSON-LD", async () => {
    const key = await mintKey();
    const a = (await call("POST", "/v1/agents", { body: sampleAgent(), key })).body;
    const res = await call("GET", `/agents/${a.id}`);
    expect(res.status).toBe(200);
    const html = res.body as string;
    expect(html).toContain("Invoice Parser");
    expect(html).toContain("application/ld+json");
    expect(html).toContain("SoftwareApplication");
    expect(html).toContain(`/v1/badge/${a.id}.svg`);
  });

  it("/agents/:id returns a 404 page for missing agents", async () => {
    const res = await call("GET", "/agents/missing-id");
    expect(res.status).toBe(404);
  });

  it("/v1/badge/:id.svg returns an SVG", async () => {
    const key = await mintKey();
    const a = (await call("POST", "/v1/agents", { body: sampleAgent(), key })).body;
    const res = await call("GET", `/v1/badge/${a.id}.svg`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/svg/);
    expect(res.body as string).toContain("<svg");
    expect(res.body as string).toContain("registered");
  });

  it("badge says 'verified' once verification clears", async () => {
    const key = await mintKey();
    const a = (await call("POST", "/v1/agents", { body: sampleAgent(), key })).body;
    const init = await call("POST", `/v1/agents/${a.id}/verify`, {
      body: { domain: "agents.acme.com" },
      key,
    });
    const { setDnsResolver } = await import("../src/services/verification.js");
    setDnsResolver(async () => [[init.body.token]]);
    await call("POST", `/v1/agents/${a.id}/verify/confirm`, { key });
    const svg = await call("GET", `/v1/badge/${a.id}.svg`);
    expect(svg.body as string).toContain("verified");
    setDnsResolver(null);
  });
});
