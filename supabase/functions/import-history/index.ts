import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { searchTv, cacheShow } from "../_shared/tmdb.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

type Item = {
  title: string;
  year?: number | null;
  season?: number | null;
  episode?: number | null;
  watched_at?: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const token = authHeader.replace("Bearer ", "");
    const { data: userRes, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userRes.user) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const userId = userRes.user.id;

    const body = await req.json();
    const items: Item[] = body.items ?? [];
    const resolutions: Record<string, number> = body.resolutions ?? {}; // key "title|year" -> tmdb_id

    // Group by (title, year)
    const groups = new Map<string, Item[]>();
    for (const it of items) {
      if (!it.title) continue;
      const key = `${it.title.trim().toLowerCase()}|${it.year ?? ""}`;
      const arr = groups.get(key) ?? [];
      arr.push(it);
      groups.set(key, arr);
    }

    let imported = 0;
    let followed = 0;
    const unmatched: { key: string; title: string; year: number | null; occurrences: number }[] = [];

    for (const [key, group] of groups) {
      const first = group[0];
      const year = first.year ?? null;
      let tmdbId: number | null = resolutions[key] ?? null;
      let confidence = tmdbId ? 1 : 0;

      if (!tmdbId) {
        const { match, confidence: c } = await searchTv(first.title, year ?? undefined);
        confidence = c;
        if (match && c >= 0.7) tmdbId = match.id;
      }

      if (!tmdbId || confidence < 0.7) {
        unmatched.push({ key, title: first.title, year, occurrences: group.length });
        continue;
      }

      const show = await cacheShow(admin, tmdbId, "tv");
      // Follow
      const { data: existingUs } = await admin
        .from("user_shows")
        .select("id")
        .eq("user_id", userId)
        .eq("show_id", show.id)
        .maybeSingle();
      if (!existingUs) {
        await admin.from("user_shows").insert({
          user_id: userId,
          show_id: show.id,
          status: "en_cours",
        });
        followed += 1;
      }

      // Mark episodes as watched
      for (const it of group) {
        if (!it.season || !it.episode) continue;
        const { data: ep } = await admin
          .from("episodes")
          .select("id")
          .eq("show_id", show.id)
          .eq("season_number", it.season)
          .eq("episode_number", it.episode)
          .maybeSingle();
        if (!ep) continue;
        const { data: existing } = await admin
          .from("watch_status")
          .select("id, watch_count")
          .eq("user_id", userId)
          .eq("episode_id", ep.id)
          .maybeSingle();
        if (existing) {
          await admin
            .from("watch_status")
            .update({
              watch_count: (existing.watch_count ?? 1) + 1,
              watched_at: it.watched_at ?? new Date().toISOString(),
            })
            .eq("id", existing.id);
        } else {
          await admin.from("watch_status").insert({
            user_id: userId,
            episode_id: ep.id,
            watch_count: 1,
            watched_at: it.watched_at ?? new Date().toISOString(),
          });
        }
        imported += 1;
      }
    }

    return Response.json(
      { imported, followed, unmatched },
      { headers: corsHeaders },
    );
  } catch (err) {
    console.error("[import-history]", err);
    return Response.json(
      { error: (err as Error).message },
      { status: 500, headers: corsHeaders },
    );
  }
});
