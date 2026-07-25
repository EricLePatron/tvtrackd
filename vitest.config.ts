// Deliberately separate from vite.config.ts: that file is wrapped by
// @lovable.dev/vite-tanstack-config (see the warning comment at its top)
// which does not expose a `test` option, and this project has no existing
// test setup to fold this into. Kept minimal on purpose (cf. CLAUDE.md
// workflow — scope limited to what was validated in the plan): only the
// pure functions in src/lib are covered, no DOM/React test environment.
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});

