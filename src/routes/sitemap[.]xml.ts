import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { SITE_URL } from "@/lib/app-config";
import { fetchSitemapShows } from "@/lib/sitemap-shows";

const BASE_URL = SITE_URL;

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
  lastmod?: string;
}

const STATIC_ENTRIES: SitemapEntry[] = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/alternative-tv-time", changefreq: "weekly", priority: "0.9" },
  { path: "/search", changefreq: "weekly", priority: "0.8" },
  { path: "/calendar", changefreq: "daily", priority: "0.8" },
  { path: "/auth", changefreq: "monthly", priority: "0.5" },
  { path: "/legal/mentions-legales", changefreq: "yearly", priority: "0.3" },
  { path: "/legal/confidentialite", changefreq: "yearly", priority: "0.3" },
  { path: "/legal/cgu", changefreq: "yearly", priority: "0.3" },
  { path: "/legal/cookies", changefreq: "yearly", priority: "0.3" },
];

function toEntryXml(e: SitemapEntry): string {
  return [
    `  <url>`,
    `    <loc>${BASE_URL}${e.path}</loc>`,
    e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
    e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
    e.priority ? `    <priority>${e.priority}</priority>` : null,
    `  </url>`,
  ]
    .filter(Boolean)
    .join("\n");
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        // Fiches série/film dynamiques (cache TMDb partagé `shows`, filtrées
        // T6 thin-content) — cf. étude SEO P0-2. Best-effort : si la lecture
        // Supabase échoue, le sitemap reste servi avec au moins les entrées
        // statiques plutôt que de renvoyer une 500 qui ferait disparaître
        // tout le site du crawl.
        let showEntries: SitemapEntry[] = [];
        try {
          const shows = await fetchSitemapShows();
          showEntries = shows.map((s) => ({
            path: `/show/${s.media_type}/${s.tmdb_id}`,
            changefreq: "weekly",
            priority: "0.6",
            lastmod: s.cached_at.slice(0, 10),
          }));
        } catch (err) {
          console.error("[sitemap] fetchSitemapShows failed (best-effort, ignored)", err);
        }

        const urls = [...STATIC_ENTRIES, ...showEntries].map(toEntryXml);

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            // Volumétrie modeste au stade actuel + fiches thin-filtrées : un
            // cache d'une heure reste raisonnable (cf. plan de vérif P0-2),
            // à raccourcir si les fiches doivent apparaître plus vite après
            // un premier passage utilisateur.
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
