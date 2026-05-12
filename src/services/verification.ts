import { randomBytes } from "crypto";
import { resolve as dnsResolve } from "dns/promises";
import { eq } from "drizzle-orm";
import { db, sqlite } from "../db/index.js";
import { agents } from "../db/schema.js";

export function generateVerificationToken(): string {
  return `agora-verify=${randomBytes(16).toString("hex")}`;
}

/** Return null on parse failure or any non-http(s) URL. */
function hostFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * The domain a verifier asks for must equal the agent's URL host, or be a
 * registrable parent of it (e.g. agent at `https://api.acme.com/x` may verify
 * `acme.com`). Subdomains-of-the-domain are also accepted to keep wildcards
 * possible. This prevents claiming arbitrary unrelated domains.
 */
export function isDomainRelatedToUrl(domain: string, url: string): boolean {
  const host = hostFromUrl(url);
  if (!host) return false;
  const d = domain.trim().toLowerCase().replace(/^\.+|\.+$/g, "");
  if (!d || d.includes("/") || d.startsWith(".")) return false;
  if (host === d) return true;
  if (host.endsWith(`.${d}`)) return true;
  if (d.endsWith(`.${host}`)) return true;
  return false;
}

export type DnsResolver = (
  hostname: string,
  rrtype: "TXT"
) => Promise<string[][]>;

let resolver: DnsResolver = dnsResolve as unknown as DnsResolver;

/** Override DNS for tests. */
export function setDnsResolver(fn: DnsResolver | null) {
  resolver = (fn ?? (dnsResolve as unknown as DnsResolver));
}

export async function initiateVerification(agentId: string, domain: string) {
  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
  if (!agent) return { error: "not_found" as const };

  if (!isDomainRelatedToUrl(domain, agent.url)) {
    return { error: "domain_unrelated_to_url" as const, agentUrl: agent.url };
  }

  const token = generateVerificationToken();

  await db
    .update(agents)
    .set({
      verificationDomain: domain.toLowerCase(),
      verificationToken: token,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(agents.id, agentId));

  return {
    domain,
    token,
    instructions: {
      method: "dns-txt",
      record: `_agora-verify.${domain}`,
      value: token,
      description: `Add a TXT record for _agora-verify.${domain} with the value: ${token}`,
    },
  };
}

export async function confirmVerification(agentId: string) {
  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);

  if (!agent) return { error: "not_found" as const };
  if (!agent.verificationDomain || !agent.verificationToken) {
    return { error: "no_verification_pending" as const };
  }

  try {
    const records = await resolver(
      `_agora-verify.${agent.verificationDomain}`,
      "TXT"
    );
    const flat = records.flat();
    const now = new Date().toISOString();

    if (flat.includes(agent.verificationToken)) {
      await db
        .update(agents)
        .set({
          verified: true,
          verifiedAt: now,
          verificationCheckedAt: now,
          updatedAt: now,
        })
        .where(eq(agents.id, agentId));
      return { verified: true, domain: agent.verificationDomain };
    }

    return {
      verified: false,
      error: "token_not_found" as const,
      expected: agent.verificationToken,
      domain: agent.verificationDomain,
    };
  } catch (err: any) {
    return {
      verified: false,
      error: "dns_lookup_failed" as const,
      message: err.message,
    };
  }
}

/**
 * Periodic re-verification: re-check the TXT record for every currently-verified
 * agent. If the record has disappeared or changed, drop the verified flag.
 *
 * Returns counts. Failures during DNS lookup are tolerated (transient).
 */
export async function reverifyAllVerified() {
  const rows = sqlite
    .prepare(
      `SELECT id, verification_domain, verification_token FROM agents
       WHERE verified = 1 AND verification_domain IS NOT NULL AND verification_token IS NOT NULL`
    )
    .all() as Array<{
    id: string;
    verification_domain: string;
    verification_token: string;
  }>;

  let stillVerified = 0;
  let revoked = 0;
  let transient = 0;
  const now = new Date().toISOString();

  for (const r of rows) {
    try {
      const records = await resolver(
        `_agora-verify.${r.verification_domain}`,
        "TXT"
      );
      const flat = records.flat();
      if (flat.includes(r.verification_token)) {
        sqlite
          .prepare(
            `UPDATE agents SET verification_checked_at = ?, updated_at = ? WHERE id = ?`
          )
          .run(now, now, r.id);
        stillVerified++;
      } else {
        sqlite
          .prepare(
            `UPDATE agents SET verified = 0, verified_at = NULL,
              verification_checked_at = ?, updated_at = ? WHERE id = ?`
          )
          .run(now, now, r.id);
        revoked++;
      }
    } catch {
      transient++;
    }
  }

  return { checked: rows.length, stillVerified, revoked, transient };
}
