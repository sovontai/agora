import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db, sqlite } from "../db/index.js";
import { agents } from "../db/schema.js";
import { hashKey } from "../middleware/auth.js";
import { v4 as uuidv4 } from "uuid";

/**
 * Claim flow for crawled/imported agents.
 *
 * Bulk imports record their agents with an owner_key_id starting with
 * `claimable:` so anyone proving DNS ownership of the agent URL host can
 * claim it. After a successful claim, ownership transfers to a freshly-minted
 * API key (returned to the claimant) and the agent is marked verified.
 */

export const CLAIMABLE_PREFIX = "claimable:";

function hostFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function generateToken(): string {
  return `agora-claim=${randomBytes(16).toString("hex")}`;
}

export async function initiateClaim(agentId: string) {
  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
  if (!agent) return { error: "not_found" as const };
  if (!agent.ownerKeyId.startsWith(CLAIMABLE_PREFIX)) {
    return { error: "not_claimable" as const };
  }
  const host = hostFromUrl(agent.url);
  if (!host) return { error: "invalid_url" as const };

  const token = generateToken();
  await db
    .update(agents)
    .set({
      verificationDomain: host,
      verificationToken: token,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(agents.id, agentId));

  return {
    domain: host,
    token,
    instructions: {
      method: "dns-txt" as const,
      record: `_agora-verify.${host}`,
      value: token,
      description: `Add a TXT record at _agora-verify.${host} with the value: ${token}. Then call POST /v1/agents/${agentId}/claim/confirm.`,
    },
  };
}

export type DnsResolver = (h: string, t: "TXT") => Promise<string[][]>;
let resolver: DnsResolver | null = null;
export function setClaimDnsResolver(fn: DnsResolver | null) {
  resolver = fn;
}

async function lookupTxt(host: string): Promise<string[]> {
  if (resolver) return (await resolver(host, "TXT")).flat();
  const { resolve } = await import("dns/promises");
  const r = (await resolve(host, "TXT")) as unknown as string[][];
  return r.flat();
}

export async function confirmClaim(agentId: string, claimName?: string) {
  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
  if (!agent) return { error: "not_found" as const };
  if (!agent.ownerKeyId.startsWith(CLAIMABLE_PREFIX)) {
    return { error: "not_claimable" as const };
  }
  if (!agent.verificationDomain || !agent.verificationToken) {
    return { error: "no_claim_pending" as const };
  }

  let records: string[];
  try {
    records = await lookupTxt(`_agora-verify.${agent.verificationDomain}`);
  } catch (err: any) {
    return { error: "dns_lookup_failed" as const, message: err.message };
  }

  if (!records.includes(agent.verificationToken)) {
    return {
      error: "token_not_found" as const,
      expected: agent.verificationToken,
      domain: agent.verificationDomain,
    };
  }

  // Mint a fresh API key for the claimant. They become the new owner.
  const newKey = `agora_${randomBytes(24).toString("hex")}`;
  const newKeyId = uuidv4();
  const now = new Date().toISOString();
  sqlite
    .prepare(
      `INSERT INTO api_keys (id, key_hash, name, is_admin, created_at) VALUES (?, ?, ?, 0, ?)`
    )
    .run(newKeyId, hashKey(newKey), claimName ?? `claim:${agent.verificationDomain}`, now);

  sqlite
    .prepare(
      `UPDATE agents SET owner_key_id = ?, verified = 1, verified_at = ?,
        verification_checked_at = ?, updated_at = ? WHERE id = ?`
    )
    .run(newKeyId, now, now, now, agentId);

  return {
    claimed: true,
    domain: agent.verificationDomain,
    apiKey: { id: newKeyId, key: newKey },
  };
}
