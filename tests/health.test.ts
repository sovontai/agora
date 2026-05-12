import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { call, mintKey, sampleAgent } from "./helpers.js";
import { runHealthChecks, probe } from "../src/services/health.js";

const originalFetch = globalThis.fetch;

function stubFetch(fn: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = typeof input === "string" ? input : input.url;
    return fn(url, init);
  }) as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("probe", () => {
  it("returns healthy on 200", async () => {
    stubFetch(() => new Response(null, { status: 200 }));
    const r = await probe("https://x.example.com");
    expect(r.status).toBe("healthy");
    expect(r.statusCode).toBe(200);
  });

  it("falls back from HEAD to GET on 405", async () => {
    let calls: string[] = [];
    stubFetch((url, init) => {
      calls.push(init?.method ?? "GET");
      if (calls.length === 1) return new Response(null, { status: 405 });
      return new Response("ok", { status: 200 });
    });
    const r = await probe("https://x.example.com");
    expect(calls).toEqual(["HEAD", "GET"]);
    expect(r.status).toBe("healthy");
  });

  it("treats 401/403 as 'reachable' (auth required)", async () => {
    stubFetch(() => new Response(null, { status: 401 }));
    const r = await probe("https://x.example.com");
    expect(r.status).toBe("reachable");
  });

  it("marks server errors unhealthy", async () => {
    stubFetch(() => new Response(null, { status: 503 }));
    const r = await probe("https://x.example.com");
    expect(r.status).toBe("unhealthy:503");
  });

  it("marks fetch errors unreachable", async () => {
    stubFetch(() => {
      throw new Error("ECONNREFUSED");
    });
    const r = await probe("https://x.example.com");
    expect(r.status).toMatch(/^unreachable:/);
  });
});

describe("pingAgent + runHealthChecks", () => {
  it("ping updates last_ping_status", async () => {
    const key = await mintKey();
    const a = (await call("POST", "/v1/agents", { body: sampleAgent(), key })).body;
    stubFetch(() => new Response(null, { status: 200 }));
    const res = await call("POST", `/v1/agents/${a.id}/ping`, { key });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("healthy");

    const fetched = await call("GET", `/v1/agents/${a.id}`);
    expect(fetched.body.health.status).toBe("healthy");
  });

  it("consecutive failures eventually mark agent inactive", async () => {
    const key = await mintKey();
    const a = (await call("POST", "/v1/agents", { body: sampleAgent(), key })).body;
    stubFetch(() => {
      throw new Error("ECONNREFUSED");
    });
    for (let i = 0; i < 24; i++) await runHealthChecks();
    const fetched = await call("GET", `/v1/agents/${a.id}`);
    expect(fetched.body.status).toBe("inactive");
    expect(fetched.body.health.consecutiveFailures).toBeGreaterThanOrEqual(24);
  });

  it("a successful ping reactivates an inactive agent", async () => {
    const key = await mintKey();
    const a = (await call("POST", "/v1/agents", { body: sampleAgent(), key })).body;
    stubFetch(() => {
      throw new Error("ECONNREFUSED");
    });
    for (let i = 0; i < 24; i++) await runHealthChecks();
    expect((await call("GET", `/v1/agents/${a.id}`)).body.status).toBe("inactive");

    stubFetch(() => new Response(null, { status: 200 }));
    await runHealthChecks();
    expect((await call("GET", `/v1/agents/${a.id}`)).body.status).toBe("active");
  });
});
