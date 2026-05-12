import { Hono } from "hono";

const app = new Hono();

const spec = {
  openapi: "3.1.0",
  info: {
    title: "Agora",
    version: "0.3.0",
    description:
      "Open agent registry and discovery service — DNS for AI agents. Built to complement A2A and MCP.",
    license: { name: "Apache-2.0", url: "https://www.apache.org/licenses/LICENSE-2.0" },
  },
  servers: [{ url: "/" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer" },
    },
    schemas: {
      Capability: {
        type: "object",
        required: ["id", "name"],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          inputModes: { type: "array", items: { type: "string" } },
          outputModes: { type: "array", items: { type: "string" } },
        },
      },
      Provider: {
        type: "object",
        properties: {
          organization: { type: "string", nullable: true },
          contact: { type: "string", nullable: true },
          url: { type: "string", format: "uri", nullable: true },
        },
      },
      Protocols: {
        type: "object",
        properties: {
          a2a: {
            type: "object",
            nullable: true,
            properties: { agentCardUrl: { type: "string", format: "uri" } },
          },
          mcp: {
            type: "object",
            nullable: true,
            properties: { serverUrl: { type: "string", format: "uri" } },
          },
        },
      },
      Verification: {
        type: "object",
        properties: {
          domain: { type: "string", nullable: true },
          verified: { type: "boolean" },
          verifiedAt: { type: "string", format: "date-time", nullable: true },
          checkedAt: { type: "string", format: "date-time", nullable: true },
        },
      },
      Health: {
        type: "object",
        properties: {
          status: { type: "string", nullable: true },
          checkedAt: { type: "string", format: "date-time", nullable: true },
          consecutiveFailures: { type: "integer" },
        },
      },
      Agent: {
        type: "object",
        required: ["id", "name", "description", "url"],
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          description: { type: "string" },
          url: { type: "string", format: "uri" },
          version: { type: "string", nullable: true },
          provider: { $ref: "#/components/schemas/Provider" },
          capabilities: {
            type: "array",
            items: { $ref: "#/components/schemas/Capability" },
          },
          categories: { type: "array", items: { type: "string" } },
          tags: { type: "array", items: { type: "string" } },
          protocols: { $ref: "#/components/schemas/Protocols" },
          mcpTools: { type: "array", items: { type: "object" } },
          authSchemes: { type: "array", items: { type: "string" } },
          verification: { $ref: "#/components/schemas/Verification" },
          health: { $ref: "#/components/schemas/Health" },
          status: { type: "string", enum: ["active", "inactive", "deprecated"] },
          registeredAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      RegisterAgent: {
        type: "object",
        required: ["name", "description", "url"],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 200 },
          description: { type: "string", minLength: 1, maxLength: 2000 },
          url: { type: "string", format: "uri" },
          version: { type: "string" },
          provider: { $ref: "#/components/schemas/Provider" },
          capabilities: {
            type: "array",
            items: { $ref: "#/components/schemas/Capability" },
          },
          categories: { type: "array", items: { type: "string" } },
          tags: { type: "array", items: { type: "string" } },
          protocols: { $ref: "#/components/schemas/Protocols" },
          authSchemes: { type: "array", items: { type: "string" } },
        },
      },
      SearchResult: {
        type: "object",
        properties: {
          agents: { type: "array", items: { $ref: "#/components/schemas/Agent" } },
          total: { type: "integer" },
          limit: { type: "integer" },
          offset: { type: "integer" },
        },
      },
      Stats: {
        type: "object",
        properties: {
          totalAgents: { type: "integer" },
          verifiedAgents: { type: "integer" },
          a2aAgents: { type: "integer" },
          mcpAgents: { type: "integer" },
          healthyAgents: { type: "integer" },
        },
      },
      Error: {
        type: "object",
        properties: { error: { type: "string" } },
      },
    },
  },
  paths: {
    "/v1/agents": {
      get: {
        summary: "Search & list agents",
        parameters: [
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "category", in: "query", schema: { type: "string" } },
          { name: "tag", in: "query", schema: { type: "string" } },
          { name: "tool", in: "query", schema: { type: "string" } },
          {
            name: "protocol",
            in: "query",
            schema: { type: "string", enum: ["a2a", "mcp"] },
          },
          { name: "verified", in: "query", schema: { type: "boolean" } },
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["active", "inactive", "deprecated"] },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          },
          {
            name: "offset",
            in: "query",
            schema: { type: "integer", minimum: 0, default: 0 },
          },
        ],
        responses: {
          "200": {
            description: "Search results",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SearchResult" },
              },
            },
          },
        },
      },
      post: {
        summary: "Register an agent",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RegisterAgent" },
            },
          },
        },
        responses: {
          "201": {
            description: "Created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Agent" },
              },
            },
          },
          "400": { description: "Validation error" },
          "401": { description: "Missing/invalid API key" },
        },
      },
    },
    "/v1/agents/{id}": {
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      get: {
        summary: "Get an agent",
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Agent" } },
            },
          },
          "404": { description: "Not found" },
        },
      },
      put: {
        summary: "Update an agent",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RegisterAgent" },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Agent" } },
            },
          },
          "403": { description: "Forbidden — not the owner" },
          "404": { description: "Not found" },
        },
      },
      delete: {
        summary: "Delete an agent",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Deleted" },
          "403": { description: "Forbidden — not the owner" },
          "404": { description: "Not found" },
        },
      },
    },
    "/v1/agents/{id}/verify": {
      post: {
        summary: "Initiate domain verification",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["domain"],
                properties: { domain: { type: "string" } },
              },
            },
          },
        },
        responses: { "200": { description: "Verification token issued" } },
      },
    },
    "/v1/agents/{id}/verify/confirm": {
      post: {
        summary: "Confirm verification by re-checking the DNS TXT record",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Result" } },
      },
    },
    "/v1/agents/{id}/ping": {
      post: {
        summary: "Health-check an agent",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Probe result" } },
      },
    },
    "/v1/categories": {
      get: {
        summary: "List categories with counts",
        responses: { "200": { description: "OK" } },
      },
    },
    "/v1/stats": {
      get: {
        summary: "Registry statistics",
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Stats" } },
            },
          },
        },
      },
    },
    "/v1/import/a2a": {
      post: {
        summary: "Import an A2A Agent Card (idempotent per owner + URL)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["url"],
                properties: { url: { type: "string", format: "uri" } },
              },
            },
          },
        },
        responses: {
          "201": { description: "Created" },
          "200": { description: "Updated (already existed)" },
        },
      },
    },
    "/v1/keys": {
      post: {
        summary: "Mint an API key (admin only)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  isAdmin: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Key created" }, "401": { description: "Admin auth required" } },
      },
    },
    "/v1/health/check": {
      post: {
        summary: "Trigger health sweep (admin only)",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "OK" } },
      },
    },
    "/v1/health/reverify": {
      post: {
        summary: "Re-verify every previously-verified agent (admin only)",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "OK" } },
      },
    },
    "/v1/badge/{id}.svg": {
      get: {
        summary: "Verification badge SVG for an agent",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "SVG", content: { "image/svg+xml": {} } } },
      },
    },
  },
} as const;

app.get("/openapi.json", (c) =>
  c.json(spec, 200, {
    "Cache-Control": "public, max-age=300",
  })
);

const DOCS_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><title>Agora API Docs</title>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"/>
<style>body{margin:0}.topbar{display:none}</style>
</head><body>
<div id="swagger"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>
window.onload = () => SwaggerUIBundle({
  url: '/v1/openapi.json',
  dom_id: '#swagger',
  deepLinking: true,
  presets: [SwaggerUIBundle.presets.apis],
});
</script>
</body></html>`;

app.get("/docs", (c) => c.html(DOCS_HTML));

export default app;
