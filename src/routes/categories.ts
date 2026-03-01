import { Hono } from "hono";
import { sqlite } from "../db/index.js";

const app = new Hono();

app.get("/", async (c) => {
  const rows = sqlite
    .prepare(
      `SELECT json_each.value as category, COUNT(*) as count 
       FROM agents, json_each(agents.categories) 
       GROUP BY json_each.value 
       ORDER BY count DESC`
    )
    .all() as any[];

  return c.json({
    categories: rows.map((r) => ({
      slug: r.category,
      name: r.category
        .split("-")
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
      agentCount: r.count,
    })),
  });
});

export default app;
