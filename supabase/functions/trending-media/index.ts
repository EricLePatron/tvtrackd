import { corsHeaders } from "../_shared/cors.ts";

const TMDB_API_KEY = (Deno.env.get("TMDB_API_KEY") ?? "").trim();
const TMDB_IMG = "https://image.tmdb.org/t/p/w500";

type TmdbTvResult = {
  id: number;
  name?: string;
  title?: string;
  first_air_date?: string;
  release_date?: string;
  overview?: string;
  poster_path?: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL("https://api.themoviedb.org/3/trending/tv/week");
    url.searchParams.set("language", "fr-FR");
    const isV4 = TMDB_API_KEY.startsWith("eyJ");
    if (!isV4) url.searchParams.set("api_key", TMDB_API_KEY);
    const res = await fetch(url, {
      headers: isV4 ? { Authorization: `Bearer ${TMDB_API_KEY}` } : {},
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[trending-media] TMDb", res.status, body);
      throw new Error(`TMDb ${res.status}`);
    }
    const data = await res.json();

    // trending/tv/week (unlike trending/all/week) doesn't tag each result
    // with a `media_type` field — every result here is a tv show.
    const results = (data.results ?? []).map((r: TmdbTvResult) => {
      const title = r.name ?? r.title ?? "";
      const date = r.first_air_date ?? r.release_date ?? "";
      return {
        tmdb_id: r.id,
        media_type: "tv" as const,
        title,
        overview: r.overview ?? "",
        poster_url: r.poster_path ? `${TMDB_IMG}${r.poster_path}` : null,
        year: date ? Number(date.slice(0, 4)) : null,
      };
    });

    return Response.json({ results }, { headers: corsHeaders });
  } catch (err) {
    console.error("[trending-media]", err);
    return Response.json({ error: (err as Error).message }, { status: 500, headers: corsHeaders });
  }
});
