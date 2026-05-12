import { createMiddleware } from "hono/factory";
import { createHash, timingSafeEqual } from "crypto";
import { db } from "../db/index.js";
import { apiKeys } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { config } from "../config.js";

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

declare module "hono" {
  interface ContextVariableMap {
    ownerKeyId: string;
    isAdmin: boolean;
  }
}

/**
 * Verify an `Authorization: Bearer …` header against the api_keys table.
 * Returns the row id on success; null otherwise.
 */
async function lookupKey(headerValue: string | undefined) {
  if (!headerValue?.startsWith("Bearer ")) return null;
  const raw = headerValue.slice(7).trim();
  if (!raw) return null;
  const hash = hashKey(raw);
  const [found] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, hash))
    .limit(1);
  if (!found) return null;
  // Update last_used opportunistically (don't await; non-fatal).
  db.update(apiKeys)
    .set({ lastUsedAt: new Date().toISOString() })
    .where(eq(apiKeys.id, found.id))
    .catch(() => {});
  return found;
}

export const requireAuth = createMiddleware(async (c, next) => {
  const found = await lookupKey(c.req.header("Authorization"));
  if (!found) {
    return c.json(
      { error: "Missing or invalid API key" },
      401,
      { "WWW-Authenticate": 'Bearer realm="agora"' }
    );
  }
  c.set("ownerKeyId", found.id);
  c.set("isAdmin", Boolean(found.isAdmin));
  await next();
});

/**
 * Constant-time string compare to avoid leaking the admin key via timing.
 */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Admin = either the ADMIN_KEY env (if set) or a stored api key flagged is_admin.
 * If neither matches, returns 401.
 *
 * Fail-closed: if ADMIN_KEY is unset AND no admin keys exist, this rejects.
 */
export const requireAdmin = createMiddleware(async (c, next) => {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return c.json({ error: "Admin authorization required" }, 401);
  }
  const raw = auth.slice(7).trim();

  if (config.adminKey && safeEqual(raw, config.adminKey)) {
    c.set("ownerKeyId", "admin");
    c.set("isAdmin", true);
    await next();
    return;
  }

  const found = await lookupKey(auth);
  if (found?.isAdmin) {
    c.set("ownerKeyId", found.id);
    c.set("isAdmin", true);
    await next();
    return;
  }

  return c.json({ error: "Admin authorization required" }, 401);
});
