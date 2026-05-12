import { Hono } from "hono";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth.js";
import { createApiKey } from "../services/keys.js";

const app = new Hono();

const CreateKeySchema = z.object({
  name: z.string().min(1).max(120).optional(),
  isAdmin: z.boolean().optional(),
});

/**
 * Create an API key. Fail-closed: requires admin auth — either the ADMIN_KEY
 * env var or an existing api key flagged is_admin.
 */
app.post("/", requireAdmin, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as unknown;
  const parsed = CreateKeySchema.parse(body ?? {});
  const result = await createApiKey(parsed.name, parsed.isAdmin ?? false);
  return c.json(result, 201);
});

export default app;
