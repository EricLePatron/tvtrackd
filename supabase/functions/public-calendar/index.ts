import { corsHeaders } from "../_shared/cors.ts";

const TMDB_API_KEY = (Deno.env.get("TMDB_API_KEY") ?? "").trim();
const TMDB_IMG = "https://image.tmdb.org/t/p/w500";
const IS_V4 = TMDB_API_KEY.startsWith("eyJ");

type TmdbTvResult = {
  id: number;
  name?: string;
  original_name?: string;
  first_air_date?: string;
  overview?: string;
  poster_path?: string | null;
};

type CalendarItem = {
  tmdb_id: number;
  media_type: "tv";
  title: string;
  overview: string;
  poster_url: string | null;
  year: number | null;
};

async function tmdb(path: string) {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  url.searchParams.set("language", "fr-FR");
  if (!IS_V4) url.searchParams.set("api_key", TMDB_API_KEY);
  const r = await fetch(url, {
    headers: IS_V4 ? { Authorization: `Bearer ${TMDB_API_KEY}` } : {},
  });
  if (!r.ok) throw new Error(`TMDb ${r.status} ${path}`);
  return r.json();
}

function mapResult(r: TmdbTvResult): CalendarItem {
  const date = r.first_air_date ?? "";
  return {
    tmdb_id: r.id,
    media_type: "tv",
    title: r.name ?? r.original_name ?? "",
    overview: r.overview ?? "",
    poster_url: r.poster_path ? `${TMDB_IMG}${r.poster_path}` : null,
    year: date ? Number(date.slice(0, 4)) : null,
  };
}

type CalendarPayload = { airingToday: CalendarItem[]; onTheAir: CalendarItem[] };

// Cache mémoire opportuniste (pas de table dédiée, cf. commentaire ci-dessous)
// : persiste tant que l'isolate Deno reste chaud entre deux invocations
// rapprochées. Ne garantit rien entre isolates froids/différents, mais
// atténue la multiplication d'appels TMDb pour les requêtes consécutives sur
// un même isolate — notamment celles émises par le `loader` de `/calendar`
// pour des visiteurs déjà connectés, qui préchargent ce contenu public sans
// jamais l'afficher (la route ne peut pas connaître l'état d'auth côté
// serveur, cf. `_public/calendar.tsx`).
let cache: { data: CalendarPayload; expiresAt: number } | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000;

/**
 * Calendrier public généraliste ("Programme de la semaine") pour un visiteur
 * anonyme — cf. P0-4 SEO. Contrairement au calendrier personnalisé
 * (`use-calendar-timeline.ts`, filtré aux séries suivies par l'utilisateur et
 * à notre propre cache `episodes`, incomplet pour un usage public), cette
 * fonction s'appuie directement sur les flux TMDb `airing_today`/`on_the_air`
 * — pas de granularité par épisode/date exacte, seulement un niveau série,
 * volontairement plus modeste que la vue personnalisée. Pas de table de
 * cache DB dédiée (même choix que `trending-media`/`new-releases-media`, cf.
 * convention existante) — `Cache-Control` + staleTime react-query côté
 * client + le cache mémoire ci-dessus suffisent à ce stade.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!cache || Date.now() >= cache.expiresAt) {
      const [airingTodayData, onTheAirData] = await Promise.all([
        tmdb("/tv/airing_today"),
        tmdb("/tv/on_the_air"),
      ]);

      const airingToday: CalendarItem[] = (airingTodayData.results ?? [])
        .filter((r: TmdbTvResult) => r.poster_path)
        .slice(0, 20)
        .map(mapResult);

      const airingTodayIds = new Set(airingToday.map((r) => r.tmdb_id));
      const onTheAir: CalendarItem[] = (onTheAirData.results ?? [])
        .filter((r: TmdbTvResult) => r.poster_path && !airingTodayIds.has(r.id))
        .slice(0, 20)
        .map(mapResult);

      cache = { data: { airingToday, onTheAir }, expiresAt: Date.now() + CACHE_TTL_MS };
    }

    return Response.json(cache.data, {
      headers: { ...corsHeaders, "Cache-Control": "public, max-age=3600" },
    });
  } catch (err) {
    console.error("[public-calendar]", err);
    return Response.json({ error: (err as Error).message }, { status: 500, headers: corsHeaders });
  }
});
