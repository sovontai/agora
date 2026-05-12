import { describe, it, expect, beforeEach } from "vitest";
import { call, mintKey } from "./helpers.js";
import { setClaimDnsResolver } from "../src/services/claim.js";

const adminKey = () => process.env.ADMIN_KEY!;

describe("bulk import + claim", () => {
  beforeEach(() => setClaimDnsResolver(null));

  async function stubCard(map: Record<string, any>) {
    globalThis.fetch = (async (input: any) => {
      const u = typeof input === "string" ? input : input.url;
      if (map[u]) {
        return new Response(JSON.stringify(map[u]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("not found", { status: 404 });
    }) as typeof fetch;
  }

  it("bulk import seeds claimable agents", async () => {
    const card = {
      name: "Acme Agent",
      description: "Imported",
      url: "https://acme.com/agent",
    };
    await stubCard({ "https://acme.com/.well-known/agent.json": card });

    const res = await call("POST", "/v1/import/bulk", {
      body: { urls: ["https://acme.com/.well-known/agent.json"] },
      key: adminKey(),
    });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(1);
    expect(res.body.fail).toBe(0);
    const id = res.body.results[0].id;
    expect(id).toBeTruthy();

    const agent = await call("GET", `/v1/agents/${id}`);
    expect(agent.status).toBe(200);
    expect(agent.body.name).toBe("Acme Agent");
  });

  it("non-admin cannot bulk import", async () => {
    const key = await mintKey();
    const res = await call("POST", "/v1/import/bulk", {
      body: { urls: ["https://x.com/.well-known/agent.json"] },
      key,
    });
    expect(res.status).toBe(401);
  });

  it("a claimable agent can be claimed via DNS-TXT and transfers ownership", async () => {
    await stubCard({
      "https://acme.com/.well-known/agent.json": {
        name: "Acme",
        description: "Imported",
        url: "https://acme.com/agent",
      },
    });
    const imp = await call("POST", "/v1/import/bulk", {
      body: { urls: ["https://acme.com/.well-known/agent.json"] },
      key: adminKey(),
    });
    const id = imp.body.results[0].id;

    // Initiate claim (anonymous)
    const init = await call("POST", `/v1/agents/${id}/claim`, {});
    expect(init.status).toBe(200);
    expect(init.body.domain).toBe("acme.com");
    const token = init.body.token;
    expect(token).toMatch(/^agora-claim=/);

    setClaimDnsResolver(async () => [[token]]);

    // Confirm
    const confirm = await call("POST", `/v1/agents/${id}/claim/confirm`, {
      body: { name: "acme-prod" },
    });
    expect(confirm.status).toBe(200);
    expect(confirm.body.claimed).toBe(true);
    expect(confirm.body.apiKey.key).toMatch(/^agora_/);

    // The new key can now update the agent.
    const newKey = confirm.body.apiKey.key;
    const update = await call("PUT", `/v1/agents/${id}`, {
      body: { description: "Updated by new owner" },
      key: newKey,
    });
    expect(update.status).toBe(200);
    expect(update.body.description).toBe("Updated by new owner");

    // Old admin key shouldn't be able to update it anymore (it was a claimable
    // sentinel; admin auth gives a different ownerKeyId).
    // The original ownerKeyId was "claimable:<random>", no one can pass that as
    // an API key, so a non-owner attempt is implicitly forbidden.
    const otherKey = await mintKey();
    const otherUpdate = await call("PUT", `/v1/agents/${id}`, {
      body: { description: "Hijack" },
      key: otherKey,
    });
    expect(otherUpdate.status).toBe(403);

    // Verified after claim.
    const final = await call("GET", `/v1/agents/${id}`);
    expect(final.body.verification.verified).toBe(true);
    expect(final.body.verification.domain).toBe("acme.com");
  });

  it("claim fails when TXT record is missing", async () => {
    await stubCard({
      "https://acme.com/.well-known/agent.json": {
        name: "Acme",
        description: "Imported",
        url: "https://acme.com/agent",
      },
    });
    const imp = await call("POST", "/v1/import/bulk", {
      body: { urls: ["https://acme.com/.well-known/agent.json"] },
      key: adminKey(),
    });
    const id = imp.body.results[0].id;

    await call("POST", `/v1/agents/${id}/claim`, {});
    setClaimDnsResolver(async () => [["something-else"]]);
    const confirm = await call("POST", `/v1/agents/${id}/claim/confirm`, {});
    expect(confirm.status).toBe(400);
    expect(confirm.body.error).toBe("token_not_found");
  });

  it("an already-owned agent cannot be claimed", async () => {
    const key = await mintKey();
    const a = await call("POST", "/v1/agents", {
      body: {
        name: "Owned",
        description: "Already mine",
        url: "https://owned.example.com",
      },
      key,
    });
    const res = await call("POST", `/v1/agents/${a.body.id}/claim`, {});
    expect(res.status).toBe(403);
  });
});
