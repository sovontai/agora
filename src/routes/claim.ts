import { Hono } from "hono";
import { z } from "zod";
import { initiateClaim, confirmClaim } from "../services/claim.js";

const app = new Hono();

const ConfirmSchema = z.object({
  name: z.string().min(1).max(120).optional(),
});

/**
 * Begin claiming an imported (`claimable:*` owned) agent. Public — anyone who
 * can prove control of the agent URL host via DNS TXT can take ownership.
 */
app.post("/:id/claim", async (c) => {
  const id = c.req.param("id");
  const result = await initiateClaim(id);
  if ("error" in result) {
    if (result.error === "not_found") return c.json({ error: "not_found" }, 404);
    if (result.error === "not_claimable")
      return c.json(
        { error: "This agent is already owned. Use the regular update flow." },
        403
      );
    if (result.error === "invalid_url")
      return c.json({ error: "Agent has no http(s) URL to verify." }, 400);
  }
  return c.json(result);
});

/**
 * Confirm claim — re-checks the DNS TXT record, transfers ownership, and
 * returns a fresh API key. Public.
 */
app.post("/:id/claim/confirm", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const parsed = ConfirmSchema.safeParse(body ?? {});
  const claimName = parsed.success ? parsed.data.name : undefined;

  const result = await confirmClaim(id, claimName);
  if ("error" in result) {
    if (result.error === "not_found") return c.json({ error: "not_found" }, 404);
    if (result.error === "not_claimable")
      return c.json({ error: "not_claimable" }, 403);
    if (result.error === "no_claim_pending")
      return c.json({ error: "Call POST /v1/agents/:id/claim first." }, 400);
    return c.json(result, 400);
  }
  return c.json(result);
});

export default app;
