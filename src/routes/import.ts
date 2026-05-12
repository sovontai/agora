import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { createAgent, findByA2aSource, updateAgent } from "../services/agents.js";

const app = new Hono();

const ImportSchema = z.object({
  url: z.string().url(),
});

const FETCH_TIMEOUT_MS = 10_000;

/** Import an A2A Agent Card from a URL. Idempotent per (owner, source URL). */
app.post("/a2a", requireAuth, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = ImportSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "url is required" }, 400);
  const { url } = parsed.data;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let card: any;
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok)
      return c.json({ error: `Failed to fetch agent card: ${res.status}` }, 400);
    card = await res.json();
  } catch (err: any) {
    return c.json({ error: `Import failed: ${err.message}` }, 400);
  } finally {
    clearTimeout(timer);
  }

  const skills = Array.isArray(card.skills)
    ? card.skills
    : Array.isArray(card.capabilities)
    ? card.capabilities
    : [];

  const input = {
    name: card.name || "Unknown Agent",
    description: card.description || "Imported from A2A Agent Card",
    url: card.url || url.replace(/\/\.well-known\/agent\.json$/, ""),
    version: card.version || undefined,
    provider: card.provider
      ? {
          organization: card.provider.organization,
          contact: card.provider.contact,
          url: card.provider.url,
        }
      : undefined,
    capabilities: skills.map((s: any) => ({
      id:
        s.id ||
        (typeof s.name === "string"
          ? s.name.toLowerCase().replace(/\s+/g, "-")
          : "unknown"),
      name: s.name || s.id || "Unknown",
      description: s.description,
      inputModes: s.inputModes,
      outputModes: s.outputModes,
    })),
    categories: Array.isArray(card.categories) ? card.categories : [],
    tags: Array.isArray(card.tags) ? card.tags : [],
    protocols: { a2a: { agentCardUrl: url } },
    authSchemes: card.authentication?.schemes ?? [],
  };

  const ownerKeyId = c.get("ownerKeyId");
  const existing = await findByA2aSource(ownerKeyId, url);
  if (existing) {
    const updated = await updateAgent(existing.id, input, ownerKeyId);
    return c.json({ imported: true, updated: true, agent: updated }, 200);
  }
  const agent = await createAgent(input, ownerKeyId);
  return c.json({ imported: true, updated: false, agent }, 201);
});

export default app;
