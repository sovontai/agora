import { Hono } from "hono";
import { z } from "zod";
import { randomBytes } from "crypto";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { createAgent, findByA2aSource, updateAgent } from "../services/agents.js";
import { CLAIMABLE_PREFIX } from "../services/claim.js";

const app = new Hono();

const ImportSchema = z.object({
  url: z.string().url(),
});

const BulkImportSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(500),
  claimable: z.boolean().optional().default(true),
});

const FETCH_TIMEOUT_MS = 10_000;

async function fetchA2aCard(url: string): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function cardToInput(card: any, sourceUrl: string) {
  const skills = Array.isArray(card.skills)
    ? card.skills
    : Array.isArray(card.capabilities)
    ? card.capabilities
    : [];
  return {
    name: card.name || "Unknown Agent",
    description: card.description || "Imported from A2A Agent Card",
    url: card.url || sourceUrl.replace(/\/\.well-known\/agent\.json$/, ""),
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
    protocols: { a2a: { agentCardUrl: sourceUrl } },
    authSchemes: card.authentication?.schemes ?? [],
  };
}

/** Import an A2A Agent Card from a URL. Idempotent per (owner, source URL). */
app.post("/a2a", requireAuth, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = ImportSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "url is required" }, 400);
  const { url } = parsed.data;

  let card: any;
  try {
    card = await fetchA2aCard(url);
  } catch (err: any) {
    return c.json({ error: `Import failed: ${err.message}` }, 400);
  }

  const input = cardToInput(card, url);
  const ownerKeyId = c.get("ownerKeyId");
  const existing = await findByA2aSource(ownerKeyId, url);
  if (existing) {
    const updated = await updateAgent(existing.id, input, ownerKeyId);
    return c.json({ imported: true, updated: true, agent: updated }, 200);
  }
  const agent = await createAgent(input, ownerKeyId);
  return c.json({ imported: true, updated: false, agent }, 201);
});

/**
 * Admin: bulk-import multiple A2A cards. When `claimable: true` (default), each
 * imported agent is owned by a "claimable:<random>" sentinel so the agent's
 * real owner can claim it later via DNS-TXT verification.
 *
 * Returns per-URL results so the caller can show progress / retry failures.
 */
app.post("/bulk", requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = BulkImportSchema.safeParse(body);
  if (!parsed.success)
    return c.json({ error: "urls (string[]) is required" }, 400);
  const { urls, claimable } = parsed.data;

  const claimableSuffix = randomBytes(8).toString("hex");
  const ownerKeyId = c.get("ownerKeyId");

  const results: Array<{
    url: string;
    ok: boolean;
    id?: string;
    updated?: boolean;
    error?: string;
  }> = [];
  let ok = 0;
  let fail = 0;

  for (const url of urls) {
    try {
      const card = await fetchA2aCard(url);
      const input = cardToInput(card, url);
      const claimOwner = claimable
        ? `${CLAIMABLE_PREFIX}${claimableSuffix}`
        : ownerKeyId;

      const existing = await findByA2aSource(claimOwner, url);
      if (existing) {
        const updated = await updateAgent(existing.id, input, claimOwner);
        results.push({
          url,
          ok: true,
          id: existing.id,
          updated: true,
        });
      } else {
        const agent = await createAgent(input, claimOwner);
        results.push({ url, ok: true, id: agent.id, updated: false });
      }
      ok++;
    } catch (e: any) {
      results.push({ url, ok: false, error: e.message });
      fail++;
    }
  }

  return c.json({ total: urls.length, ok, fail, results });
});

export default app;
