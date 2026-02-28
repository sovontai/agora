import { randomBytes } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/index.js";
import { apiKeys } from "../db/schema.js";
import { hashKey } from "../middleware/auth.js";

export async function createApiKey(name?: string) {
  const raw = `agora_${randomBytes(24).toString("hex")}`;
  const id = uuidv4();

  await db.insert(apiKeys).values({
    id,
    keyHash: hashKey(raw),
    name: name || null,
    createdAt: new Date().toISOString(),
  });

  return { id, key: raw, name };
}
