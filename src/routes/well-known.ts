import { Hono } from "hono";
import { getStats } from "../services/agents.js";

const app = new Hono();

/**
 * Discovery endpoint — lets clients identify this server as an Agora instance
 * and obtain enough metadata to start crawling. Stable, cacheable, public.
 */
app.get("/agora", async (c) => {
  const stats = await getStats();
  return c.json(
    {
      name: "Agora",
      version: "0.2.0",
      protocol: "agora/1",
      endpoints: {
        agents: "/v1/agents",
        agent: "/v1/agents/{id}",
        categories: "/v1/categories",
        stats: "/v1/stats",
        openapi: "/v1/openapi.json",
      },
      stats,
      source: "https://github.com/sovontai/agora",
    },
    200,
    { "Cache-Control": "public, max-age=300" }
  );
});

export default app;
