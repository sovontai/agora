import { randomBytes } from "crypto";
import { resolve } from "dns/promises";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { agents } from "../db/schema.js";

export function generateVerificationToken(): string {
  return `agora-verify=${randomBytes(16).toString("hex")}`;
}

export async function initiateVerification(agentId: string, domain: string) {
  const token = generateVerificationToken();

  await db
    .update(agents)
    .set({
      verificationDomain: domain,
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
  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);

  if (!agent) return { error: "not_found" };
  if (!agent.verificationDomain || !agent.verificationToken) {
    return { error: "no_verification_pending" };
  }

  try {
    const records = await resolve(`_agora-verify.${agent.verificationDomain}`, "TXT");
    const flat = records.flat();

    if (flat.includes(agent.verificationToken)) {
      await db
        .update(agents)
        .set({
          verified: true,
          verifiedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(agents.id, agentId));

      return { verified: true, domain: agent.verificationDomain };
    }

    return {
      verified: false,
      error: "token_not_found",
      expected: agent.verificationToken,
      domain: agent.verificationDomain,
    };
  } catch (err: any) {
    return {
      verified: false,
      error: "dns_lookup_failed",
      message: err.message,
    };
  }
}

export async function pingAgent(agentId: string) {
  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);

  if (!agent) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(agent.url, {
      method: "HEAD",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const status = res.ok ? "healthy" : `unhealthy:${res.status}`;

    await db
      .update(agents)
      .set({
        lastPingAt: new Date().toISOString(),
        lastPingStatus: status,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(agents.id, agentId));

    return { status, statusCode: res.status };
  } catch (err: any) {
    const status = `unreachable:${err.message}`;

    await db
      .update(agents)
      .set({
        lastPingAt: new Date().toISOString(),
        lastPingStatus: status,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(agents.id, agentId));

    return { status, error: err.message };
  }
}
