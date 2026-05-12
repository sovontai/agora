import { beforeEach } from "vitest";
import { resetDb } from "../src/db/index.js";

// env (DATABASE_URL, ADMIN_KEY, RATE_LIMIT) is set via vitest.config.ts `env`
// because ESM imports hoist above any top-level assignment.

beforeEach(() => {
  resetDb();
});
