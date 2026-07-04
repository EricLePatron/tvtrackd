import { corsHeaders } from "../_shared/cors.ts";
import { tmdb } from "../_shared/tmdb.ts";

const TMDB_IMG = "https://image.tmdb.org/t/p/w500";

type TmdbTvResult = {
  id: number;
  name?: string;
  original_name?: string;
  first_air_date?: string;
  overview?: string;
  poster_path?: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const today = new Date().toISOString().slice(0, 10);
    const data = await tmdb("/discover/tv", {
      sort_by: "first_air_date.desc",
      "first_air_date.lte": today,
      "vote_count.gte": "20",
    });

    const results = (data.results ?? []).map((r: TmdbTvResult) => {
      const date = r.first_air_date ?? "";
      return {
        tmdb_id: r.id,
        media_type: "tv" as const,
        title: r.name ?? r.original_name ?? "",
        overview: r.overview ?? "",
        poster_url: r.poster_path ? `${TMDB_IMG}${r.poster_path}` : null,
        year: date ? Number(date.slice(0, 4)) : null,
      };
    });

    return Response.json({ results }, { headers: corsHeaders });
  } catch (err) {
    console.error("[new-releases-media]", err);
    return Response.json({ error: (err as Error).message }, { status: 500, headers: corsHeaders });
  }
});
