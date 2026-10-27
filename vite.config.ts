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
const REQUIRED_PUBLIC_ENV = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_SITE_URL",
] as const;

// Les `VITE_*` sont figées dans le bundle client au build. Sans elles, le build
// "réussit" mais le site plante dans le navigateur (« This page didn't load »).
// Build : échec explicite. Dev/preview : simple avertissement.
function checkPublicEnv(fileEnv: Record<string, string>, command: string) {
  const missing = REQUIRED_PUBLIC_ENV.filter((name) => !(process.env[name] || fileEnv[name]));
  if (missing.length === 0) return;

  const message =
    `Variable(s) d'environnement publique(s) manquante(s) : ${missing.join(", ")}.\n` +
    `Elles sont injectées dans le bundle client au build ; sans elles le site plante dans le navigateur.\n` +
    `Marche à suivre : copie .env.example vers .env (cp .env.example .env), ` +
    `ou exporte ces variables dans le shell, puis relance. Voir docs/INFRA.md.`;

  if (command === "build") throw new Error(`[tvtrackd] ${message}`);
  console.warn(`\n[tvtrackd] Attention : ${message}\n`);
}

export default defineConfig(({ mode, command }) => {
  // Expose les variables de `.env` (y compris non-`VITE_`) à `process.env` pour
  // que le SSR (client.server.ts, auth-middleware.ts, feedback) les lise en dev,
  // quel que soit le runtime (bun, npm ou vite lancé directement). En prod, c'est
  // l'hébergeur qui fournit ces variables — ce bloc ne s'exécute qu'au build/dev.
  const fileEnv = loadEnv(mode, process.cwd(), "");
  checkPublicEnv(fileEnv, command);
  Object.assign(process.env, fileEnv);

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
