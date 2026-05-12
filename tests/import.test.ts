import { describe, it, expect, afterEach } from "vitest";
import { call, mintKey } from "./helpers.js";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function stubAgentCard(card: any) {
  globalThis.fetch = (async (url: any) => {
    const u = typeof url === "string" ? url : url.url;
    if (u.endsWith("/.well-known/agent.json")) {
      return new Response(JSON.stringify(card), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    // mcp tools fetch
    return new Response("[]", { status: 404 });
  }) as typeof fetch;
}

describe("POST /v1/import/a2a", () => {
  it("imports an A2A card", async () => {
    const key = await mintKey();
    stubAgentCard({
      name: "Acme Agent",
      description: "Does acme things",
      url: "https://acme.com/agent",
      version: "1.0.0",
      provider: { organization: "Acme", url: "https://acme.com" },
      skills: [
        { id: "do", name: "Do Thing", description: "Performs the thing" },
      ],
      categories: ["automation"],
      tags: ["acme"],
    });

    const res = await call("POST", "/v1/import/a2a", {
      body: { url: "https://acme.com/.well-known/agent.json" },
      key,
    });
    expect(res.status).toBe(201);
    expect(res.body.imported).toBe(true);
    expect(res.body.updated).toBe(false);
    expect(res.body.agent.name).toBe("Acme Agent");
    expect(res.body.agent.protocols.a2a.agentCardUrl).toBe(
      "https://acme.com/.well-known/agent.json"
    );
  });

  it("is idempotent — re-importing same URL updates, doesn't duplicate", async () => {
    const key = await mintKey();
    stubAgentCard({
      name: "Acme",
      description: "First",
      url: "https://acme.com/agent",
    });
    const first = await call("POST", "/v1/import/a2a", {
      body: { url: "https://acme.com/.well-known/agent.json" },
      key,
    });
    expect(first.status).toBe(201);

    stubAgentCard({
      name: "Acme V2",
      description: "Updated",
      url: "https://acme.com/agent",
    });
    const second = await call("POST", "/v1/import/a2a", {
      body: { url: "https://acme.com/.well-known/agent.json" },
      key,
    });
    expect(second.status).toBe(200);
    expect(second.body.updated).toBe(true);
    expect(second.body.agent.id).toBe(first.body.agent.id);
    expect(second.body.agent.name).toBe("Acme V2");

    const list = await call("GET", "/v1/agents");
    expect(list.body.total).toBe(1);
  });

  it("rejects bad URLs", async () => {
    const key = await mintKey();
    const res = await call("POST", "/v1/import/a2a", {
      body: { url: "not-a-url" },
      key,
    });
    expect(res.status).toBe(400);
  });
});
