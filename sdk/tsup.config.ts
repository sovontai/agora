import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    dts: true,
    clean: true,
    target: "es2022",
  },
  {
    entry: { cli: "src/cli.ts" },
    format: ["esm"],
    dts: false,
    target: "es2022",
    banner: { js: "#!/usr/bin/env node" },
  },
]);
