import { sqlite } from "../db/index.js";

/**
 * Periodic health checker — pings all active agents and updates their status.
 * Run this on an interval (e.g., every hour).
 */
export async function runHealthChecks() {
  const agents = sqlite
    .prepare("SELECT id, url, name FROM agents WHERE status = 'active'")
    .all() as any[];

  console.log(`[health] Checking ${agents.length} agents...`);

  let healthy = 0;
  let unhealthy = 0;

  for (const agent of agents) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const res = await fetch(agent.url, {
        method: "HEAD",
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const status = res.ok ? "healthy" : `unhealthy:${res.status}`;
      const now = new Date().toISOString();

      sqlite
        .prepare(
          "UPDATE agents SET last_ping_at = ?, last_ping_status = ?, updated_at = ? WHERE id = ?"
        )
        .run(now, status, now, agent.id);

      if (res.ok) healthy++;
      else unhealthy++;
    } catch (err: any) {
      const status = `unreachable:${err.message?.slice(0, 100)}`;
      const now = new Date().toISOString();

      sqlite
        .prepare(
          "UPDATE agents SET last_ping_at = ?, last_ping_status = ?, updated_at = ? WHERE id = ?"
        )
        .run(now, status, now, agent.id);

      unhealthy++;
    }
  }

  console.log(
    `[health] Done: ${healthy} healthy, ${unhealthy} unhealthy out of ${agents.length}`
  );

  return { total: agents.length, healthy, unhealthy };
}
