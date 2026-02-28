import { Hono } from "hono";
import { config } from "../config.js";
import { createApiKey } from "../services/keys.js";

const app = new Hono();

// Create API key (requires admin key or open registration)
app.post("/", async (c) => {
  // If ADMIN_KEY is set, require it. Otherwise, open registration.
  if (config.adminKey) {
    const auth = c.req.header("Authorization");
    if (auth !== `Bearer ${config.adminKey}`) {
      return c.json({ error: "Admin key required" }, 401);
    }
  }

  const body = await c.req.json().catch(() => ({}));
  const result = await createApiKey(body.name);
  return c.json(result, 201);
});

export default app;
