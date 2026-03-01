import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import agentRoutes from "./routes/agents.js";
import keyRoutes from "./routes/keys.js";
import statsRoutes from "./routes/stats.js";
import categoryRoutes from "./routes/categories.js";
import importRoutes from "./routes/import.js";
import uiRoutes from "./routes/ui.js";
import { handleError } from "./middleware/errors.js";

const app = new Hono();

// Middleware
app.use("*", cors());
app.use("*", logger());

// Web UI at root
app.route("/", uiRoutes);

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// API info
app.get("/v1", (c) =>
  c.json({
    name: "Agora",
    version: "0.1.0",
    description: "Open Agent Registry & Discovery — DNS for AI agents",
    endpoints: {
      agents: "/v1/agents",
      categories: "/v1/categories",
      stats: "/v1/stats",
      import: "/v1/import",
      keys: "/v1/keys",
    },
  })
);

// API routes
app.route("/v1/agents", agentRoutes);
app.route("/v1/keys", keyRoutes);
app.route("/v1/stats", statsRoutes);
app.route("/v1/categories", categoryRoutes);
app.route("/v1/import", importRoutes);

// Error handling
app.onError(handleError);

// 404
app.notFound((c) => c.json({ error: "Not found" }, 404));

export default app;
