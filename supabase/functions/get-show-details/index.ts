import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY")!;
const TMDB_IMG = "https://image.tmdb.org/t/p/w500";
const TMDB_BACKDROP = "https://image.tmdb.org/t/p/w1280";
const TMDB_LOGO = "https://image.tmdb.org/t/p/w92";
const CACHE_MS = 48 * 60 * 60 * 1000;

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const IS_V4 = TMDB_API_KEY.startsWith("eyJ");

async function tmdb(path: string, params: Record<string, string> = {}) {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  url.searchParams.set("language", "fr-FR");
  if (!IS_V4) url.searchParams.set("api_key", TMDB_API_KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url, {
    headers: IS_V4 ? { Authorization: `Bearer ${TMDB_API_KEY}` } : {},
  });
  if (!r.ok) {
    const body = await r.text();
    console.error("[tmdb]", r.status, path, body);
    throw new Error(`TMDb ${r.status} for ${path}`);
  }
  return r.json();
}

function mapProvider(p: any) {
  return {
    provider_id: p.provider_id,
    provider_name: p.provider_name,
    logo_path: p.logo_path ? `${TMDB_LOGO}${p.logo_path}` : null,
  };
}

// Ne garde que la région FR (app francophone, cf. CLAUDE.md) et les
// catégories affichées côté front (flatrate/rent/buy/ads/free). `results.FR`
// peut être absent (pas de données JustWatch connues pour ce titre en
// France) : dans ce cas on stocke `{}` plutôt que de planter l'upsert.
function extractWatchProviders(details: any): Record<string, unknown> {
  const fr = details?.["watch/providers"]?.results?.FR;
  if (!fr) return {};
  const out: Record<string, unknown> = {};
  if (fr.link) out.link = fr.link;
  for (const key of ["flatrate", "rent", "buy", "ads", "free"] as const) {
    if (Array.isArray(fr[key]) && fr[key].length) {
      out[key] = fr[key].map(mapProvider);
    }
  }
  return out;
}

function extractNetworks(
  details: any,
): Array<{ id: number; name: string; logo_path: string | null }> {
  if (!Array.isArray(details?.networks)) return [];
  return details.networks.map((n: any) => ({
    id: n.id,
    name: n.name,
    logo_path: n.logo_path ? `${TMDB_LOGO}${n.logo_path}` : null,
  }));
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

    const fresh = cached && Date.now() - new Date(cached.cached_at).getTime() < CACHE_MS;

    let showRow = cached;

    if (!fresh) {
      const details = await tmdb(`/${media_type}/${tmdb_id}`, {
        append_to_response: "watch/providers",
      });
      const payload = {
        tmdb_id,
        media_type,
        title: details.title ?? details.name ?? "",
        overview: details.overview ?? "",
        poster_path: details.poster_path ? `${TMDB_IMG}${details.poster_path}` : null,
        backdrop_path: details.backdrop_path ? `${TMDB_BACKDROP}${details.backdrop_path}` : null,
        first_air_date: details.first_air_date || details.release_date || null,
        status: details.status ?? null,
        genres: (details.genres ?? []).map((g: { name: string }) => g.name),
        vote_average: details.vote_average ?? null,
        tagline: details.tagline?.trim() || null,
        watch_providers: extractWatchProviders(details),
        networks: extractNetworks(details),
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

          const seasonDetails = await tmdb(`/tv/${tmdb_id}/season/${s.season_number}`);
          const episodes = (seasonDetails.episodes ?? []).map((ep: any) => ({
            show_id: showRow.id,
            season_number: s.season_number,
            episode_number: ep.episode_number,
            title: ep.name ?? null,
            overview: ep.overview ?? null,
            air_date: ep.air_date || null,
            still_path: ep.still_path ? `${TMDB_BACKDROP}${ep.still_path}` : null,
          }));
          if (episodes.length) {
            const { error: eErr } = await admin.from("episodes").upsert(episodes, {
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
    return Response.json({ error: (err as Error).message }, { status: 500, headers: corsHeaders });
  }
});
