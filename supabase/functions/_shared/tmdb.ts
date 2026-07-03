// Shared TMDb helpers for edge functions
const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY")!;
const TMDB_IMG = "https://image.tmdb.org/t/p/w500";
const CACHE_MS = 48 * 60 * 60 * 1000;

const IS_V4 = TMDB_API_KEY.startsWith("eyJ");

export async function tmdb(path: string, params: Record<string, string> = {}) {
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

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function searchTv(title: string, year?: number) {
  const data = await tmdb("/search/tv", {
    query: title,
    ...(year ? { first_air_date_year: String(year) } : {}),
  });
  const results = data.results ?? [];
  if (!results.length) return { match: null, confidence: 0 };
  const target = normalize(title);
  const scored = results.map((r: any) => {
    const rTitle = normalize(r.name ?? r.original_name ?? "");
    const rYear = r.first_air_date ? Number(r.first_air_date.slice(0, 4)) : null;
    let score = 0;
    if (rTitle === target) score += 0.6;
    else if (rTitle.includes(target) || target.includes(rTitle)) score += 0.35;
    if (year && rYear === year) score += 0.4;
    else if (year && rYear && Math.abs(rYear - year) <= 1) score += 0.2;
    if (!year) score += 0.1;
    return { r, score };
  });
  scored.sort((a: any, b: any) => b.score - a.score);
  return { match: scored[0].r, confidence: Math.min(1, scored[0].score) };
}

export async function cacheShow(
  admin: any,
  tmdbId: number,
  mediaType: "tv" | "movie",
) {
  const { data: cached } = await admin
    .from("shows")
    .select("*")
    .eq("tmdb_id", tmdbId)
    .eq("media_type", mediaType)
    .maybeSingle();
  if (cached && Date.now() - new Date(cached.cached_at).getTime() < CACHE_MS) {
    return cached;
  }
  const details = await tmdb(`/${mediaType}/${tmdbId}`);
  const payload = {
    tmdb_id: tmdbId,
    media_type: mediaType,
    title: details.title ?? details.name ?? "",
    overview: details.overview ?? "",
    poster_path: details.poster_path ? `${TMDB_IMG}${details.poster_path}` : null,
    first_air_date: details.first_air_date || details.release_date || null,
    status: details.status ?? null,
    cached_at: new Date().toISOString(),
  };
  const { data: show } = await admin
    .from("shows")
    .upsert(payload, { onConflict: "tmdb_id,media_type" })
    .select()
    .single();

  if (mediaType === "tv" && Array.isArray(details.seasons)) {
    for (const s of details.seasons) {
      if (s.season_number === 0) continue;
      await admin.from("seasons").upsert(
        {
          show_id: show.id,
          season_number: s.season_number,
          episode_count: s.episode_count ?? null,
        },
        { onConflict: "show_id,season_number" },
      );
      const sd = await tmdb(`/tv/${tmdbId}/season/${s.season_number}`);
      const eps = (sd.episodes ?? []).map((ep: any) => ({
        show_id: show.id,
        season_number: s.season_number,
        episode_number: ep.episode_number,
        title: ep.name ?? null,
        overview: ep.overview ?? null,
        air_date: ep.air_date || null,
      }));
      if (eps.length) {
        await admin
          .from("episodes")
          .upsert(eps, { onConflict: "show_id,season_number,episode_number" });
      }
    }
  }
  return show;
}
