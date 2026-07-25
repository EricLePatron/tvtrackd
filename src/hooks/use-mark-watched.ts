import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { deriveHomeView, type HomeData, type HomeRawInputs, type ReadyItem } from "@/lib/schedule";

function homeScheduleKey(userId: string) {
  return ["home-schedule", userId] as const;
}

function heroKeyOf(item: ReadyItem | null) {
  return item && `${item.show.id}:${item.nextEpisode.season_number}`;
}

/**
 * One "burst" of concurrent optimistic mark-watched taps for a given user:
 * `base` is the last known GOOD (server-confirmed, or fully-settled) raw
 * scheduling data — captured once, when the burst starts from an empty
 * `inFlight` set — and `inFlight` is every episode currently awaiting its
 * Supabase round trip, mapped to the show it belongs to. The displayed
 * `HomeData` is always *recomputed fresh* from `base` + `inFlight` (see
 * `recomputeFromBatch`), never from a snapshot of "whatever the cache showed
 * right before this one mutation" — that's what makes a single mutation's
 * failure unable to stomp on a sibling mutation's still-in-flight optimism
 * (see `markWatchedOnSettled`).
 */
type MarkWatchedBatch = {
  base: HomeRawInputs;
  inFlight: Map<number, number>; // episodeId -> showId
};

// Keyed by QueryClient (not just userId) so independent QueryClient instances
// — different app sessions, or a fresh `new QueryClient()` per test — never
// share state with one another. Per-userId isolation on top of that: two
// different userIds on the SAME QueryClient (e.g. a shared test instance)
// each get their own entry in this inner Map, never touching one another's
// batch or `["home-schedule", <other userId>]` cache entry.
const batchByClient = new WeakMap<QueryClient, Map<string, MarkWatchedBatch>>();

function getBatchMap(qc: QueryClient): Map<string, MarkWatchedBatch> {
  let m = batchByClient.get(qc);
  if (!m) {
    m = new Map();
    batchByClient.set(qc, m);
  }
  return m;
}

/**
 * Re-derives `HomeData` from `batch.base` + every episode currently listed in
 * `batch.inFlight` — the entire "À voir maintenant" view (hero/heroProgress/
 * reprendre/reprendreProgressByShowId/nouveau/readyCount) is rebuilt from
 * scratch every time, rather than incrementally patched, so it's correct
 * regardless of which specific subset of `inFlight` is currently active
 * (whether we just added one more episode, or just removed one after a
 * failure).
 *
 * Zone B ("Programme à venir" : `dayGroups`/`upcomingCount`/`nextReleases`)
 * is always carried over unchanged from `prevHome` (via `...prevHome`) —
 * `groupUpcomingByDay`/`selectNextReleases` take no watched-set input at
 * all, so marking a past/today episode watched cannot structurally affect
 * them.
 */
function recomputeFromBatch(prevHome: HomeData, batch: MarkWatchedBatch): HomeData {
  const { base } = batch;
  const inFlightShowIds = new Set(batch.inFlight.values());

  const watchedEpisodeIds = new Set(base.watchedEpisodeIds);
  for (const episodeId of batch.inFlight.keys()) watchedEpisodeIds.add(episodeId);

  const lastWatchedAtByShowId = new Map(base.lastWatchedAtByShowId);
  const nowIso = new Date().toISOString();
  for (const showId of inFlightShowIds) lastWatchedAtByShowId.set(showId, nowIso);

  // Point 10 (staleness statut vs trigger SQL `auto_status`): le trigger
  // fait passer une série a_voir -> en_cours dès l'insertion de sa PREMIÈRE
  // ligne `watch_status`. Reflété ici comme une pure fonction de "cette série
  // a-t-elle un tap mark-watched en vol en ce moment", scopée strictement à
  // `inFlightShowIds`, jamais persistée au-delà. Ça rend le bump
  // intrinsèquement concurrency-safe : il s'évapore de lui-même dès que la
  // dernière mutation en vol pour cette série quitte le registre — un échec
  // retire simplement cette série de `inFlightShowIds` au recalcul suivant,
  // un succès est de toute façon supplanté par le refetch imminent
  // d'`onSettled`. Voir `markWatchedOnSettled`.
  const showStatusByShowId = new Map(base.showStatusByShowId);
  for (const showId of inFlightShowIds) {
    if (showStatusByShowId.get(showId) === "a_voir") {
      showStatusByShowId.set(showId, "en_cours");
    }
  }

  const rawWithoutHeroCount: HomeRawInputs = {
    episodes: base.episodes,
    showStatusByShowId,
    lastWatchedAtByShowId,
    watchedEpisodeIds,
    heroSeasonEpisodeCount: null,
    // Carried over unchanged from `base` — like `episodes`, this map doesn't
    // depend on watched status, only on (showId, seasonNumber) identity, so
    // marking an episode watched can't invalidate an entry already in it. A
    // "Reprendre" row that rotates into a NEW season it has no entry for
    // simply shows no fraction until the next server refetch — same
    // fail-safe behavior as `computeReprendreProgress` documents, no reset
    // needed here (unlike `heroSeasonEpisodeCount` below, which DOES need
    // one — see `heroKeyOf`).
    reprendreSeasonEpisodeCounts: base.reprendreSeasonEpisodeCounts,
  };
  const view = deriveHomeView(rawWithoutHeroCount, prevHome.today);

  // `heroSeasonEpisodeCount` a été fetché pour le show/saison du hero de
  // `base` LUI-MÊME (non modifié) — réutilisé seulement si le hero recalculé
  // avec l'ensemble complet des ids en vol résout encore vers ce même show +
  // cette même saison, jamais transporté à travers une rotation.
  //
  // Limites connues et acceptées (flashs transitoires, auto-corrigés au
  // prochain refetch — `onSettled` invalide toujours `home-schedule`) :
  // - Si DEUX mutations en vol touchent la MÊME série a_voir et que l'une
  //   réussit pendant que l'autre échoue ensuite (en étant la dernière à
  //   drainer le batch), ce recalcul peut brièvement repasser la série en
  //   a_voir alors que le trigger SQL l'a réellement fait passer en_cours.
  // - Plus généralement, si le refetch déclenché par le règlement d'une
  //   mutation SŒUR A résout PENDANT qu'une mutation B est encore en vol, la
  //   réponse réseau de A écrase transitoirement le cache avec une donnée
  //   qui ne connaît pas encore l'optimisme de B — B se réaffiche dès son
  //   propre `onSettled` (ou le prochain recalcul de batch), donc borné à un
  //   aller-retour réseau, jamais permanent.
  // Scénarios rares (mutations concurrentes sur la même série, ou fenêtre de
  // course entre deux refetch), dans la même catégorie que le `heroProgress`
  // masqué le temps d'une rotation.
  const baseHero = deriveHomeView(base, prevHome.today).hero;
  const heroSeasonEpisodeCount =
    heroKeyOf(view.hero) === heroKeyOf(baseHero) ? base.heroSeasonEpisodeCount : null;

  const finalView =
    heroSeasonEpisodeCount == null
      ? view
      : deriveHomeView({ ...rawWithoutHeroCount, heroSeasonEpisodeCount }, prevHome.today);

  return {
    ...prevHome,
    hero: finalView.hero,
    heroProgress: finalView.heroProgress,
    reprendre: finalView.reprendre,
    reprendreProgressByShowId: finalView.reprendreProgressByShowId,
    nouveau: finalView.nouveau,
    readyCount: finalView.readyCount,
    raw: { ...rawWithoutHeroCount, heroSeasonEpisodeCount },
  };
}

/**
 * Exportée (plutôt que privée) pour être exercée directement contre un simple
 * `new QueryClient()` en test, sans avoir à rendre le hook React
 * `useMarkWatched()` lui-même — voir `use-mark-watched.test.ts`.
 *
 * No-op (retourne `false`, ne touche rien) quand `["home-schedule", userId]`
 * n'est pas du tout en cache — ex. une session qui n'a visité que
 * `/calendar`. Le call site calendrier (`day-rail.tsx`'s `EntryCard`) n'est
 * donc jamais affecté par ce qui suit : sa propre query
 * (`calendar-timeline-episodes`) n'est ni lue ni écrite ici.
 *
 * Lecture-modification-écriture du cache volontairement SYNCHRONE (aucun
 * `await` avant le `setQueryData`) : deux taps déclenchés coup sur coup —
 * même sur DEUX épisodes différents — doivent chacun voir l'état du batch
 * déjà mis à jour par le précédent, jamais une snapshot obsolète.
 * `cancelQueries` est fire-and-forget pour la même raison.
 *
 * Prend `userId` en paramètre EXPLICITE (jamais lu depuis un état React
 * réactif) — c'est ce qui rend cette fonction, et `markWatchedOnSettled`
 * ci-dessous, immunisées par construction contre la classe de bug corrigée
 * dans ce lot (cf. `useMarkWatched` : `onMutate` fige `user.id` dans le
 * `context` renvoyé à `useMutation`, jamais relu en direct plus tard).
 */
export function markWatchedOnMutate(
  qc: QueryClient,
  userId: string,
  vars: { episodeId: number; showId: number },
): boolean {
  const homeKey = homeScheduleKey(userId);
  void qc.cancelQueries({ queryKey: homeKey });

  const prevHome = qc.getQueryData<HomeData>(homeKey);
  if (!prevHome) return false;

  const batchMap = getBatchMap(qc);
  let batch = batchMap.get(userId);
  // Nouveau burst : soit pas encore de batch, soit le précédent a
  // entièrement drainé (`inFlight` vide) — on (re)capture `base` depuis ce
  // qui est actuellement affiché, garanti d'être une donnée stabilisée à ce
  // stade (données serveur fraîches si un refetch légitime a eu le temps de
  // passer entre-temps, cf. `markWatchedOnSettled`).
  if (!batch || batch.inFlight.size === 0) {
    batch = { base: prevHome.raw, inFlight: new Map() };
    batchMap.set(userId, batch);
  }
  batch.inFlight.set(vars.episodeId, vars.showId);

  qc.setQueryData(homeKey, recomputeFromBatch(prevHome, batch));
  return true;
}

/**
 * Nettoyage unique appelé depuis `onSettled` (succès OU échec — `onSettled`
 * se déclenche exactement une fois par mutation, contrairement à
 * `onError`/`onSuccess` séparément). Retire TOUJOURS cet episodeId du
 * registre en vol ; ne recalcule/réécrit le cache que dans le cas `"error"`
 * (rollback visuel de CET épisode précisément, sans jamais toucher à ceux
 * des autres mutations encore en vol — c'est le correctif du bug de rollback
 * par snapshot). Dans le cas `"success"`, aucune réécriture : `base` précède
 * le succès de cet épisode, le recalculer à partir d'elle annulerait à tort
 * l'épisode qui vient justement de réussir — l'écriture optimiste déjà
 * affichée reste telle quelle jusqu'au refetch d'`onSettled`.
 *
 * Correctif du bug bloquant (lecture réactive de `user`) : cette fonction
 * prend `userId` en paramètre EXPLICITE, jamais relu depuis un état React —
 * elle doit être appelée avec le `userId` FIGÉ dans le `context` de
 * `onMutate` (voir `useMarkWatched`), jamais avec la valeur "live" de
 * `useAuth()` au moment où `onSettled` s'exécute. Si l'utilisateur se
 * déconnecte pendant qu'une mutation est en vol, `user` (réactif) peut
 * devenir `null` avant que ce nettoyage tourne ; le lire à cet endroit
 * sauterait le nettoyage et laisserait l'episodeId coincé dans `inFlight`
 * pour toujours — `markWatchedOnMutate` ne recapturerait alors plus jamais
 * `base`, ignorant silencieusement toute donnée arrivée par un refetch
 * légitime par la suite.
 *
 * No-op quand il n'existe aucun batch pour cet utilisateur (le
 * `markWatchedOnMutate` correspondant était lui-même un no-op, ou a déjà
 * entièrement drainé).
 */
export function markWatchedOnSettled(
  qc: QueryClient,
  userId: string,
  episodeId: number,
  outcome: "success" | "error",
): void {
  const batchMap = getBatchMap(qc);
  const batch = batchMap.get(userId);
  if (!batch) return;

  batch.inFlight.delete(episodeId);

  if (outcome === "error") {
    const homeKey = homeScheduleKey(userId);
    const cur = qc.getQueryData<HomeData>(homeKey);
    if (cur) qc.setQueryData(homeKey, recomputeFromBatch(cur, batch));
  }

  if (batch.inFlight.size === 0) batchMap.delete(userId);
}

/**
 * Mutation partagée pour marquer un épisode "vu" en 1 clic depuis la Home
 * (Reprendre / Nouveau / hero) et le calendrier (épisodes passés non vus). Ne
 * gère jamais le décochage : le clic vient d'une carte qui, par construction,
 * représente un épisode non vu — décocher passe par la fiche série.
 *
 * Optimistic UI (cf. CLAUDE.md : jamais d'attente visible sur une action de
 * tracking) : la logique de patch optimiste vit dans `markWatchedOnMutate`/
 * `markWatchedOnSettled` ci-dessus (testables directement contre un
 * `QueryClient`, sans rendre ce hook) ; cette fonction ne fait que les
 * brancher sur le cycle de vie de `useMutation`.
 *
 * `onMutate` fige `user.id` dans le `context` renvoyé à `useMutation` —
 * `onSettled` (et donc `markWatchedOnSettled`) utilise CE `userId` figé,
 * jamais une relecture réactive de `user` au moment où le callback
 * s'exécute. `query-core` appelle `onError`/`onSuccess`/`onSettled` avec les
 * dernières options du render courant, pas celles figées au `mutate()` — si
 * `user` redevenait `null` (déconnexion pendant qu'une mutation est en vol)
 * et qu'un de ces callbacks le relisait en direct pour décider d'agir, le
 * nettoyage du batch serait sauté et l'episodeId resterait coincé dans
 * `inFlight` indéfiniment (régression corrigée dans ce lot — voir
 * `markWatchedOnSettled`). Figer `userId` dans le `context` rend ce
 * nettoyage inconditionnel et indépendant de l'état d'auth au moment du
 * règlement.
 *
 * Chaque carte Home instancie son propre `useMarkWatched()` — le double-clic
 * sur UN MÊME bouton est donc déjà couvert par son propre `isPending`
 * (cf. `HeroTicket`/`ReadyListItem`/`StartCard`), sans mécanisme
 * supplémentaire nécessaire ici.
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
    onMutate: ({ episodeId, showId }): { userId: string } | undefined => {
      if (!user) return undefined;
      markWatchedOnMutate(qc, user.id, { episodeId, showId });
      return { userId: user.id };
    },
    onError: () => {
      // Le rollback visuel (retrait de l'episodeId du registre en vol +
      // recalcul du cache) vit dans `onSettled` ci-dessous, via
      // `markWatchedOnSettled(..., "error")` — pas ici, pour ne jamais
      // dépendre d'une relecture réactive de `user`. Ce callback ne garde
      // que le feedback utilisateur, indépendant de tout état d'auth.
      toast.error("Impossible de marquer l'épisode");
    },
    onSettled: (_data, err, { episodeId, showId }, ctx) => {
      if (ctx?.userId) {
        markWatchedOnSettled(qc, ctx.userId, episodeId, err ? "error" : "success");
      }
      // Réconciliation finale avec la vérité serveur, succès ou échec — Home
      // + calendrier + fiche série (le cas échéant) doivent re-render. Utilise
      // `ctx?.userId` (figé) plutôt que `user?.id` (réactif) pour la même
      // raison que `markWatchedOnSettled` ci-dessus : si `user` est devenu
      // `null` entre-temps, `user?.id` produirait une clé de query
      // `["home-schedule", undefined]` qui n'invaliderait rien du tout.
      qc.invalidateQueries({ queryKey: ["home-schedule", ctx?.userId] });
      qc.invalidateQueries({ queryKey: ["calendar-timeline-episodes", ctx?.userId] });
      qc.invalidateQueries({ queryKey: ["library", ctx?.userId] });
      qc.invalidateQueries({ queryKey: ["library-progress", ctx?.userId] });
      qc.invalidateQueries({ queryKey: ["watched", ctx?.userId, showId] });
    },
  });
}
