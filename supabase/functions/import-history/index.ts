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
  // TV Time user_tv_show_data : nombre total d'épisodes vus déclaré par la
  // source, sans détail S/E. Utilisé quand lastSeason==0 pour marquer les N
  // premiers épisodes comme vus (hypothèse de visionnage linéaire).
  episodesSeenCount?: number | null;
};

type Item = GranularItem | AggregateItem;

function isAggregate(it: Item): it is AggregateItem {
  return it.kind === "aggregate";
}

// La déduction de statut (roadmap #3 — "terminé" seulement si l'historique
// couvre toutes les saisons/épisodes connus ET que la série n'est plus en
// diffusion) est désormais centralisée en SQL : voir compute_tv_status /
// compute_show_status dans la migration 20260706100000_auto_status.sql.
// Cette edge function ne fait plus que peupler watch_status ; les triggers
// SQL recalculent `status` pour toute ligne user_shows déjà existante au fil
// des inserts ci-dessous. Seule la création d'une TOUTE NOUVELLE ligne
// user_shows a besoin d'un calcul explicite (les triggers watch_status ne
// peuvent pas s'appliquer avant que la ligne existe) — voir compute_show_status
// appelé plus bas via RPC.

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
    // Source optionnelle transmise par le frontend (ex. "tvtime", "betaseries")
    const source: string = body.source ?? "";

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
        const {
          match,
          confidence: c,
          candidateCount,
        } = await searchTv(first.title, year ?? undefined);
        confidence = c;
        // Seuil abaissé à 0.6 lorsqu'il n'existe qu'un seul candidat TMDb pour
        // ce (titre, année) : moins de risque de faux positif, on accepte une
        // correspondance moins parfaite (titres localisés, accents absents…).
        // Avec plusieurs candidats on reste à 0.7 pour éviter les confusions.
        const threshold = candidateCount === 1 ? 0.6 : 0.7;
        if (match && c >= threshold) tmdbId = match.id;
      }

      if (!tmdbId) {
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

      // Statut : archive (Betaseries) toujours prioritaire ; sinon le statut est
      // désormais calculé en SQL (compute_show_status), plus jamais déduit ici.
      // Ne jamais écraser un statut déjà choisi manuellement (ou déjà figé par un
      // import précédent), sauf s'il est encore "a_voir" sans manual_override
      // (valeur par défaut, ligne "vierge").
      if (!existingUs) {
        let status = "a_voir";
        let manualOverride: "archive" | null = null;
        if (archived) {
          manualOverride = "archive";
          status = "archive";
        } else {
          // Les watch_status insérés ci-dessus n'ont pas pu déclencher le
          // recalcul automatique : la ligne user_shows n'existait pas encore
          // au moment où les triggers se sont déclenchés. Calcul explicite ici.
          const { data: computed } = await admin.rpc("compute_show_status", {
            p_show_id: show.id,
            p_user_id: userId,
          });
          if (computed) status = computed;
        }
        await admin.from("user_shows").insert({
          user_id: userId,
          show_id: show.id,
          status,
          manual_override: manualOverride,
        });
        followed += 1;
      } else if (existingUs.status === "a_voir" && archived) {
        // Ligne vierge + signal d'archivage explicite de la source : le trigger
        // AFTER UPDATE OF manual_override recalcule `status` tout seul.
        await admin
          .from("user_shows")
          .update({ manual_override: "archive" })
          .eq("id", existingUs.id);
      } else {
        // Ligne user_shows déjà existante (tracking natif ou import antérieur) :
        // on force un recalcul du statut pour qu'une série précédemment "en_cours"
        // passe bien en "termine" si l'import vient de compléter l'historique.
        // apply_computed_status est un no-op si manual_override est défini (gestion
        // côté SQL) ou si le statut calculé est identique au statut actuel.
        await admin.rpc("apply_computed_status", {
          p_show_id: show.id,
          p_user_id: userId,
        });
      }
    }

    // Enregistrement du run d'import pour l'historique (client admin, pas de RLS)
    await admin.from("import_runs").insert({
      user_id: userId,
      source,
      imported_episodes: imported,
      followed_shows: followed,
      unmatched_count: unmatched.length,
      unmatched,
    });

    return Response.json({ imported, followed, unmatched }, { headers: corsHeaders });
  } catch (err) {
    console.error("[import-history]", err);
    return Response.json({ error: (err as Error).message }, { status: 500, headers: corsHeaders });
  }
});
