import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { APP_NAME } from "@/lib/app-config";

/**
 * Web App Manifest dynamique : `name`/`short_name` viennent de `APP_NAME`
 * (nom pas encore tranché, cf. CLAUDE.md) plutôt que d'un JSON statique figé.
 * Couleurs = `--bg-void`. Pas de service worker (hors scope).
 */
export const Route = createFileRoute("/manifest.webmanifest")({
  server: {
    handlers: {
      GET: async () => {
        const manifest = {
          name: APP_NAME,
          short_name: APP_NAME,
          description: `${APP_NAME} : suivez vos séries et films, épisode par épisode.`,
          lang: "fr",
          start_url: "/",
          scope: "/",
          display: "standalone",
          background_color: "#0B0E14",
          theme_color: "#0B0E14",
          icons: [
            { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            {
              src: "/icon-512-maskable.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        };
        return new Response(JSON.stringify(manifest), {
          headers: {
            "Content-Type": "application/manifest+json",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
