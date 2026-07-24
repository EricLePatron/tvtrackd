import { supabase } from "@/integrations/supabase/client";

// PostgREST caps a `select` response at this many rows unless paginated via
// `.range()` (Supabase project default `db-max-rows`) — pagination below is
// there so the sitemap never silently truncates once `shows`/`seasons` grow
// past a single page, not just for the volumes seen at launch.
const PAGE_SIZE = 1000;

// Pas un plafond dur (un sitemap XML classique supporte jusqu'à 50 000 URLs)
// — juste un garde-fou de log pour être prévenu bien avant d'approcher cette
// limite, plutôt que de la découvrir le jour où Google refuse le fichier.
// Cf. étude SEO §P0-2 : au stade actuel du produit le volume réel est
// vraisemblablement de quelques milliers de lignes, très en dessous.
export const SITEMAP_ELIGIBLE_WARN_THRESHOLD = 40_000;

export type SitemapShow = {
  tmdb_id: number;
  media_type: string;
  cached_at: string;
};

type ShowsRow = {
  id: number;
  tmdb_id: number;
  media_type: string;
  overview: string | null;
  watch_providers: Record<string, unknown> | null;
  cached_at: string;
};

function hasWatchProviders(watchProviders: Record<string, unknown> | null): boolean {
  if (!watchProviders) return false;
  return Object.keys(watchProviders).length > 0;
}

/**
 * T6 (thin content, cf. étude SEO §2) : une fiche n'est éligible au sitemap
 * que si elle porte au moins une des trois preuves de contenu réel — un
 * synopsis, une disponibilité streaming connue, ou (pour une série) au moins
 * une saison déjà en cache. Un simple squelette TMDb (titre + poster, rien
 * d'autre) ne mérite pas d'être soumis au crawl.
 */
export function isEligibleForSitemap(
  show: Pick<ShowsRow, "overview" | "watch_providers" | "media_type">,
  hasSeasons: boolean,
): boolean {
  const hasOverview = !!show.overview && show.overview.trim().length > 0;
  if (hasOverview || hasWatchProviders(show.watch_providers)) return true;
  return show.media_type === "tv" && hasSeasons;
}

async function fetchAllShows(): Promise<ShowsRow[]> {
  const rows: ShowsRow[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("shows")
      .select("id, tmdb_id, media_type, overview, watch_providers, cached_at")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...(data as ShowsRow[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

/** Tous les `show_id` ayant au moins une saison en cache — paginé sur
 * `seasons` en entier (pas de filtrage par lot de `show_id` : plus simple et
 * tout aussi correct, `seasons` reste une table légère, id + 2 entiers). */
async function fetchShowIdsWithSeasons(): Promise<Set<number>> {
  const ids = new Set<number>();
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("seasons")
      .select("show_id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    (data as { show_id: number }[]).forEach((r) => ids.add(r.show_id));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return ids;
}

/**
 * Lecture directe (clé anon, RLS `shows_public_read`/`seasons_public_read` —
 * déjà en lecture publique, cf. migration initiale) — pas de service role
 * nécessaire ni disponible côté serveur Nitro/TanStack Start.
 */
export async function fetchSitemapShows(): Promise<SitemapShow[]> {
  const [shows, showIdsWithSeasons] = await Promise.all([
    fetchAllShows(),
    fetchShowIdsWithSeasons(),
  ]);

  const eligible = shows.filter((s) => isEligibleForSitemap(s, showIdsWithSeasons.has(s.id)));

  if (eligible.length > SITEMAP_ELIGIBLE_WARN_THRESHOLD) {
    console.warn(
      `[sitemap] ${eligible.length} fiches éligibles dépassent le seuil de vigilance ` +
        `(${SITEMAP_ELIGIBLE_WARN_THRESHOLD}) — envisager un sitemap-index paginé avant ` +
        "d'approcher la limite de 50 000 URLs par fichier sitemap.",
    );
  }

  return eligible.map((s) => ({
    tmdb_id: s.tmdb_id,
    media_type: s.media_type,
    cached_at: s.cached_at,
  }));
}
