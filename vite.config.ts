import { defineConfig, loadEnv } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";

// Config Vite standard, sans dépendance Lovable.
// Remplace l'ancien `@lovable.dev/vite-tanstack-config` : on recompose ici la
// même pile de plugins avec les paquets standards (déjà présents).
// - tsConfigPaths : alias `@/*` lu depuis tsconfig.json
// - tailwindcss   : Tailwind v4
// - tanstackStart : SSR + routing fichier (entrée serveur = src/server.ts)
// - cloudflare    : build/runtime Cloudflare Workers (cf. wrangler.jsonc)
// - viteReact     : React 19
export default defineConfig(({ mode }) => {
  // Expose les variables de `.env` (y compris non-`VITE_`) à `process.env` pour
  // que le SSR (client.server.ts, auth-middleware.ts, feedback) les lise en dev,
  // quel que soit le runtime (bun, npm ou vite lancé directement). En prod, c'est
  // l'hébergeur qui fournit ces variables — ce bloc ne s'exécute qu'au build/dev.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));

  return {
    plugins: [
      // Doit précéder tanstackStart. Cible Cloudflare Workers (wrangler.jsonc).
      cloudflare({ viteEnvironment: { name: "ssr" } }),
      tsConfigPaths(),
      tailwindcss(),
      tanstackStart({ server: { entry: "server" } }),
      viteReact(),
    ],
  };
});
