import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { deriveHomeView, type HomeData } from "@/lib/schedule";

type MarkWatchedContext = {
  homeKey: readonly [string, string];
  /** `undefined` when `["home-schedule", user.id]` wasn't cached at all — nothing to roll back to. */
  prevHome: HomeData | undefined;
};

/**
 * Mutation partagée pour marquer un épisode "vu" en 1 clic depuis la Home
 * (Reprendre / Nouveau / hero) et le calendrier (épisodes passés non vus). Ne
 * gère jamais le décochage : le clic vient d'une carte qui, par construction,
 * représente un épisode non vu — décocher passe par la fiche série.
 *
 * Optimistic UI (cf. CLAUDE.md : jamais d'attente visible sur une action de
 * tracking) : `onMutate` patche directement le cache `["home-schedule",
 * user.id]` quand il est présent — peu importe que le tap vienne de la Home
 * ou du calendrier (`day-rail.tsx`'s `EntryCard`) — en rejouant
 * `deriveHomeView` (donc les vrais `buildReadyItems`/`selectHero`, jamais une
 * approximation à la main) sur une copie de `watchedEpisodeIds` + l'épisode
 * tapé. Si ce cache est absent (jamais fetché, ex. arrivée directe sur
 * `/calendar`), c'est un no-op : rien à patcher, comportement inchangé pour
 * l'appelant — le call site calendrier n'est donc jamais impacté par ce qui
 * suit, sa propre query (`calendar-timeline-episodes`) n'est ni lue ni
 * écrite ici.
 *
 * Zone B ("Programme à venir" : `dayGroups`/`upcomingCount`/`countdown`)
 * n'est jamais recalculée : `groupUpcomingByDay`/`nextCountdown` ne prennent
 * aucun watched-set en entrée (seul `air_date > today` compte), donc marquer
 * un épisode passé/du jour vu ne peut structurellement pas les affecter —
 * elles sont recopiées telles quelles depuis `prevHome` (via `...prevHome`).
 *
 * Lecture-modification-écriture du cache volontairement SYNCHRONE (aucun
 * `await` avant le `setQueryData`) : deux `mutate()` déclenchés coup sur coup
 * sur DEUX épisodes différents doivent chacun lire la version du cache déjà
 * patchée par le tap précédent, jamais une snapshot obsolète capturée avant
 * lui — c'est ça le "verrou" pertinent ici, pas un `Set<number>` d'ids
 * verrouillés façon fiche série : contrairement à `toggleWatched`/
 * `toggleSeason` (une seule instance de mutation partagée par toute la
 * liste d'épisodes), chaque carte Home instancie son propre
 * `useMarkWatched()`, donc le double-clic sur UN MÊME bouton est déjà
 * couvert par son propre `isPending` (cf. `HeroTicket`/`ReadyListItem`/
 * `StartCard`) sans mécanisme supplémentaire. `cancelQueries` est appelé en
 * fire-and-forget (non attendu) pour ne jamais introduire de point de
 * suspension avant l'écriture du nouveau snapshot.
 */
export function useMarkWatched() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ episodeId }: { episodeId: number; showId: number }) => {
      if (!user) throw new Error("no user");
      const { error } = await supabase.from("watch_status").upsert(
        {
          user_id: user.id,
          episode_id: episodeId,
          watch_count: 1,
          watched_at: new Date().toISOString(),
        },
        { onConflict: "user_id,episode_id" },
      );
      if (error) throw error;
    },
    onMutate: ({ episodeId, showId }): MarkWatchedContext | undefined => {
      if (!user) return undefined;
      const homeKey = ["home-schedule", user.id] as const;
      // Fire-and-forget: never awaited, see doc comment above.
      void qc.cancelQueries({ queryKey: homeKey });

      const prevHome = qc.getQueryData<HomeData>(homeKey);
      if (!prevHome) return { homeKey, prevHome: undefined };

      const watchedEpisodeIds = new Set(prevHome.raw.watchedEpisodeIds);
      watchedEpisodeIds.add(episodeId);

      const lastWatchedAtByShowId = new Map(prevHome.raw.lastWatchedAtByShowId);
      lastWatchedAtByShowId.set(showId, new Date().toISOString());

      const heroKeyOf = (item: HomeData["hero"]) =>
        item && `${item.show.id}:${item.nextEpisode.season_number}`;
      const prevHeroKey = heroKeyOf(prevHome.hero);

      // First pass without assuming the hero stays the same — only once we
      // know the NEW hero can we tell whether `heroSeasonEpisodeCount`
      // (fetched for the OLD hero's season only) still applies to it.
      // `hero`/`reprendre`/`nouveau`/`readyCount` never depend on
      // `heroSeasonEpisodeCount` (only `heroProgress` does), so this pass is
      // already final for everything except `heroProgress`.
      const provisional = deriveHomeView(
        {
          episodes: prevHome.raw.episodes,
          showStatusByShowId: prevHome.raw.showStatusByShowId,
          lastWatchedAtByShowId,
          watchedEpisodeIds,
          heroSeasonEpisodeCount: null,
        },
        prevHome.today,
      );
      const newHeroKey = heroKeyOf(provisional.hero);
      const heroSeasonEpisodeCount =
        newHeroKey && newHeroKey === prevHeroKey ? prevHome.raw.heroSeasonEpisodeCount : null;

      // Only re-run the pipeline a second time when there's an actual known
      // count to fold in (same hero, count was known) — otherwise the
      // provisional pass above (already computed with `null`) is correct as-is.
      const view =
        heroSeasonEpisodeCount == null
          ? provisional
          : deriveHomeView(
              {
                episodes: prevHome.raw.episodes,
                showStatusByShowId: prevHome.raw.showStatusByShowId,
                lastWatchedAtByShowId,
                watchedEpisodeIds,
                heroSeasonEpisodeCount,
              },
              prevHome.today,
            );

      const nextHome: HomeData = {
        ...prevHome,
        hero: view.hero,
        heroProgress: view.heroProgress,
        reprendre: view.reprendre,
        nouveau: view.nouveau,
        readyCount: view.readyCount,
        raw: {
          ...prevHome.raw,
          watchedEpisodeIds,
          lastWatchedAtByShowId,
          heroSeasonEpisodeCount,
        },
      };

      qc.setQueryData(homeKey, nextHome);
      return { homeKey, prevHome };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevHome) qc.setQueryData(ctx.homeKey, ctx.prevHome);
      toast.error("Impossible de marquer l'épisode");
    },
    onSettled: (_data, _err, { showId }) => {
      // Réconciliation finale avec la vérité serveur, succès ou échec — Home
      // + calendrier + fiche série (le cas échéant) doivent re-render.
      qc.invalidateQueries({ queryKey: ["home-schedule", user?.id] });
      qc.invalidateQueries({ queryKey: ["calendar-timeline-episodes", user?.id] });
      qc.invalidateQueries({ queryKey: ["library", user?.id] });
      qc.invalidateQueries({ queryKey: ["library-progress", user?.id] });
      qc.invalidateQueries({ queryKey: ["watched", user?.id, showId] });
    },
  });
}
