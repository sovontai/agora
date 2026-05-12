import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import agentRoutes from "./routes/agents.js";
import keyRoutes from "./routes/keys.js";
import statsRoutes from "./routes/stats.js";
import categoryRoutes from "./routes/categories.js";
import importRoutes from "./routes/import.js";
import healthRoutes from "./routes/health.js";
import openapiRoutes from "./routes/openapi.js";
import badgeRoutes from "./routes/badge.js";
import wellKnownRoutes from "./routes/well-known.js";
import uiRoutes from "./routes/ui.js";
import { handleError } from "./middleware/errors.js";
import { rateLimit } from "./middleware/rate-limit.js";

const app = new Hono();

// Middleware
app.use("*", cors());
if (process.env.NODE_ENV !== "test") {
  app.use("*", logger());
}
app.use("/v1/*", rateLimit());

// Web UI at root
app.route("/", uiRoutes);
app.route("/.well-known", wellKnownRoutes);

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// API info
app.get("/v1", (c) =>
  c.json({
    name: "Agora",
    version: "0.2.0",
    description: "Open Agent Registry & Discovery — DNS for AI agents",
    endpoints: {
      agents: "/v1/agents",
      categories: "/v1/categories",
      stats: "/v1/stats",
      import: "/v1/import",
      keys: "/v1/keys",
      health: "/v1/health",
      openapi: "/v1/openapi.json",
      docs: "/v1/docs",
    },
  })
);

// API routes
app.route("/v1/agents", agentRoutes);
app.route("/v1/keys", keyRoutes);
app.route("/v1/stats", statsRoutes);
app.route("/v1/categories", categoryRoutes);
app.route("/v1/import", importRoutes);
app.route("/v1/health", healthRoutes);
app.route("/v1", openapiRoutes);
app.route("/v1/badge", badgeRoutes);

// Error handling
app.onError(handleError);
app.notFound((c) => c.json({ error: "Not found" }, 404));

export default app;
