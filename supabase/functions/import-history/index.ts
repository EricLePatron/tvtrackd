import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { searchTv, cacheShow } from "../_shared/tmdb.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Deux familles d'items en entrée :
// - "granular"  : une ligne = un épisode vu (saison/épisode/date), format historique
//                 TV Time / outils tiers / JSON aplati.
// - "aggregate" : progression résumée par série (export Betaseries), sans date par
//                 épisode — seulement le dernier épisode vu, un statut d'archive et
//                 un pourcentage de complétion. Voir src/lib/import-parsers.ts côté
//                 frontend pour la logique de détection/parsing.
type GranularItem = {
  kind?: "granular";
  title: string;
  year?: number | null;
  season?: number | null;
  episode?: number | null;
  watched_at?: string | null;
};

type AggregateItem = {
  kind: "aggregate";
  title: string;
  year?: number | null;
  lastSeason: number;
  lastEpisode: number;
  archived?: boolean;
  percent?: number | null;
};

type Item = GranularItem | AggregateItem;

function isAggregate(it: Item): it is AggregateItem {
  return it.kind === "aggregate";
}

// ------- Déduction du statut (roadmap #3) -------
//
// "Terminé" n'est déduit que si l'historique couvre toutes les saisons/épisodes
// connus de TMDb ET que la série n'est plus en diffusion (Ended/Canceled côté
// TMDb — champ non localisé, valeurs fixes même avec language=fr-FR). Une série
// toujours en diffusion mais entièrement rattrapée reste "en_cours" : c'est le
// cas ambigu explicitement identifié (à jour, pas terminé).
function deduceStatus(
  showStatus: string | null,
  totalKnown: number | null,
  watchedCount: number,
): "termine" | "en_cours" {
  if (totalKnown !== null && totalKnown > 0 && watchedCount >= totalKnown) {
    if (showStatus === "Ended" || showStatus === "Canceled") return "termine";
  }
  return "en_cours";
}

async function getShowProgress(
  userId: string,
  showId: number,
): Promise<{ totalKnown: number | null; watchedCount: number }> {
  const { data: seasonsData } = await admin
    .from("seasons")
    .select("episode_count")
    .eq("show_id", showId);

  let totalKnown: number | null = 0;
  for (const s of seasonsData ?? []) {
    if (totalKnown === null) break;
    if (s.episode_count === null || s.episode_count === undefined) {
      totalKnown = null;
      break;
    }
    totalKnown += s.episode_count;
  }

  const { count } = await admin
    .from("watch_status")
    .select("id, episodes!inner(show_id)", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("episodes.show_id", showId);

  return { totalKnown, watchedCount: count ?? 0 };
}

async function getEpisodesInOrder(
  showId: number,
): Promise<{ id: number; season_number: number; episode_number: number }[]> {
  const { data } = await admin
    .from("episodes")
    .select("id, season_number, episode_number")
    .eq("show_id", showId)
    .order("season_number", { ascending: true })
    .order("episode_number", { ascending: true });
  return data ?? [];
}

function prefixUpTo<T extends { season_number: number; episode_number: number }>(
  episodes: T[],
  lastSeason: number,
  lastEpisode: number,
): T[] {
  if (lastSeason <= 0) return [];
  return episodes.filter(
    (e) =>
      e.season_number < lastSeason ||
      (e.season_number === lastSeason && e.episode_number <= lastEpisode),
  );
}

// Utilisé par la branche granulaire : chaque item représente un visionnage
// explicite de la source (TV Time / outils tiers), donc un rewatch détecté doit
// bien incrémenter watch_count et mettre à jour la date.
async function upsertGranularWatchStatus(userId: string, episodeId: number, watchedAt: string) {
  const { data: existing } = await admin
    .from("watch_status")
    .select("id, watch_count")
    .eq("user_id", userId)
    .eq("episode_id", episodeId)
    .maybeSingle();
  if (existing) {
    await admin
      .from("watch_status")
      .update({
        watch_count: (existing.watch_count ?? 1) + 1,
        watched_at: watchedAt,
        watched_at_approximate: false,
      })
      .eq("id", existing.id);
  } else {
    await admin.from("watch_status").insert({
      user_id: userId,
      episode_id: episodeId,
      watch_count: 1,
      watched_at: watchedAt,
      watched_at_approximate: false,
    });
  }
}

// Utilisé par la branche agrégée (Betaseries) : on ne connaît qu'un dernier
// épisode vu, pas un événement de visionnage précis par épisode. Une ligne
// watch_status déjà existante (tracking natif ou import antérieur, fiable ou
// non) ne doit donc JAMAIS être réécrite ici — ni son watch_count (pas de faux
// rewatch), ni sa date. On insère uniquement les épisodes qui n'ont encore
// aucune ligne pour cet utilisateur.
async function insertWatchStatusIfMissing(
  userId: string,
  episodeId: number,
  watchedAt: string,
): Promise<boolean> {
  const { data: existing } = await admin
    .from("watch_status")
    .select("id")
    .eq("user_id", userId)
    .eq("episode_id", episodeId)
    .maybeSingle();
  if (existing) return false;
  await admin.from("watch_status").insert({
    user_id: userId,
    episode_id: episodeId,
    watch_count: 1,
    watched_at: watchedAt,
    watched_at_approximate: true,
  });
  return true;
}

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
    const unmatched: { key: string; title: string; year: number | null; occurrences: number }[] =
      [];

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

      const { data: existingUs } = await admin
        .from("user_shows")
        .select("id, status")
        .eq("user_id", userId)
        .eq("show_id", show.id)
        .maybeSingle();

      let archived = false;

      if (isAggregate(first)) {
        const aggItems = group.filter(isAggregate);
        const marker = aggItems.reduce(
          (acc, it) =>
            it.lastSeason > acc.lastSeason ||
            (it.lastSeason === acc.lastSeason && it.lastEpisode > acc.lastEpisode)
              ? { lastSeason: it.lastSeason, lastEpisode: it.lastEpisode }
              : acc,
          { lastSeason: 0, lastEpisode: 0 },
        );
        archived = aggItems.some((it) => it.archived === true);

        if (marker.lastSeason > 0) {
          const episodesOrdered = await getEpisodesInOrder(show.id);
          const toMark = prefixUpTo(episodesOrdered, marker.lastSeason, marker.lastEpisode);
          const nowIso = new Date().toISOString();
          for (const ep of toMark) {
            const inserted = await insertWatchStatusIfMissing(userId, ep.id, nowIso);
            if (inserted) imported += 1;
          }
        }
      } else {
        const granularItems = group.filter((it): it is GranularItem => !isAggregate(it));
        for (const it of granularItems) {
          if (!it.season || !it.episode) continue;
          const { data: ep } = await admin
            .from("episodes")
            .select("id")
            .eq("show_id", show.id)
            .eq("season_number", it.season)
            .eq("episode_number", it.episode)
            .maybeSingle();
          if (!ep) continue;
          await upsertGranularWatchStatus(userId, ep.id, it.watched_at ?? new Date().toISOString());
          imported += 1;
        }
      }

      // Statut : archive (Betaseries) toujours prioritaire, puis "rien de vu" -> à
      // voir, puis déduction TMDb (termine / en_cours). Ne jamais écraser un statut
      // déjà choisi manuellement, sauf s'il est encore "a_voir" (valeur par défaut).
      const progress = await getShowProgress(userId, show.id);
      const baseline = deduceStatus(show.status, progress.totalKnown, progress.watchedCount);
      const finalStatus = archived ? "archive" : progress.watchedCount === 0 ? "a_voir" : baseline;

      if (!existingUs) {
        await admin.from("user_shows").insert({
          user_id: userId,
          show_id: show.id,
          status: finalStatus,
        });
        followed += 1;
      } else if (existingUs.status === "a_voir") {
        await admin.from("user_shows").update({ status: finalStatus }).eq("id", existingUs.id);
      }
    }

    return Response.json({ imported, followed, unmatched }, { headers: corsHeaders });
  } catch (err) {
    console.error("[import-history]", err);
    return Response.json({ error: (err as Error).message }, { status: 500, headers: corsHeaders });
  }
});
