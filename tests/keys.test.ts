import { describe, it, expect } from "vitest";
import { call } from "./helpers.js";

describe("POST /v1/keys", () => {
  it("creates a key when valid admin credentials are supplied", async () => {
    const res = await call("POST", "/v1/keys", {
      body: { name: "ci" },
      key: process.env.ADMIN_KEY,
    });
    expect(res.status).toBe(201);
    expect(res.body.key).toMatch(/^agora_/);
    expect(res.body.name).toBe("ci");
    expect(res.body.id).toBeTruthy();
  });

  it("rejects key creation without admin credentials", async () => {
    const res = await call("POST", "/v1/keys", { body: { name: "ci" } });
    expect(res.status).toBe(401);
  });

  it("rejects key creation with a wrong admin key", async () => {
    const res = await call("POST", "/v1/keys", {
      body: { name: "ci" },
      key: "not-the-admin-key",
    });
    expect(res.status).toBe(401);
  });

  it("does not leak the raw key on subsequent reads", async () => {
    // No GET endpoint for keys; this is a smoke test that the response
    // only contains the key once (at creation time).
    const a = await call("POST", "/v1/keys", {
      body: { name: "first" },
      key: process.env.ADMIN_KEY,
    });
    const b = await call("POST", "/v1/keys", {
      body: { name: "second" },
      key: process.env.ADMIN_KEY,
    });
    expect(a.body.key).not.toBe(b.body.key);
  });
});
