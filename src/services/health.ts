import { sqlite } from "../db/index.js";

const PING_TIMEOUT_MS = 10_000;
const DEACTIVATE_AFTER_FAILURES = 24; // ~1 day at hourly cadence
const USER_AGENT = "Agora-HealthCheck/0.2 (+https://github.com/sovontai/agora)";

export interface PingResult {
  status: string;
  statusCode?: number;
  durationMs: number;
}

/**
 * Probe an agent URL. Tries HEAD first, falls back to GET on 405 / 501, and
 * treats network errors uniformly.
 */
export async function probe(url: string): Promise<PingResult> {
  const start = Date.now();
  const headers = { "User-Agent": USER_AGENT, Accept: "*/*" };
  async function once(method: "HEAD" | "GET") {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
    try {
      return await fetch(url, { method, headers, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  try {
    let res = await once("HEAD");
    if (res.status === 405 || res.status === 501) {
      res = await once("GET");
    }
    const durationMs = Date.now() - start;
    if (res.ok) return { status: "healthy", statusCode: res.status, durationMs };
    if (res.status >= 500)
      return {
        status: `unhealthy:${res.status}`,
        statusCode: res.status,
        durationMs,
      };
    // 4xx other than 405/501 — many agents return 401/403 to anonymous probes,
    // which is technically "reachable" and not the registry's job to call broken.
    if (res.status === 401 || res.status === 403) {
      return { status: "reachable", statusCode: res.status, durationMs };
    }
    return {
      status: `unhealthy:${res.status}`,
      statusCode: res.status,
      durationMs,
    };
  } catch (err: any) {
    return {
      status: `unreachable:${(err.message ?? "error").slice(0, 100)}`,
      durationMs: Date.now() - start,
    };
  }
}

function isHealthy(status: string): boolean {
  return status === "healthy" || status === "reachable";
}

function applyPingResult(agentId: string, result: PingResult) {
  const now = new Date().toISOString();
  const row = sqlite
    .prepare(
      `SELECT consecutive_ping_failures, status FROM agents WHERE id = ?`
    )
    .get(agentId) as { consecutive_ping_failures: number; status: string } | undefined;
  if (!row) return;

  const healthy = isHealthy(result.status);
  const failures = healthy ? 0 : (row.consecutive_ping_failures ?? 0) + 1;
  const nextStatus =
    failures >= DEACTIVATE_AFTER_FAILURES && row.status === "active"
      ? "inactive"
      : healthy && row.status === "inactive"
      ? "active"
      : row.status;

  sqlite
    .prepare(
      `UPDATE agents SET
        last_ping_at = ?,
        last_ping_status = ?,
        consecutive_ping_failures = ?,
        status = ?,
        updated_at = ?
       WHERE id = ?`
    )
    .run(now, result.status, failures, nextStatus, now, agentId);
}

/** Public/admin per-agent ping. */
export async function pingAgent(agentId: string) {
  const row = sqlite
    .prepare(`SELECT url FROM agents WHERE id = ?`)
    .get(agentId) as { url: string } | undefined;
  if (!row) return null;
  const result = await probe(row.url);
  applyPingResult(agentId, result);
  return result;
}

/**
 * Periodic background sweep — pings all active agents. Uses small concurrent
 * batches to avoid blocking the event loop for large registries.
 */
export async function runHealthChecks(opts: { concurrency?: number } = {}) {
  const concurrency = opts.concurrency ?? 8;
  const agents = sqlite
    .prepare(
      `SELECT id, url FROM agents WHERE status IN ('active','inactive')`
    )
    .all() as Array<{ id: string; url: string }>;

  let healthy = 0;
  let unhealthy = 0;

  const queue = [...agents];
  async function worker() {
    while (queue.length) {
      const a = queue.shift();
      if (!a) return;
      const result = await probe(a.url);
      applyPingResult(a.id, result);
      if (isHealthy(result.status)) healthy++;
      else unhealthy++;
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, agents.length) }, () => worker())
  );

  return { total: agents.length, healthy, unhealthy };
}
