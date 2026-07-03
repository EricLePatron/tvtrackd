import { corsHeaders } from "../_shared/cors.ts";

const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY")!;
const TMDB_IMG = "https://image.tmdb.org/t/p/w500";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { q } = await req.json();
    if (!q || typeof q !== "string" || q.trim().length < 2) {
      return Response.json({ results: [] }, { headers: corsHeaders });
    }
    const url = new URL("https://api.themoviedb.org/3/search/multi");
    url.searchParams.set("query", q);
    url.searchParams.set("language", "fr-FR");
    url.searchParams.set("include_adult", "false");
    const isV4 = TMDB_API_KEY.startsWith("eyJ");
    if (!isV4) url.searchParams.set("api_key", TMDB_API_KEY);
    const res = await fetch(url, {
      headers: isV4 ? { Authorization: `Bearer ${TMDB_API_KEY}` } : {},
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[search-media] TMDb", res.status, body);
      throw new Error(`TMDb ${res.status}`);
    }
    const data = await res.json();

    const results = (data.results ?? [])
      .filter((r: any) => r.media_type === "tv" || r.media_type === "movie")
      .map((r: any) => {
        const title = r.title ?? r.name ?? "";
        const date = r.release_date ?? r.first_air_date ?? "";
        return {
          tmdb_id: r.id,
          media_type: r.media_type as "tv" | "movie",
          title,
          overview: r.overview ?? "",
          poster_url: r.poster_path ? `${TMDB_IMG}${r.poster_path}` : null,
          year: date ? Number(date.slice(0, 4)) : null,
        };
      });

    return Response.json({ results }, { headers: corsHeaders });
  } catch (err) {
    console.error("[search-media]", err);
    return Response.json(
      { error: (err as Error).message },
      { status: 500, headers: corsHeaders },
    );
  }
});
