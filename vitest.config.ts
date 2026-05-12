import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    env: {
      // Applied before any module loads, so the db/index.ts singleton sees
      // these. setupFiles runs *after* ESM imports are hoisted, so env there
      // would be too late for module-load-time reads.
      DATABASE_URL: ":memory:",
      ADMIN_KEY: "test-admin-key",
      RATE_LIMIT: "0",
      NODE_ENV: "test",
    },
    testTimeout: 10_000,
    silent: false,
  },
});
