import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { RegisterAgentSchema, UpdateAgentSchema, SearchParamsSchema } from "../types/index.js";
import * as agentService from "../services/agents.js";
import * as verifyService from "../services/verification.js";

const app = new Hono();

// Public: Search agents
app.get("/", async (c) => {
  const raw = Object.fromEntries(new URL(c.req.url).searchParams);
  const params = SearchParamsSchema.parse(raw);
  const results = await agentService.searchAgents(params);
  return c.json(results);
});

// Public: Get agent by ID
app.get("/:id", async (c) => {
  const agent = await agentService.getAgent(c.req.param("id"));
  if (!agent) return c.json({ error: "Agent not found" }, 404);
  return c.json(agent);
});

// Auth: Register agent
app.post("/", requireAuth, async (c) => {
  const body = await c.req.json();
  const input = RegisterAgentSchema.parse(body);
  const apiKeyId = c.get("apiKeyId" as never) as string;
  const agent = await agentService.createAgent(input, apiKeyId);
  return c.json(agent, 201);
});

// Auth: Update agent
app.put("/:id", requireAuth, async (c) => {
  const body = await c.req.json();
  const input = UpdateAgentSchema.parse(body);
  const apiKeyId = c.get("apiKeyId" as never) as string;
  const result = await agentService.updateAgent(c.req.param("id"), input, apiKeyId);
  if (!result) return c.json({ error: "Agent not found" }, 404);
  if ("error" in result && result.error === "forbidden") return c.json({ error: "Forbidden" }, 403);
  return c.json(result);
});

// Auth: Delete agent
app.delete("/:id", requireAuth, async (c) => {
  const apiKeyId = c.get("apiKeyId" as never) as string;
  const result = await agentService.deleteAgent(c.req.param("id"), apiKeyId);
  if (!result) return c.json({ error: "Agent not found" }, 404);
  if (typeof result === "object" && "error" in result) return c.json({ error: "Forbidden" }, 403);
  return c.json({ deleted: true });
});

// Auth: Initiate verification
app.post("/:id/verify", requireAuth, async (c) => {
  const { domain } = await c.req.json();
  if (!domain) return c.json({ error: "domain is required" }, 400);
  const result = await verifyService.initiateVerification(c.req.param("id"), domain);
  return c.json(result);
});

// Auth: Confirm verification
app.post("/:id/verify/confirm", requireAuth, async (c) => {
  const result = await verifyService.confirmVerification(c.req.param("id"));
  if ("error" in result && result.error === "not_found") return c.json({ error: "Agent not found" }, 404);
  return c.json(result);
});

// Auth: Ping agent
app.post("/:id/ping", requireAuth, async (c) => {
  const result = await verifyService.pingAgent(c.req.param("id"));
  if (!result) return c.json({ error: "Agent not found" }, 404);
  return c.json(result);
});

export default app;
