import { createMiddleware } from "hono/factory";
import { createHash } from "crypto";
import { db } from "../db/index.js";
import { apiKeys } from "../db/schema.js";
import { eq } from "drizzle-orm";

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export const requireAuth = createMiddleware(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid Authorization header" }, 401);
  }

  const key = authHeader.slice(7);
  const hash = hashKey(key);

  const [found] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, hash))
    .limit(1);

  if (!found) {
    return c.json({ error: "Invalid API key" }, 401);
  }

  // Update last used
  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date().toISOString() })
    .where(eq(apiKeys.id, found.id));

  c.set("apiKeyId" as never, found.id);
  await next();
});
