// Volontairement séparé de vite.config.ts (plugins TanStack Start/Cloudflare
// inutiles pour des tests unitaires). Config minimale : seules les fonctions
// pures de src/lib sont couvertes, sans environnement DOM/React.
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
