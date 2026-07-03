import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY")!;
const TMDB_IMG = "https://image.tmdb.org/t/p/w500";
const CACHE_MS = 48 * 60 * 60 * 1000;

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function tmdb(path: string) {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", "fr-FR");
  const r = await fetch(url);
  if (!r.ok) throw new Error(`TMDb ${r.status} for ${path}`);
  return r.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { tmdb_id, media_type } = await req.json();
    if (!tmdb_id || (media_type !== "tv" && media_type !== "movie")) {
      return Response.json({ error: "invalid params" }, { status: 400, headers: corsHeaders });
    }

    // Cache check
    const { data: cached } = await admin
      .from("shows")
      .select("*")
      .eq("tmdb_id", tmdb_id)
      .eq("media_type", media_type)
      .maybeSingle();

    const fresh =
      cached && Date.now() - new Date(cached.cached_at).getTime() < CACHE_MS;

    let showRow = cached;

    if (!fresh) {
      const details = await tmdb(`/${media_type}/${tmdb_id}`);
      const payload = {
        tmdb_id,
        media_type,
        title: details.title ?? details.name ?? "",
        overview: details.overview ?? "",
        poster_path: details.poster_path
          ? `${TMDB_IMG}${details.poster_path}`
          : null,
        first_air_date:
          details.first_air_date || details.release_date || null,
        status: details.status ?? null,
        cached_at: new Date().toISOString(),
      };
      const { data: upserted, error: upErr } = await admin
        .from("shows")
        .upsert(payload, { onConflict: "tmdb_id,media_type" })
        .select()
        .single();
      if (upErr) throw upErr;
      showRow = upserted;

      if (media_type === "tv" && Array.isArray(details.seasons)) {
        for (const s of details.seasons) {
          if (s.season_number === 0) continue; // skip specials
          const { data: seasonRow, error: sErr } = await admin
            .from("seasons")
            .upsert(
              {
                show_id: showRow.id,
                season_number: s.season_number,
                episode_count: s.episode_count ?? null,
              },
              { onConflict: "show_id,season_number" },
            )
            .select()
            .single();
          if (sErr) throw sErr;

          const seasonDetails = await tmdb(
            `/tv/${tmdb_id}/season/${s.season_number}`,
          );
          const episodes = (seasonDetails.episodes ?? []).map((ep: any) => ({
            show_id: showRow.id,
            season_number: s.season_number,
            episode_number: ep.episode_number,
            title: ep.name ?? null,
            overview: ep.overview ?? null,
            air_date: ep.air_date || null,
          }));
          if (episodes.length) {
            const { error: eErr } = await admin
              .from("episodes")
              .upsert(episodes, {
                onConflict: "show_id,season_number,episode_number",
              });
            if (eErr) throw eErr;
          }
        }
      }
    }

    // Load full nested structure
    const { data: show } = await admin
      .from("shows")
      .select("*")
      .eq("tmdb_id", tmdb_id)
      .eq("media_type", media_type)
      .single();

    const { data: seasons } = await admin
      .from("seasons")
      .select("*")
      .eq("show_id", show!.id)
      .order("season_number");

    const { data: episodes } = await admin
      .from("episodes")
      .select("*")
      .eq("show_id", show!.id)
      .order("season_number")
      .order("episode_number");

    return Response.json(
      { show, seasons: seasons ?? [], episodes: episodes ?? [] },
      { headers: corsHeaders },
    );
  } catch (err) {
    console.error("[get-show-details]", err);
    return Response.json(
      { error: (err as Error).message },
      { status: 500, headers: corsHeaders },
    );
  }
});
