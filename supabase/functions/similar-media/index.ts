import { corsHeaders } from "../_shared/cors.ts";

const TMDB_API_KEY = (Deno.env.get("TMDB_API_KEY") ?? "").trim();
const TMDB_IMG = "https://image.tmdb.org/t/p/w500";
const IS_V4 = TMDB_API_KEY.startsWith("eyJ");

type TmdbResult = {
  id: number;
  name?: string;
  title?: string;
  first_air_date?: string;
  release_date?: string;
  overview?: string;
  poster_path?: string | null;
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { tmdb_id, media_type } = await req.json();
    if (!tmdb_id || (media_type !== "tv" && media_type !== "movie")) {
      return Response.json({ error: "invalid params" }, { status: 400, headers: corsHeaders });
    }

    // "recommendations" est plus curé/pertinent que "similar" côté TMDb ;
    // en fallback si vide (souvent le cas pour titres obscurs) on retente
    // "similar" qui repose sur les genres/mots-clés.
    let data = await tmdb(`/${media_type}/${tmdb_id}/recommendations`);
    if (!Array.isArray(data.results) || data.results.length === 0) {
      data = await tmdb(`/${media_type}/${tmdb_id}/similar`);
    }

    const results = (data.results ?? [])
      .filter((r: TmdbResult) => r.poster_path)
      .slice(0, 20)
      .map((r: TmdbResult) => {
        const title = r.name ?? r.title ?? "";
        const date = r.first_air_date ?? r.release_date ?? "";
        return {
          tmdb_id: r.id,
          media_type,
          title,
          overview: r.overview ?? "",
          poster_url: r.poster_path ? `${TMDB_IMG}${r.poster_path}` : null,
          year: date ? Number(date.slice(0, 4)) : null,
        };
      });

    return Response.json({ results }, { headers: corsHeaders });
  } catch (err) {
    console.error("[similar-media]", err);
    return Response.json({ error: (err as Error).message }, { status: 500, headers: corsHeaders });
  }
});
