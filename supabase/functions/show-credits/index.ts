import { corsHeaders } from "../_shared/cors.ts";

const TMDB_API_KEY = (Deno.env.get("TMDB_API_KEY") ?? "").trim();
const TMDB_PROFILE = "https://image.tmdb.org/t/p/w185";
const IS_V4 = TMDB_API_KEY.startsWith("eyJ");

type TmdbCast = {
  id: number;
  name?: string;
  character?: string;
  profile_path?: string | null;
  order?: number;
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
    // Pour les séries : `aggregate_credits` fusionne les rôles à travers
    // toutes les saisons (bien plus fiable que /credits qui ne renvoie
    // parfois que le cast pilote). Pour les films : /credits standard.
    const path =
      media_type === "tv"
        ? `/tv/${tmdb_id}/aggregate_credits`
        : `/movie/${tmdb_id}/credits`;
    const data = await tmdb(path);
    const cast = (data.cast ?? [])
      .slice(0, 24)
      .map((c: TmdbCast & { roles?: Array<{ character?: string }>; total_episode_count?: number }) => ({
        person_id: c.id,
        name: c.name ?? "",
        character:
          (c.roles && c.roles[0]?.character) ||
          c.character ||
          "",
        profile_url: c.profile_path ? `${TMDB_PROFILE}${c.profile_path}` : null,
      }));
    return Response.json({ cast }, { headers: corsHeaders });
  } catch (err) {
    console.error("[show-credits]", err);
    return Response.json({ error: (err as Error).message }, { status: 500, headers: corsHeaders });
  }
});
