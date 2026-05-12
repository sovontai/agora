import { Hono } from "hono";
import { requireAdmin } from "../middleware/auth.js";
import { runHealthChecks } from "../services/health.js";
import { reverifyAllVerified } from "../services/verification.js";

const app = new Hono();

/** Admin: kick off a full health sweep now. */
app.post("/check", requireAdmin, async (c) => {
  const results = await runHealthChecks();
  return c.json(results);
});

/** Admin: re-verify every currently-verified agent's DNS TXT record. */
app.post("/reverify", requireAdmin, async (c) => {
  const result = await reverifyAllVerified();
  return c.json(result);
});

export default app;
