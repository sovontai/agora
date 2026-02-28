import type { Context } from "hono";
import { ZodError } from "zod";

export function handleError(err: Error, c: Context) {
  if (err instanceof ZodError) {
    return c.json(
      { error: "Validation error", details: err.flatten().fieldErrors },
      400
    );
  }

  console.error("Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
}
