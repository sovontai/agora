import { describe, it, expect, beforeEach } from "vitest";
import { call, mintKey, sampleAgent } from "./helpers.js";
import {
  isDomainRelatedToUrl,
  reverifyAllVerified,
  setDnsResolver,
} from "../src/services/verification.js";

describe("isDomainRelatedToUrl", () => {
  it("accepts exact host match", () => {
    expect(isDomainRelatedToUrl("acme.com", "https://acme.com/agent")).toBe(true);
  });
  it("accepts a parent of the host", () => {
    expect(isDomainRelatedToUrl("acme.com", "https://api.acme.com/x")).toBe(true);
  });
  it("accepts a subdomain of the claimed domain (wildcard)", () => {
    expect(isDomainRelatedToUrl("api.acme.com", "https://acme.com/x")).toBe(true);
  });
  it("rejects an unrelated domain", () => {
    expect(isDomainRelatedToUrl("evil.com", "https://acme.com/x")).toBe(false);
    expect(isDomainRelatedToUrl("acmecorp.com", "https://acme.com/x")).toBe(false);
  });
  it("rejects malformed domains", () => {
    expect(isDomainRelatedToUrl("not a domain", "https://acme.com/x")).toBe(false);
    expect(isDomainRelatedToUrl("/path", "https://acme.com/x")).toBe(false);
  });
  it("rejects non-http URLs", () => {
    expect(isDomainRelatedToUrl("acme.com", "ftp://acme.com")).toBe(false);
  });
});

describe("verification endpoints", () => {
  beforeEach(() => setDnsResolver(null));

  it("rejects initiation with a domain unrelated to URL", async () => {
    const key = await mintKey();
    const a = (await call("POST", "/v1/agents", { body: sampleAgent(), key })).body;
    const res = await call("POST", `/v1/agents/${a.id}/verify`, {
      body: { domain: "evil.com" },
      key,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/registrable/i);
  });

  it("issues a verification token for a related domain", async () => {
    const key = await mintKey();
    const a = (await call("POST", "/v1/agents", { body: sampleAgent(), key })).body;
    const res = await call("POST", `/v1/agents/${a.id}/verify`, {
      body: { domain: "acme.com" },
      key,
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toMatch(/^agora-verify=/);
    expect(res.body.instructions.record).toBe("_agora-verify.acme.com");
  });

  it("confirms when the DNS TXT record matches the token", async () => {
    const key = await mintKey();
    const a = (await call("POST", "/v1/agents", { body: sampleAgent(), key })).body;
    const init = await call("POST", `/v1/agents/${a.id}/verify`, {
      body: { domain: "agents.acme.com" },
      key,
    });
    const token = init.body.token;

    setDnsResolver(async () => [[token]]);

    const confirm = await call("POST", `/v1/agents/${a.id}/verify/confirm`, { key });
    expect(confirm.status).toBe(200);
    expect(confirm.body.verified).toBe(true);

    const fetched = await call("GET", `/v1/agents/${a.id}`);
    expect(fetched.body.verification.verified).toBe(true);
    expect(fetched.body.verification.domain).toBe("agents.acme.com");
  });

  it("fails confirmation when the record is missing", async () => {
    const key = await mintKey();
    const a = (await call("POST", "/v1/agents", { body: sampleAgent(), key })).body;
    await call("POST", `/v1/agents/${a.id}/verify`, {
      body: { domain: "agents.acme.com" },
      key,
    });
    setDnsResolver(async () => [["nothing-matches"]]);

    const confirm = await call("POST", `/v1/agents/${a.id}/verify/confirm`, { key });
    expect(confirm.body.verified).toBe(false);
    expect(confirm.body.error).toBe("token_not_found");
  });

  it("URL changes invalidate prior verification", async () => {
    const key = await mintKey();
    const a = (await call("POST", "/v1/agents", { body: sampleAgent(), key })).body;
    const init = await call("POST", `/v1/agents/${a.id}/verify`, {
      body: { domain: "agents.acme.com" },
      key,
    });
    setDnsResolver(async () => [[init.body.token]]);
    await call("POST", `/v1/agents/${a.id}/verify/confirm`, { key });

    const updated = await call("PUT", `/v1/agents/${a.id}`, {
      body: { url: "https://moved.example.com/agent" },
      key,
    });
    expect(updated.body.verification.verified).toBe(false);
    expect(updated.body.verification.domain).toBe(null);
  });

  it("reverify drops the flag if TXT record disappears", async () => {
    const key = await mintKey();
    const a = (await call("POST", "/v1/agents", { body: sampleAgent(), key })).body;
    const init = await call("POST", `/v1/agents/${a.id}/verify`, {
      body: { domain: "agents.acme.com" },
      key,
    });
    setDnsResolver(async () => [[init.body.token]]);
    await call("POST", `/v1/agents/${a.id}/verify/confirm`, { key });

    setDnsResolver(async () => [["something-else"]]);
    const r = await reverifyAllVerified();
    expect(r.revoked).toBe(1);
    expect(r.stillVerified).toBe(0);

    const final = await call("GET", `/v1/agents/${a.id}`);
    expect(final.body.verification.verified).toBe(false);
  });
});
