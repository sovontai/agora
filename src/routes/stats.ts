import { Hono } from "hono";
import { getStats } from "../services/agents.js";

const app = new Hono();

app.get("/", async (c) => {
  const stats = await getStats();
  return c.json(stats);
});

export default app;
