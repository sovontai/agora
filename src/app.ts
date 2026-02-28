import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import agentRoutes from "./routes/agents.js";
import keyRoutes from "./routes/keys.js";
import statsRoutes from "./routes/stats.js";
import { handleError } from "./middleware/errors.js";

const app = new Hono();

// Middleware
app.use("*", cors());
app.use("*", logger());

// Health check
app.get("/", (c) =>
  c.json({
    name: "Agora",
    version: "0.1.0",
    description: "Open Agent Registry & Discovery — DNS for AI agents",
    docs: "/v1",
  })
);

app.get("/health", (c) => c.json({ status: "ok" }));

// API routes
app.route("/v1/agents", agentRoutes);
app.route("/v1/keys", keyRoutes);
app.route("/v1/stats", statsRoutes);

// Error handling
app.onError(handleError);

// 404
app.notFound((c) => c.json({ error: "Not found" }, 404));

export default app;
