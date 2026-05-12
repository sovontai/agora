import { serve } from "@hono/node-server";
import app from "./app.js";
import { config } from "./config.js";
import { runHealthChecks } from "./services/health.js";
import { reverifyAllVerified } from "./services/verification.js";

// Import db to ensure tables are created
import "./db/index.js";

console.log(`
  ╔══════════════════════════════════════╗
  ║           🏛️  AGORA  v0.2.0          ║
  ║    Open Agent Registry & Discovery   ║
  ╚══════════════════════════════════════╝
`);

if (!config.adminKey) {
  console.warn(
    `  ⚠ ADMIN_KEY is not set. Creating new API keys is disabled.\n` +
      `    Set ADMIN_KEY=… to enable POST /v1/keys.`
  );
}

serve(
  {
    fetch: app.fetch,
    port: config.port,
    hostname: config.host,
  },
  (info) => {
    console.log(`  → API:   http://${info.address}:${info.port}/v1`);
    console.log(`  → Docs:  http://${info.address}:${info.port}/v1/docs`);
    console.log(`  → UI:    http://${info.address}:${info.port}/`);
    console.log();

    // Cadences:
    //  - Health sweep:    every 1h, first run 30s after boot
    //  - Re-verification: every 24h, first run 5m after boot
    setTimeout(() => runHealthChecks().catch(console.error), 30_000);
    setInterval(() => runHealthChecks().catch(console.error), 60 * 60 * 1000);

    setTimeout(() => reverifyAllVerified().catch(console.error), 5 * 60 * 1000);
    setInterval(
      () => reverifyAllVerified().catch(console.error),
      24 * 60 * 60 * 1000
    );
  }
);
