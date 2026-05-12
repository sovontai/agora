import { describe, it, expect } from "vitest";
import { call, mintKey, sampleAgent } from "./helpers.js";

describe("agent CRUD", () => {
  it("registers an agent and returns its public shape", async () => {
    const key = await mintKey();
    const res = await call("POST", "/v1/agents", {
      body: sampleAgent(),
      key,
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.name).toBe("Invoice Parser");
    expect(res.body.categories).toEqual(["finance", "document-processing"]);
    expect(res.body.protocols.a2a?.agentCardUrl).toContain("acme.com");
    expect(res.body.verification.verified).toBe(false);
  });

  it("requires auth for register", async () => {
    const res = await call("POST", "/v1/agents", { body: sampleAgent() });
    expect(res.status).toBe(401);
  });

  it("rejects malformed input with 400 + validation details", async () => {
    const key = await mintKey();
    const res = await call("POST", "/v1/agents", {
      body: { name: "x", description: "", url: "not-a-url" },
      key,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/validation/i);
  });

  it("fetches an agent publicly by id", async () => {
    const key = await mintKey();
    const created = (await call("POST", "/v1/agents", { body: sampleAgent(), key }))
      .body;
    const got = await call("GET", `/v1/agents/${created.id}`);
    expect(got.status).toBe(200);
    expect(got.body.id).toBe(created.id);
  });

  it("returns 404 for missing agent", async () => {
    const res = await call("GET", "/v1/agents/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });

  it("only the owner can update or delete", async () => {
    const keyA = await mintKey("A");
    const keyB = await mintKey("B");
    const a = (await call("POST", "/v1/agents", { body: sampleAgent(), key: keyA }))
      .body;

    const updateOther = await call("PUT", `/v1/agents/${a.id}`, {
      body: { name: "hijack" },
      key: keyB,
    });
    expect(updateOther.status).toBe(403);

    const updateOwn = await call("PUT", `/v1/agents/${a.id}`, {
      body: { name: "Renamed" },
      key: keyA,
    });
    expect(updateOwn.status).toBe(200);
    expect(updateOwn.body.name).toBe("Renamed");

    const delOther = await call("DELETE", `/v1/agents/${a.id}`, { key: keyB });
    expect(delOther.status).toBe(403);

    const delOwn = await call("DELETE", `/v1/agents/${a.id}`, { key: keyA });
    expect(delOwn.status).toBe(200);

    const gone = await call("GET", `/v1/agents/${a.id}`);
    expect(gone.status).toBe(404);
  });

  it("rejects FTS-special characters defensively (no crash)", async () => {
    const key = await mintKey();
    await call("POST", "/v1/agents", { body: sampleAgent(), key });
    // Strings like ' OR 1=1, AND, OR, quotes — must not 500 the server.
    for (const q of [`'; DROP TABLE agents; --`, `" OR ""="`, `parse AND invoice`, `*`, `"unterminated`]) {
      const res = await call("GET", `/v1/agents?q=${encodeURIComponent(q)}`);
      expect([200, 400]).toContain(res.status);
    }
  });
});

describe("agent search", () => {
  async function seed() {
    const key = await mintKey();
    await call("POST", "/v1/agents", {
      body: sampleAgent({
        name: "Finance Parser",
        url: "https://a.example.com/p",
        categories: ["finance"],
        tags: ["pdf", "invoice"],
        protocols: { a2a: { agentCardUrl: "https://a.example.com/.well-known/agent.json" } },
      }),
      key,
    });
    await call("POST", "/v1/agents", {
      body: sampleAgent({
        name: "Code Reviewer",
        description: "Reviews pull requests automatically.",
        url: "https://b.example.com/r",
        categories: ["dev-tools"],
        tags: ["github", "code-review"],
        protocols: { mcp: { serverUrl: "https://b.example.com/mcp" } },
      }),
      key,
    });
    return key;
  }

  it("returns all agents with no filters", async () => {
    await seed();
    const res = await call("GET", "/v1/agents");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.agents.length).toBe(2);
  });

  it("filters by category", async () => {
    await seed();
    const res = await call("GET", "/v1/agents?category=finance");
    expect(res.body.total).toBe(1);
    expect(res.body.agents[0].name).toBe("Finance Parser");
  });

  it("filters by tag", async () => {
    await seed();
    const res = await call("GET", "/v1/agents?tag=github");
    expect(res.body.total).toBe(1);
    expect(res.body.agents[0].name).toBe("Code Reviewer");
  });

  it("filters by protocol=a2a", async () => {
    await seed();
    const res = await call("GET", "/v1/agents?protocol=a2a");
    expect(res.body.total).toBe(1);
    expect(res.body.agents[0].protocols.a2a).toBeTruthy();
  });

  it("filters by protocol=mcp", async () => {
    await seed();
    const res = await call("GET", "/v1/agents?protocol=mcp");
    expect(res.body.total).toBe(1);
    expect(res.body.agents[0].protocols.mcp).toBeTruthy();
  });

  it("verified=false actually filters to non-verified", async () => {
    await seed();
    const res = await call("GET", "/v1/agents?verified=false");
    expect(res.body.total).toBe(2);
    const res2 = await call("GET", "/v1/agents?verified=true");
    expect(res2.body.total).toBe(0);
  });

  it("full-text search matches description", async () => {
    await seed();
    const res = await call("GET", "/v1/agents?q=pull");
    expect(res.body.total).toBe(1);
    expect(res.body.agents[0].name).toBe("Code Reviewer");
  });

  it("respects limit/offset and reports total", async () => {
    await seed();
    const res = await call("GET", "/v1/agents?limit=1&offset=0");
    expect(res.body.agents.length).toBe(1);
    expect(res.body.total).toBe(2);
    expect(res.body.limit).toBe(1);
    expect(res.body.offset).toBe(0);
  });
});

describe("stats and categories", () => {
  it("reports stats", async () => {
    const key = await mintKey();
    await call("POST", "/v1/agents", { body: sampleAgent(), key });
    const res = await call("GET", "/v1/stats");
    expect(res.status).toBe(200);
    expect(res.body.totalAgents).toBe(1);
    expect(res.body.verifiedAgents).toBe(0);
    expect(res.body.a2aAgents).toBe(1);
    expect(res.body.mcpAgents).toBe(0);
  });

  it("aggregates categories from registered agents", async () => {
    const key = await mintKey();
    await call("POST", "/v1/agents", {
      body: sampleAgent({ categories: ["finance", "ocr"] }),
      key,
    });
    await call("POST", "/v1/agents", {
      body: sampleAgent({
        name: "Another",
        url: "https://x.example.com",
        categories: ["finance"],
        protocols: undefined,
      }),
      key,
    });
    const res = await call("GET", "/v1/categories");
    expect(res.status).toBe(200);
    const finance = res.body.categories.find((c: any) => c.slug === "finance");
    expect(finance.agentCount).toBe(2);
  });
});
