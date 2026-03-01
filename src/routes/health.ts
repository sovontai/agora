import { Hono } from "hono";
import { config } from "../config.js";
import { runHealthChecks } from "../services/health.js";

const app = new Hono();

// Trigger health checks (admin only)
app.post("/check", async (c) => {
  if (config.adminKey) {
    const auth = c.req.header("Authorization");
    if (auth !== `Bearer ${config.adminKey}`) {
      return c.json({ error: "Admin key required" }, 401);
    }
  }

  const results = await runHealthChecks();
  return c.json(results);
});

export default app;
