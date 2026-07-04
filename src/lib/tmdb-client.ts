import type { TrendingItem } from "@/components/home/discovery-grid";

/**
 * Direct browser -> TMDb client for the "Tendances" and "Nouvelles sorties"
 * discovery rails ONLY.
 *
 * Why this exists: those two rails used to be backed by the
 * `trending-media` / `new-releases-media` Supabase edge functions, but those
 * functions are never actually deployed on the live (Lovable-managed)
 * Supabase project and there is no reliable way to deploy them from here.
 * Rather than depend on a deployment path we don't control, we call the TMDb
 * API directly from the client for these two rails, reusing the frontend
 * deploy pipeline that does work reliably.
 *
 * All other TMDb-backed features (search, show details, the `shows` cache)
 * are unaffected and keep going through their existing edge functions.
 */

const TMDB_API_KEY = (import.meta.env.VITE_TMDB_API_KEY ?? "").trim();
const TMDB_IMG = "https://image.tmdb.org/t/p/w500";

// Same v3 (api_key query param) vs v4 (Bearer token) detection as the
// server-side helper (supabase/functions/_shared/tmdb.ts) used to do.
const IS_V4 = TMDB_API_KEY.startsWith("eyJ");

type TmdbTvResult = {
  id: number;
  name?: string;
  original_name?: string;
  title?: string;
  first_air_date?: string;
  release_date?: string;
  overview?: string;
  poster_path?: string | null;
};

async function tmdbFetch(path: string, params: Record<string, string> = {}) {
  if (!TMDB_API_KEY) {
    throw new Error(
      "VITE_TMDB_API_KEY manquante — renseigne une clé TMDb v3 dans .env pour activer ce carrousel.",
    );
  }
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  url.searchParams.set("language", "fr-FR");
  if (!IS_V4) url.searchParams.set("api_key", TMDB_API_KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url, {
    headers: IS_V4 ? { Authorization: `Bearer ${TMDB_API_KEY}` } : {},
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("[tmdb-client]", res.status, path, body);
    throw new Error(`TMDb ${res.status} for ${path}`);
  }
  return res.json();
}

function mapTvResult(r: TmdbTvResult): TrendingItem {
  const title = r.name ?? r.original_name ?? r.title ?? "";
  const date = r.first_air_date ?? r.release_date ?? "";
  return {
    tmdb_id: r.id,
    media_type: "tv",
    title,
    overview: r.overview ?? "",
    poster_url: r.poster_path ? `${TMDB_IMG}${r.poster_path}` : null,
    year: date ? Number(date.slice(0, 4)) : null,
  };
}

/** "Tendances" — TMDb weekly trending tv shows. */
export async function fetchTrendingTv(): Promise<TrendingItem[]> {
  const data = await tmdbFetch("/trending/tv/week");
  return ((data.results ?? []) as TmdbTvResult[]).map(mapTvResult);
}

/** "Nouvelles sorties" — TMDb tv shows sorted by most recent first-air date. */
export async function fetchNewReleasesTv(): Promise<TrendingItem[]> {
  const today = new Date().toISOString().slice(0, 10);
  const data = await tmdbFetch("/discover/tv", {
    sort_by: "first_air_date.desc",
    "first_air_date.lte": today,
    "vote_count.gte": "20",
  });
  return ((data.results ?? []) as TmdbTvResult[]).map(mapTvResult);
}
