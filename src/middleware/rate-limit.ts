import type { MiddlewareHandler } from "hono";
import { config } from "../config.js";

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Tiny in-memory fixed-window rate limiter keyed by client IP.
 * Set `RATE_LIMIT=0` to disable. Suitable for a single-instance Agora;
 * federation/multi-instance setups will want a shared backing store.
 */
export function rateLimit(): MiddlewareHandler {
  const buckets = new Map<string, Bucket>();
  const max = config.rateLimit.maxRequests;
  const windowMs = config.rateLimit.windowMs;

  return async (c, next) => {
    if (max <= 0) {
      await next();
      return;
    }

    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
      c.req.header("x-real-ip") ||
      "anon";
    const now = Date.now();
    let b = buckets.get(ip);
    if (!b || b.resetAt < now) {
      b = { count: 0, resetAt: now + windowMs };
      buckets.set(ip, b);
    }
    b.count++;

    const remaining = Math.max(0, max - b.count);
    c.header("X-RateLimit-Limit", String(max));
    c.header("X-RateLimit-Remaining", String(remaining));
    c.header("X-RateLimit-Reset", String(Math.ceil(b.resetAt / 1000)));

    if (b.count > max) {
      const retryAfter = Math.max(1, Math.ceil((b.resetAt - now) / 1000));
      c.header("Retry-After", String(retryAfter));
      return c.json({ error: "Too many requests" }, 429);
    }

    // Opportunistically clear stale buckets — keep memory bounded.
    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
    }

    await next();
  };
}
