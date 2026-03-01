import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { createAgent } from "../services/agents.js";

const app = new Hono();

// Import an A2A Agent Card from a URL
app.post("/a2a", requireAuth, async (c) => {
  const { url } = await c.req.json();
  if (!url) return c.json({ error: "url is required" }, 400);

  try {
    // Fetch the Agent Card
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      return c.json({ error: `Failed to fetch agent card: ${res.status}` }, 400);
    }

    const card = (await res.json()) as any;

    // Map A2A Agent Card to Agora format
    const input = {
      name: card.name || "Unknown Agent",
      description: card.description || "Imported from A2A Agent Card",
      url: card.url || url.replace("/.well-known/agent.json", ""),
      version: card.version || undefined,
      provider: card.provider
        ? {
            organization: card.provider.organization,
            contact: card.provider.contact,
            url: card.provider.url,
          }
        : undefined,
      capabilities: (card.skills || card.capabilities || []).map((s: any) => ({
        id: s.id || s.name?.toLowerCase().replace(/\s+/g, "-") || "unknown",
        name: s.name || s.id || "Unknown",
        description: s.description,
        inputModes: s.inputModes,
        outputModes: s.outputModes,
      })),
      categories: card.categories || [],
      tags: card.tags || [],
      protocols: {
        a2a: { agentCardUrl: url },
      },
      authSchemes: card.authentication?.schemes || [],
    };

    const apiKeyId = c.get("apiKeyId" as never) as string;
    const agent = await createAgent(input, apiKeyId);

    return c.json({ imported: true, agent }, 201);
  } catch (err: any) {
    return c.json({ error: `Import failed: ${err.message}` }, 400);
  }
});

export default app;
