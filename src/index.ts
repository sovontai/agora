import { serve } from "@hono/node-server";
import app from "./app.js";
import { config } from "./config.js";
import { runHealthChecks } from "./services/health.js";

// Import db to ensure tables are created
import "./db/index.js";

console.log(`
  ╔══════════════════════════════════════╗
  ║           🏛️  AGORA  v0.1.0          ║
  ║    Open Agent Registry & Discovery   ║
  ╚══════════════════════════════════════╝
`);

serve(
  {
    fetch: app.fetch,
    port: config.port,
    hostname: config.host,
  },
  (info) => {
    console.log(`  → Listening on http://${info.address}:${info.port}`);
    console.log(`  → API: http://${info.address}:${info.port}/v1/agents`);
    console.log(`  → UI:  http://${info.address}:${info.port}/`);
    console.log();

    // Run health checks every hour
    const HEALTH_INTERVAL = 60 * 60 * 1000; // 1 hour
    setTimeout(() => runHealthChecks().catch(console.error), 30_000); // first check 30s after start
    setInterval(() => runHealthChecks().catch(console.error), HEALTH_INTERVAL);
  }
);
