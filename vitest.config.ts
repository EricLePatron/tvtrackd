// Deliberately separate from vite.config.ts: that file is wrapped by
// @lovable.dev/vite-tanstack-config (see the warning comment at its top)
// which does not expose a `test` option, and this project has no existing
// test setup to fold this into. Kept minimal on purpose (cf. CLAUDE.md
// workflow — scope limited to what was validated in the plan): only the
// pure functions in src/lib are covered, no DOM/React test environment.
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirrors tsconfig.json's "@/*" -> "./src/*" path mapping. Needed now
    // that a tested module (calendar-timeline-rows.ts) has a runtime (not
    // type-only) import from "@/lib/schedule" — type-only imports get
    // elided at build time and never needed this, but a value import does
    // need Vitest's own resolver to know about the alias.
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
