import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Check, Download } from "lucide-react";
import { ScreenHeader } from "@/components/screen-header";
import { useMarkWatched } from "@/hooks/use-mark-watched";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useInViewOnce } from "@/hooks/use-in-view-once";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  addDaysToDateString,
  bucketUpcoming,
  buildLastWatchedAtByShow,
  countUpcomingEntries,
  deriveHomeView,
  getTodayInTimeZone,
  groupUpcomingByDay,
  HOME_TIMEZONE,
  resolveHomeState,
  formatReadyLabel,
  seasonCountKey,
  selectNextReleases,
  selectTodayRelease,
  type ActiveStatus,
  type HomeData,
  type HomeRawInputs,
  type HomeState,
  type NextReleaseItem,
  type ReadyItem,
  type ScheduleEpisode,
} from "@/lib/schedule";
import { SITE_URL } from "@/lib/app-config";
import { ReadyListItem } from "@/components/home/ready-list-item";
import { StartRail } from "@/components/home/start-rail";
import { NextReleaseHeroCard } from "@/components/home/next-release-hero-card";
import { UpcomingBucketRails } from "@/components/home/upcoming-section";
import { DiscoverySection } from "@/components/home/discovery-section";
import {
  NoShowsPanel,
  AllCaughtUpBanner,
  NothingScheduledNotice,
} from "@/components/home/empty-states";

export const Route = createFileRoute("/_public/")({
  component: HomeScreen,
  head: () => ({
    meta: [
      { title: "tvtrackd — Suivi de séries & films en français" },
      {
        name: "description",
        content:
          "Suivez vos séries et films épisode par épisode. Calendrier des sorties, import TV Time, bibliothèque personnelle. Gratuit et sans pub.",
      },
      { property: "og:title", content: "tvtrackd — Suivi de séries & films en français" },
      {
        property: "og:description",
        content:
          "Suivez vos séries et films épisode par épisode. Calendrier, import TV Time, bibliothèque. Gratuit.",
      },
      { property: "og:url", content: `${SITE_URL}/` },
    ],
    links: [
      { rel: "canonical", href: `${SITE_URL}/` },
      {
        rel: "preload",
        as: "image",
        href: "https://image.tmdb.org/t/p/w1280/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg",
        fetchpriority: "high",
      },
    ],
  }),
});

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

/** Rows shown before "Reprendre" collapses into a "Voir tout" link. */
const REPRENDRE_VISIBLE_COUNT = 3;

/**
 * Per-state `ScreenHeader` subtitle (`children`) — the eyebrow ("Ce soir")
 * and title ("Programme") stay constant across every state (design review:
 * no "À venir"/"À jour" eyebrow variants), only this one line changes.
 * Deliberately a plain local object rather than something exported from
 * `schedule.ts` — this wording is still flagged as reversible by the design
 * review, so reverting to the old single static subtitle should stay a
 * one-file, one-block edit.
 */
const HOME_SUBTITLE_BY_STATE: Record<HomeState, string> = {
  normal: "Ce qui est prêt, et ce qui arrive ensuite.",
  upcoming_only: "Rien de prêt ce soir — voici ce qui arrive.",
  ready_only: "Vos épisodes prêts à regarder.",
  all_caught_up: "Vous êtes à jour — rien en attente.",
  no_shows: "Ajoutez des séries pour voir votre programme.",
};

function HomeScreen() {
  const { user } = useAuth();
  // The anonymous demo hero already carries its own "Créer un compte" /
  // "J'ai déjà un compte" CTAs — the header's pill would be redundant on
  // this specific screen (it stays on every other screen, e.g. /calendar).
  const hideHeaderAuthPill = !user;

  const { data, isLoading } = useQuery({
    queryKey: ["home-schedule", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<HomeData> => {
      const today = getTodayInTimeZone(new Date(), HOME_TIMEZONE);

      const { data: us } = await supabase
        .from("user_shows")
        .select("show_id, status")
        .eq("user_id", user!.id)
        .in("status", ["a_voir", "en_cours"]);

      const rows = us ?? [];
      const showStatusByShowId = new Map<number, ActiveStatus>(
        rows.map((r) => [r.show_id, r.status as ActiveStatus]),
      );
      const showIds = rows.map((r) => r.show_id);

      if (!showIds.length) {
        return {
          today,
          followedActiveCount: 0,
          hero: null,
          heroProgress: null,
          reprendre: [],
          reprendreProgressByShowId: new Map(),
          nouveau: [],
          readyCount: 0,
          dayGroups: [],
          upcomingCount: 0,
          nextReleases: [],
          todayRelease: null,
          raw: {
            episodes: [],
            showStatusByShowId: new Map(),
            lastWatchedAtByShowId: new Map(),
            watchedEpisodeIds: new Set(),
            heroSeasonEpisodeCount: null,
            reprendreSeasonEpisodeCounts: new Map(),
          },
        };
      }

      // No lower bound on the past — a followed show can be arbitrarily late.
      const future = addDaysToDateString(today, 90);

      // The `episodes` fetch and the recency query below are independent of
      // each other (neither's inputs depend on the other's output — both
      // only need `showIds`), so they run in parallel rather than as a
      // waterfall. The `watched_status` (readiness) query further down still
      // has to wait on `episodes` (it needs `epIds`), so it stays sequential.
      const [{ data: eps }, { data: recencyRows }] = await Promise.all([
        supabase
          .from("episodes")
          .select(
            "id, season_number, episode_number, title, air_date, still_path, show:shows!inner(id, tmdb_id, media_type, title, poster_path, backdrop_path)",
          )
          .in("show_id", showIds)
          .not("air_date", "is", null)
          .lte("air_date", future)
          .order("air_date", { ascending: true }),
        // Dedicated recency query for `selectHero`'s hero/Reprendre freshness
        // signal — deliberately NOT derived from `episodes`/`watched` below,
        // which are scoped to `air_date IS NOT NULL` (needed for scheduling,
        // irrelevant here): a watched episode with no cached air_date (common
        // right after a CSV/Betaseries import with no per-episode dates) would
        // otherwise be invisible to the recency signal, making a show watched
        // yesterday look dormant. Joins straight to `episodes.show_id` so
        // this is filtered server-side by show id — the response itself is
        // one row per *watched* episode of a followed show (bounded by the
        // user's total watch history on followed shows, not by how many
        // shows they follow), same order of magnitude as the `watched` query
        // below, not a "potentially huge episode-id list" cost.
        supabase
          .from("watch_status")
          .select("watched_at, episode:episodes!inner(show_id)")
          .eq("user_id", user!.id)
          .in("episode.show_id", showIds),
      ]);

      const episodes = (eps ?? []) as unknown as ScheduleEpisode[];
      const epIds = episodes.map((e) => e.id);
      const { data: watched } = epIds.length
        ? await supabase
            .from("watch_status")
            .select("episode_id")
            .eq("user_id", user!.id)
            .in("episode_id", epIds)
        : { data: [] };
      const watchedSet = new Set((watched ?? []).map((w) => w.episode_id));

      const lastWatchedAtByShowId = buildLastWatchedAtByShow(
        (
          (recencyRows ?? []) as unknown as { watched_at: string; episode: { show_id: number } }[]
        ).map((r) => ({ show_id: r.episode.show_id, watched_at: r.watched_at })),
      );

      // `reprendreDormant` isn't consumed by the UI this lot — dormant shows
      // are only reachable through /library — but the split itself already
      // shapes `reprendre` (active-only, capped to 3 + "Voir tout").
      //
      // First pass without the hero's/Reprendre rows' official season
      // episode counts (not known yet — depend on which show wins hero and
      // which shows land in the visible "Reprendre" rows, both computed just
      // below). `hero`/`reprendre`/`nouveau`/`readyCount` are already final
      // at this point (none of them depend on the season-count maps); only
      // `heroProgress`/`reprendreProgressByShowId` are discarded and
      // recomputed in the second pass below.
      const rawWithoutSeasonCounts = {
        episodes,
        showStatusByShowId,
        lastWatchedAtByShowId,
        watchedEpisodeIds: watchedSet,
        heroSeasonEpisodeCount: null,
        reprendreSeasonEpisodeCounts: new Map<string, number>(),
      };
      const { hero, reprendre, nouveau, readyCount } = deriveHomeView(
        rawWithoutSeasonCounts,
        today,
      );

      // Only the rows actually rendered under "Reprendre" (REPRENDRE_VISIBLE_COUNT,
      // see HomeContent) need a season-count fetch — the rest of `reprendre`
      // is only ever reached through /library, which computes its own
      // progress independently (`buildLibraryProgress`, unbounded episodes
      // fetch, no reliability guard needed there).
      const reprendreVisible = reprendre.slice(0, REPRENDRE_VISIBLE_COUNT);
      const reprendreShowIds = [...new Set(reprendreVisible.map((item) => item.show.id))];

      // Both lookups are independent single-purpose reads of the `seasons`
      // cache (hero's own season vs. each visible Reprendre row's own
      // season) — run in parallel rather than as a waterfall, same reasoning
      // as the `episodes`/`recencyRows` pair above. PostgREST has no
      // composite-tuple `IN` filter, so the Reprendre lookup fetches every
      // season row for the (small, <=3) set of show ids and filters to the
      // exact (show, season) pairs needed client-side — cheap at this scale.
      const [heroSeasonRes, reprendreSeasonsRes] = await Promise.all([
        hero
          ? supabase
              .from("seasons")
              .select("episode_count")
              .eq("show_id", hero.show.id)
              .eq("season_number", hero.nextEpisode.season_number)
              .maybeSingle()
          : Promise.resolve({ data: null as { episode_count: number | null } | null }),
        reprendreShowIds.length
          ? supabase
              .from("seasons")
              .select("show_id, season_number, episode_count")
              .in("show_id", reprendreShowIds)
          : Promise.resolve({
              data: [] as {
                show_id: number;
                season_number: number;
                episode_count: number | null;
              }[],
            }),
      ]);

      // One cheap single-row lookup (unique-indexed on show_id+season_number)
      // for the hero's own season only — never for every followed show —
      // to know the season's OFFICIAL episode count and confirm the tally
      // isn't undercounted by the 90-day future cap above. See
      // `isSeasonTallyReliable` for why an unreliable tally hides the
      // fraction/bar entirely rather than risking a falsely-~100% bar.
      const heroSeasonEpisodeCount = heroSeasonRes.data?.episode_count ?? null;

      const neededReprendreKeys = new Set(
        reprendreVisible.map((item) =>
          seasonCountKey(item.show.id, item.nextEpisode.season_number),
        ),
      );
      const reprendreSeasonEpisodeCounts = new Map<string, number>(
        (reprendreSeasonsRes.data ?? [])
          .filter(
            (row): row is { show_id: number; season_number: number; episode_count: number } =>
              row.episode_count != null &&
              neededReprendreKeys.has(seasonCountKey(row.show_id, row.season_number)),
          )
          .map((row): [string, number] => [
            seasonCountKey(row.show_id, row.season_number),
            row.episode_count,
          ]),
      );

      const raw: HomeRawInputs = {
        ...rawWithoutSeasonCounts,
        heroSeasonEpisodeCount,
        reprendreSeasonEpisodeCounts,
      };
      const { heroProgress, reprendreProgressByShowId } = deriveHomeView(raw, today);

      const dayGroups = groupUpcomingByDay(episodes, today, 90);
      const upcomingCount = countUpcomingEntries(dayGroups);

      // Single "Sort aujourd'hui" spotlight pick — see `selectTodayRelease`'s
      // doc comment (schedule.ts). Excludes the hero's own show, same
      // reasoning as `nextReleases` below: the hero already dominates that
      // show's slot as "à voir maintenant".
      const todayRelease = selectTodayRelease(
        episodes,
        watchedSet,
        showStatusByShowId,
        lastWatchedAtByShowId,
        today,
        { excludeShowIds: hero ? new Set([hero.show.id]) : undefined },
      );

      // Un seul item "Bientôt" (grand format), quel que soit l'état (design
      // review — plus de liste compacte de secours en dessous) : le reste
      // des sorties à venir reste couvert par le rail "Programme à venir"
      // plus bas, aucune donnée perdue, juste un teaser réduit à 1 carte.
      // Excludes the hero's own show — it already dominates that show's
      // slot as "à voir maintenant"; repeating it here as "Nj" would read as
      // redundant rather than as a genuinely different upcoming release.
      // Also excludes `todayRelease`'s own show — mutual exclusion between
      // "Sort aujourd'hui" and "Bientôt": that show's next release is either
      // today's own episode (already spotlighted) or, if it has a LATER
      // future episode too, still the same show/story already highlighted
      // above — never repeated here as a second, separate "Bientôt" card.
      // `hero` is always null in `upcoming_only` (readyCount 0), and
      // `todayRelease` is always null there too (an episode airing today is
      // always `readyCount`-eligible, see `selectTodayRelease`'s doc
      // comment) — both naturally become `undefined`/empty there, no
      // special-casing needed. See `selectNextReleases`'s doc comment.
      const nextReleasesExcludeShowIds = new Set<number>();
      if (hero) nextReleasesExcludeShowIds.add(hero.show.id);
      if (todayRelease) nextReleasesExcludeShowIds.add(todayRelease.show.id);
      const nextReleases = selectNextReleases(dayGroups, today, {
        limit: 1,
        excludeShowIds: nextReleasesExcludeShowIds.size ? nextReleasesExcludeShowIds : undefined,
      });

      return {
        today,
        followedActiveCount: showIds.length,
        hero,
        heroProgress,
        reprendre,
        reprendreProgressByShowId,
        nouveau,
        readyCount,
        dayGroups,
        upcomingCount,
        nextReleases,
        todayRelease,
        raw,
      };
    },
  });

  // Computed here (not lifted from `HomeContent`, which needs it too) so the
  // subtitle and the "À découvrir" eyebrow below can react to the actual
  // state without prop-drilling — `resolveHomeState` is pure and cheap, a
  // second call is preferable to state lifting for a header-only concern.
  // `null` while signed out or still loading — the anonymous screen has its
  // own messaging (`AnonymousHome`) and a mid-fetch state has no resolved
  // state yet, so both keep the previous static subtitle as a sensible
  // default rather than guessing.
  const state: HomeState | null = data
    ? resolveHomeState({
        followedActiveCount: data.followedActiveCount,
        readyCount: data.readyCount,
        upcomingCount: data.upcomingCount,
      })
    : null;
  const subtitle = state
    ? HOME_SUBTITLE_BY_STATE[state]
    : "Vos prochaines diffusions, en un coup d'œil.";

  return (
    <>
      <ScreenHeader eyebrow="Ce soir" title="Programme" hideAuthPill={hideHeaderAuthPill}>
        {subtitle}
      </ScreenHeader>

      {!user ? (
        <AnonymousHome />
      ) : isLoading || !data ? (
        <div className="mx-5 h-40 animate-pulse rounded-xl bg-card" />
      ) : (
        <HomeContent data={data} />
      )}

      {/* Découverte — un seul encart, à un emplacement fixe, quel que soit
          l'état de la Home. Eyebrow "À découvrir" ajouté UNIQUEMENT pour
          no_shows/all_caught_up : dans ces deux états, ce rail EST le
          contenu principal restant sur l'écran (Zone A/B est vide ou quasi),
          il mérite un titre — dans tous les autres états, il reste un
          post-scriptum sans en-tête, comme avant. Pas de "raison"
          personnalisée : ce rail reste le contenu TMDb générique existant
          (Tendances/Nouvelles sorties), seulement relabellisé honnêtement —
          voir la note du plan sur l'absence de moteur de recommandation. */}
      <div className="mx-5 mt-8">
        {(state === "no_shows" || state === "all_caught_up") && (
          <p className="mb-3 font-display text-xl font-bold text-foreground">À découvrir</p>
        )}
        <DiscoverySection variant="compact" />
      </div>
    </>
  );
}

/**
 * Fixed editorial show used only to render the demo hero below — never a
 * fetch, so the anonymous screen has zero dependency on user data. Shaped as
 * a `ReadyItem` so it can go straight through `HeroTicket` unmodified; ids
 * are arbitrary placeholders (never persisted, never navigated to since the
 * demo hero renders `interactive={false}`).
 */
const DEMO_HERO_ITEM: ReadyItem = {
  show: {
    id: 0,
    tmdb_id: 1396,
    media_type: "tv",
    title: "Breaking Bad",
    poster_path: "https://image.tmdb.org/t/p/w500/hVVxgGZFR3JaXmkstnG1IR9Qbt6.jpg",
    backdrop_path: "https://image.tmdb.org/t/p/w1280/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg",
  },
  status: "en_cours",
  episodes: [],
  nextEpisode: {
    id: 0,
    season_number: 2,
    episode_number: 4,
    title: "Down",
    air_date: null,
    show: {
      id: 0,
      tmdb_id: 1396,
      media_type: "tv",
      title: "Breaking Bad",
      poster_path: "https://image.tmdb.org/t/p/w500/hVVxgGZFR3JaXmkstnG1IR9Qbt6.jpg",
      backdrop_path: "https://image.tmdb.org/t/p/w1280/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg",
    },
  },
  extraCount: 0,
  earliestAirDate: "",
  isLate: false,
  lateDays: 0,
};

function AnonymousHome() {
  // Animate the hero ticket's bump once on mount, purely for demo effect —
  // reuses HeroTicket's own bump/tween effect (triggered by a `progress.watched`
  // prop change, the same "compteur mécanique" logic as `VhsCounter`'s bump,
  // duplicated locally in HeroTicket rather than routed through the shared
  // `VhsCounter` component — see D2/the "hero" variant removal note in
  // vhs-counter.tsx), not a new animation mechanism.
  const [demoWatched, setDemoWatched] = useState(2);
  useEffect(() => {
    const id = setTimeout(() => setDemoWatched(3), 600);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="mx-5">
      <HeroTicket
        item={DEMO_HERO_ITEM}
        interactive={false}
        badge={{ label: "Exemple", className: "text-cyan-accent" }}
        progress={{ watched: demoWatched, total: 8 }}
      />

      {/* Carte "portabilité" — différenciateur n°1 (CLAUDE.md, jobs-to-be-done
          #2 "mémoire durable") : reprend le vocabulaire "carte fine" déjà
          validé sur la fiche série (ProgressCard/NextEpisodeCard), y compris
          le pattern micro-ligne séparée par un filet. Statique, sans
          useInViewOnce — la seule animation de cet écran reste le bump du
          HeroTicket démo ci-dessus. */}
      <div className="mt-5 rounded-2xl border border-white/[0.07] bg-white/[0.018] p-[18px]">
        <p className="font-counter text-[10px] uppercase tracking-[0.24em] text-primary">
          Mémoire durable
        </p>
        <h2 className="mt-2 font-display text-lg leading-snug text-foreground">
          Votre historique vous suit, pour toujours.
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Export complet disponible à tout moment, dès votre première série ajoutée — jamais en
          dernier recours.
        </p>
        <div className="mt-3.5 flex items-center gap-2 border-t border-white/[0.06] pt-3.5 text-xs text-muted-foreground">
          <Download className="h-3.5 w-3.5 shrink-0 text-cyan-accent" aria-hidden="true" />
          Exportez tout, quand vous voulez — format JSON.
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2">
        <Link
          to="/auth"
          search={{ mode: "signup" }}
          className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground"
        >
          Créer un compte
        </Link>
        <Link
          to="/auth"
          search={{ mode: "signin" }}
          className="inline-flex h-11 items-center justify-center rounded-md border border-border px-5 text-sm font-medium text-foreground"
        >
          J'ai déjà un compte
        </Link>
      </div>

      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        Vous arrivez de TV Time ou Betaseries ? Votre import démarre juste après l'inscription.
      </p>
      <Link
        to="/alternative-tv-time"
        hash="exporter-vos-donnees"
        className="mt-1 block text-center text-[11px] font-medium text-primary hover:underline"
      >
        → Comment récupérer vos données TV Time
      </Link>
    </div>
  );
}

/**
 * (§1 design review — "Reprendre" reflow polish, fallback path) Tracks which
 * visible "Reprendre" rows just left `items` (promoted to hero — Direction
 * A, see `selectHero`'s doc comment in schedule.ts — or otherwise dropped
 * out of the top `REPRENDRE_VISIBLE_COUNT`) so they can fade out over
 * ~200ms instead of vanishing instantly while the remaining rows snap up to
 * fill the gap.
 *
 * View Transitions (`document.startViewTransition`) were the design
 * review's preferred approach, but are deliberately NOT wired here —
 * verified against the actually-installed `@tanstack/query-core` (v5.101)
 * source: its `notifyManager` schedules cache-change notifications via
 * `setTimeout(cb, 0)` (`notifyManager.ts` -> `timeoutManager.ts`'s
 * `systemSetTimeoutZero`), a macrotask, never synchronous and not even
 * microtask-scheduled. `startViewTransition(callback)` requires the DOM
 * mutation to happen synchronously inside `callback` (or its returned
 * promise) to correctly snapshot "before"/"after"; `flushSync` can only
 * force-flush REACT updates that occur synchronously within ITS OWN
 * callback — it structurally cannot reach a `setTimeout(0)`-deferred
 * notification arriving later, so `startViewTransition(() =>
 * flushSync(() => markWatched.mutate(...)))` would silently fail to capture
 * the actual DOM change. Fixing this properly would mean either a global
 * change to React Query's notification scheduler (app-wide blast radius,
 * not justified for one visual polish) or restructuring this specific
 * optimistic path to bypass `useQuery`'s async notification entirely — both
 * too invasive for what the design review itself flagged as non-blocking.
 * Falling back to a plain CSS opacity fade instead, as explicitly
 * authorized for this case.
 *
 * Departure is detected DURING RENDER (not in a `useEffect`), by comparing
 * against a ref of the previous `items` — this is what lets the very FIRST
 * render that excludes a departed show ALREADY include it in the merged
 * output as "leaving", so its row's DOM node/key is never actually
 * unmounted-then-remounted (which would defeat the CSS transition: a
 * freshly-mounted node can't visibly animate FROM a style it never had).
 * Calling `setState` during render like this is the documented React
 * pattern for "adjust state in response to a prop change without an
 * Effect" — React discards and re-runs the current render before
 * committing, so the actually-committed output already reflects it. A
 * `useEffect` only handles the delayed cleanup (dropping it from state once
 * the fade has had time to finish). Skips entirely under
 * `prefers-reduced-motion` (`skipAnimation`) — rows are then added/removed
 * exactly as before this change, no transient state at all.
 */
function useReprendreRows(
  items: ReadyItem[],
  skipAnimation: boolean,
): { item: ReadyItem; leaving: boolean }[] {
  const prevItemsRef = useRef<ReadyItem[]>(items);
  const [leavingSnapshot, setLeavingSnapshot] = useState<ReadyItem[]>([]);

  const currentIds = new Set(items.map((i) => i.show.id));
  const justDeparted = skipAnimation
    ? []
    : prevItemsRef.current.filter((i) => !currentIds.has(i.show.id));
  if (justDeparted.length) {
    const departedIds = new Set(justDeparted.map((i) => i.show.id));
    setLeavingSnapshot((cur) => [
      ...cur.filter((i) => !departedIds.has(i.show.id)),
      ...justDeparted,
    ]);
  }
  prevItemsRef.current = items;

  useEffect(() => {
    if (!leavingSnapshot.length) return;
    // ~220ms — just past the 200ms CSS fade (`duration-200`, the same
    // duration HeroTicket's own bump animation already uses for its
    // scale/flash timeout above — reused, not a new value) so the
    // transition has fully finished before the row is actually dropped.
    const timeoutId = setTimeout(() => setLeavingSnapshot([]), 220);
    return () => clearTimeout(timeoutId);
  }, [leavingSnapshot]);

  if (!leavingSnapshot.length) {
    return items.map((item) => ({ item, leaving: false }));
  }
  const stillLeaving = leavingSnapshot.filter((i) => !currentIds.has(i.show.id));
  return [
    ...stillLeaving.map((item) => ({ item, leaving: true })),
    ...items.map((item) => ({ item, leaving: false })),
  ];
}

function HomeContent({ data }: { data: HomeData }) {
  const state = resolveHomeState({
    followedActiveCount: data.followedActiveCount,
    readyCount: data.readyCount,
    upcomingCount: data.upcomingCount,
  });

  const prefersReducedMotion = useReducedMotion();

  /**
   * (§5 a11y fix — design review) Focus/announcement recovery when an
   * optimistic mark-watched tap causes the hero to rotate to a DIFFERENT
   * show — either because a "Reprendre" row got promoted (Direction A) or
   * because the CURRENT hero's own last ready episode just got marked
   * watched and it rotated away to someone else (`hero.show.id` changes
   * either way). Either case, the exact button the user just clicked can be
   * removed from the DOM by React's reconciliation once its row/card no
   * longer renders — the browser's default behavior is to silently drop
   * focus to `<body>`.
   *
   * Deliberately does NOT diff `data.hero?.show.id` across renders to
   * detect "a rotation happened" — that would also fire on an unrelated
   * background refetch (e.g. `refetchOnWindowFocus`) that happens to land a
   * different hero, which would steal focus/announce for something the
   * user didn't just do. Instead, `lastTappedButtonRef` remembers the EXACT
   * button element clicked (set by `handleMarkWatchedTap`, passed as `onTap`
   * to both `HeroTicket` and `ReadyListItem`); the effect below only acts
   * when THAT SPECIFIC element has been removed from the document AND focus
   * genuinely fell back to `<body>` (not deliberately moved elsewhere by the
   * user in the meantime) — a precise, tap-scoped signal that naturally
   * no-ops for "tapped the current hero, no rotation" (its button persists,
   * same DOM node, nothing to recover) without needing to special-case it.
   *
   * Known simplification: only the LAST tapped button is tracked (a plain
   * ref, not a set) — a rapid double-tap on two DIFFERENT rows in the same
   * optimistic batch (see the `[scenario A/B]` tests in
   * use-mark-watched.test.ts) could miss recovering focus for the first one
   * if the second overwrites the ref before the effect runs. Accepted as a
   * rare edge case, same category as the other documented "transient,
   * self-correcting" limits around this optimistic batching (see
   * `recomputeFromBatch` in use-mark-watched.ts).
   */
  const lastTappedButtonRef = useRef<HTMLButtonElement | null>(null);
  const heroButtonRef = useRef<HTMLButtonElement | null>(null);
  const zoneAFallbackRef = useRef<HTMLDivElement | null>(null);
  const [rotationAnnouncement, setRotationAnnouncement] = useState("");

  const handleMarkWatchedTap = (button: HTMLButtonElement) => {
    lastTappedButtonRef.current = button;
  };

  // Runs after EVERY commit (no dep array) — the check itself is a cheap
  // `document.body.contains`, and it only ever does anything (focus a node,
  // set the announcement) when `lastTappedButtonRef.current` is non-null,
  // which only happens right after a genuine tap. Refs on the newly-mounted
  // hero (`heroButtonRef`) are guaranteed populated by the time THIS effect
  // runs — React attaches every ref in a commit before firing any passive
  // effect for that commit, so a plain `useEffect` here is sufficient; no
  // `flushSync` needed (that tool is for forcing synchronous DOM output for
  // something OUTSIDE React's own effect ordering, e.g. View Transitions —
  // see `useReprendreRows`'s doc comment above for why that doesn't apply
  // here).
  //
  // Deliberately NOT `[data.hero]` (the eslint auto-fix suggestion) — a
  // "Reprendre" row can also lose its tapped button when its OWN backlog
  // clears entirely (no ready episode left at all), which drops it out of
  // `data.reprendre` WITHOUT `data.hero`'s reference ever changing; a
  // `[data.hero]` dep would silently miss recovering focus for that case.
  // No infinite-loop risk either: `lastTappedButtonRef.current` is
  // consumed (set back to `null`) on the very same run that acts on it, so
  // the guard clause makes every subsequent run with a stale/absent ref a
  // no-op regardless of how often this effect re-fires.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const tappedButton = lastTappedButtonRef.current;
    if (!tappedButton) return;
    if (document.body.contains(tappedButton)) return; // no rotation — still there, nothing to recover
    lastTappedButtonRef.current = null; // consume — never re-trigger for this same tap again

    const active = document.activeElement;
    if (active && active !== document.body) return; // something else already handled focus — don't steal it

    const target = heroButtonRef.current ?? zoneAFallbackRef.current;
    target?.focus();

    if (data.hero) {
      setRotationAnnouncement(`${data.hero.show.title} passé en haut de votre programme.`);
    }
  });

  // (§1 fallback, see `useReprendreRows` above) Called unconditionally on
  // every render regardless of `state` — Rules of Hooks — `data.reprendre`
  // is always `[]` in states that never render it (no_shows/upcoming_only/
  // all_caught_up), so this is a harmless no-op there.
  const reprendreRows = useReprendreRows(
    data.reprendre.slice(0, REPRENDRE_VISIBLE_COUNT),
    prefersReducedMotion,
  );

  if (state === "no_shows") {
    return <NoShowsPanel />;
  }

  if (state === "all_caught_up") {
    return <AllCaughtUpBanner />;
  }

  const buckets = bucketUpcoming(data.dayGroups, data.today);

  if (state === "upcoming_only") {
    // No hero/backlog at all in this state — the "Bientôt" block (same
    // shared gabarit as in `normal`, same single-item limit) IS the
    // primary content at the top of the screen.
    return (
      <>
        <div className="mx-5">
          <NextReleasesBlock items={data.nextReleases} />
        </div>
        <div className="mt-8 space-y-6 px-5">
          <UpcomingSectionHeader />
          <UpcomingRails buckets={buckets} today={data.today} />
        </div>
      </>
    );
  }

  // "ready_only" or "normal": Zone A renders the hero ticket + compact lists.
  return (
    <>
      {/* (§5 a11y fix) Visually hidden live region — announces a hero
          promotion right after a tap causes one (see the effect above).
          Empty on mount and on any unrelated render; only a genuine,
          tap-triggered rotation ever sets it, and only ONCE per rotation
          (the effect clears `lastTappedButtonRef` right after consuming
          it), so it never re-announces on the later server-confirmed
          refetch of the same rotation. */}
      <div aria-live="polite" className="sr-only">
        {rotationAnnouncement}
      </div>

      {/* Zone A — À voir maintenant. `tabIndex={-1}` + the ref: fallback
          focus target for the §5 recovery effect above, only ever used if
          `heroButtonRef` itself somehow isn't populated (defensive — in
          practice the hero button is always present right after a
          promotion, since a promotion by definition means there IS a new
          hero). Not part of the natural Tab order (-1), purely a
          programmatic anchor. */}
      <div ref={zoneAFallbackRef} tabIndex={-1} className="mx-5">
        {data.hero && (
          // `key` on show id + season number: forces a fresh mount (so
          // HeroTicket's local bump/tween state resets instantly) not only
          // when the hero rotates to a different show, but also when the
          // SAME show's hero moves to its next season (e.g. marking the
          // season finale watched from the hero button) — `heroProgress`
          // resets to a smaller watched/total pair in that case, and without
          // the season in the key, the tween would animate a misleading
          // countdown (full bar -> emptying) right as the S/E label already
          // shows the new season. See also HeroTicket's own defensive guard
          // for the same scenario, in case this key ever fails to change.
          <HeroTicket
            key={`${data.hero.show.id}-${data.hero.nextEpisode.season_number}`}
            item={data.hero}
            progress={data.heroProgress ?? undefined}
            onTap={handleMarkWatchedTap}
            markButtonRef={heroButtonRef}
          />
        )}

        {data.reprendre.length > 0 && (
          <div className="mt-5">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
              <p className="font-display text-xl font-bold text-foreground">Reprendre</p>
              {/* "Reprendre" is capped to 3 visible rows — the rest is only
                  reachable through the library, filtered on the en_cours tab
                  via the shared status search-param (see library.tsx).
                  Deliberately worded "+N actives" rather than "+N à
                  reprendre": the count here only ever includes active
                  (<30j) shows (never the dormant ones, by design — see
                  `selectHero`'s LIST_STALE_DAYS split), but the destination
                  /library?status=en_cours tab shows EVERY en_cours show
                  (hero + active + dormant + not-yet-ready ones too) — a
                  strictly larger set. Naming the badge "actives" sets the
                  right expectation instead of implying it previews the
                  library tab's exact count. `flex-wrap` + shorter wording
                  both guard against this row overflowing on narrow (~360px)
                  viewports. */}
              {data.reprendre.length > REPRENDRE_VISIBLE_COUNT && (
                <Link
                  to="/library"
                  search={{ status: "en_cours" }}
                  className="font-counter text-[10px] uppercase tracking-widest text-primary"
                >
                  Voir tout · +{data.reprendre.length - REPRENDRE_VISIBLE_COUNT} actives ›
                </Link>
              )}
            </div>
            <div className="space-y-2">
              {/* (§1 fallback — see `useReprendreRows` above) Each row is
                  wrapped in a persistent div (present, same key, whether
                  `leaving` or not) so a departing row's opacity genuinely
                  TRANSITIONS on an existing DOM node rather than mounting
                  already-faded — a fresh mount can't visibly animate FROM a
                  style it never had. */}
              {reprendreRows.map(({ item, leaving }) => (
                <div
                  key={item.show.id}
                  aria-hidden={leaving ? true : undefined}
                  className={`transition-opacity duration-200 ease-out motion-reduce:transition-none ${
                    leaving ? "pointer-events-none opacity-0" : "opacity-100"
                  }`}
                >
                  <ReadyListItem
                    item={item}
                    progress={data.reprendreProgressByShowId.get(item.show.id)}
                    onTap={handleMarkWatchedTap}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bloc "Sort aujourd'hui" — spotlight (voir `selectTodayRelease`,
            schedule.ts). Pas de garde sur `state` : structurellement non-null
            uniquement en `normal`/`ready_only` (un épisode du jour est
            toujours `readyCount`-éligible, jamais possible en `upcoming_only`/
            `all_caught_up`/`no_shows`), donc `data.todayRelease` seul suffit
            à gater ce bloc. Placé juste après "Reprendre" et avant "Bientôt"
            (ordre validé : Hero → Reprendre → Sort aujourd'hui → Bientôt →
            Programme à venir → À commencer). */}
        {data.todayRelease && (
          <div className="mt-5">
            <TodayReleaseBlock item={data.todayRelease} />
          </div>
        )}

        {/* Bloc "Bientôt" — UNIQUEMENT en état `normal` (backlog ET sortie
            future connues, cf. resolveHomeState) : `upcoming_only` rend son
            propre bloc "Bientôt" plus haut dans ce fichier (même gabarit
            partagé) et `ready_only` n'a par construction aucune entrée à
            afficher ici (upcomingCount === 0 => dayGroups vide =>
            nextReleases vide). Placé juste après "Reprendre"/"Sort
            aujourd'hui" (ordre validé en état `normal` : Hero → Reprendre →
            Sort aujourd'hui → Bientôt → Programme à venir → À commencer,
            cf. plus bas — "À commencer" n'est plus dans cette Zone A, voir
            la note sur son nouvel emplacement). */}
        {state === "normal" && data.nextReleases.length > 0 && (
          <div className="mt-5">
            <NextReleasesBlock items={data.nextReleases} />
          </div>
        )}
      </div>

      {/* Zone B — Programme à venir */}
      <div className="mt-8 space-y-6 px-5">
        <UpcomingSectionHeader />
        {state === "ready_only" ? (
          <NothingScheduledNotice />
        ) : (
          <UpcomingRails buckets={buckets} today={data.today} />
        )}
      </div>

      {/* "À commencer" — déplacé hors de la Zone A ("à voir maintenant"),
          en premier rail de la zone recommandations, juste après "Programme
          à venir" et avant l'eyebrow "À découvrir"/`DiscoverySection` rendu
          par le parent (`HomeScreen`, juste après `HomeContent` dans le
          DOM — cf. son propre commentaire). Ordre validé (design review) :
          Hero → Reprendre → Bientôt → Programme à venir → À commencer → À
          découvrir. Garde sa condition d'affichage d'origine (uniquement
          si `data.nouveau` a des items). S'applique aux DEUX états qui
          partagent ce retour (`normal` ET `ready_only`) : `ready_only` n'a
          ni Bientôt ni de sorties programmées (Zone B y affiche
          `NothingScheduledNotice`), donc "À commencer" y atterrit
          directement après le contenu principal (Hero + Reprendre) et la
          notice "rien de prévu" — toujours en tête de la zone recos, jamais
          mélangé à la Zone A, cohérent avec le nouvel ordre. */}
      {data.nouveau.length > 0 && (
        <div className="mt-8 px-5">
          <p className="mb-2 font-display text-xl font-bold text-foreground">À commencer</p>
          <StartRail items={data.nouveau} />
        </div>
      )}
    </>
  );
}

/**
 * "Bientôt" block — UN SEUL item, toujours en grand format
 * (`NextReleaseHeroCard`), sous un en-tête de section "Bientôt" (Archivo).
 * Design review : plus de liste compacte en dessous (l'ancien rang #2+ en
 * format `NextReleaseCard`) — `selectNextReleases` est appelé avec
 * `limit: 1` (voir `HomeScreen`'s queryFn), donc `items` ne contient jamais
 * plus d'un élément ; le reste des sorties à venir reste couvert par le
 * rail "Programme à venir" plus bas. Même rendu dans `HomeContent`'s
 * `normal` et `upcoming_only` branches — pas de distinction entre les deux
 * call sites.
 */
function NextReleasesBlock({ items }: { items: NextReleaseItem[] }) {
  const item = items[0];
  if (!item) return null;

  return (
    <div>
      <p className="mb-2 font-display text-xl font-bold text-foreground">Bientôt</p>
      <NextReleaseHeroCard item={item} />
    </div>
  );
}

/**
 * "Sort aujourd'hui" block — single spotlight card (`NextReleaseHeroCard`,
 * `variant="today"`) under its own "Sort aujourd'hui" header (same style as
 * "Reprendre"/"Bientôt"). See `selectTodayRelease` (schedule.ts) for the
 * selection/ranking rule and `HomeContent`'s call site for why this needs no
 * additional `state` guard beyond `data.todayRelease` itself.
 */
function TodayReleaseBlock({ item }: { item: NextReleaseItem }) {
  return (
    <div>
      <p className="mb-2 font-display text-xl font-bold text-foreground">Sort aujourd'hui</p>
      <NextReleaseHeroCard item={item} variant="today" />
    </div>
  );
}

function UpcomingRails({
  buckets,
  today,
}: {
  buckets: ReturnType<typeof bucketUpcoming>;
  today: string;
}) {
  return (
    <>
      <UpcomingBucketRails label="Demain" groups={buckets.demain} today={today} saturated={false} />
      <UpcomingBucketRails
        label="Cette semaine"
        groups={buckets.cetteSemaine}
        today={today}
        saturated={false}
        truncatePerGroup={4}
      />
      <UpcomingBucketRails
        label="Plus tard"
        groups={buckets.plusTard}
        today={today}
        saturated={false}
        truncatePerGroup={3}
        maxGroups={2}
      />
    </>
  );
}

function UpcomingSectionHeader() {
  return (
    <div className="flex items-baseline justify-between">
      {/* `font-display text-xl font-bold`, sans uppercase/tracking-widest —
          style "Netflix" (Lovable) désormais partagé par tous les en-têtes
          de section de la home ("Reprendre"/"Bientôt"/"À commencer"/
          "Programme à venir"/l'eyebrow "À découvrir") pour un palier visuel
          homogène — Archivo pleine opacité plutôt que la famille eyebrow
          mono (font-counter), désormais réservée aux libellés secondaires
          (badges, "Voir tout ›", compteurs). `font-bold` explicite sur
          chacun (pas seulement hérité de la balise `<h2>`) : les en-têtes
          en `<p>` ("Reprendre"/"Bientôt"/"À commencer") doivent afficher
          exactement le même poids que celui-ci pour rester au même palier.
          Les <h3> "Demain"/"Cette semaine"/"Plus tard" (upcoming-section.tsx)
          restent inchangés (hors périmètre de cette révision, qui liste
          explicitement les en-têtes de section concernés). */}
      <h2 className="font-display text-xl font-bold text-foreground">Programme à venir</h2>
      <Link
        to="/calendar"
        className="font-counter text-[10px] uppercase tracking-widest text-primary"
      >
        Voir tout ›
      </Link>
    </div>
  );
}

function HeroTicket({
  item,
  badge,
  interactive = true,
  progress,
  onTap,
  markButtonRef,
}: {
  item: ReadyItem;
  /** Overrides the default `formatReadyLabel` eyebrow — used by the anonymous demo hero's "Exemple" badge. */
  badge?: { label: string; className?: string };
  /** `false` renders a static `div` instead of a `Link` — the anonymous demo hero isn't navigable. */
  interactive?: boolean;
  /**
   * Season watched/total fraction. The anonymous demo hero supplies a
   * fabricated pair (to demonstrate the bump animation); the real,
   * signed-in hero supplies `heroProgress`, computed via `computeSeasonTally`
   * (see `HomeScreen`'s queryFn) from data already fetched for the Home
   * schedule — no extra request. Left `undefined` only when there's no hero
   * at all (nothing to compute a tally for); a real hero always has at
   * least its own `nextEpisode` in that season, so `total` is never 0 once
   * `progress` is supplied.
   */
  progress?: { watched: number; total: number };
  /**
   * (§5 a11y fix — design review) See `ReadyListItem`'s own `onTap` doc
   * comment — same mechanism, reported from the hero's OWN "Marquer comme
   * vu" button. Undefined for the anonymous demo hero (`interactive=false`,
   * no button rendered at all).
   */
  onTap?: (button: HTMLButtonElement) => void;
  /**
   * (§5 a11y fix) Ref attached to the button so `HomeContent`'s post-commit
   * effect can `.focus()` it once a NEW hero (after a rotation) has
   * mounted. Refs attach during React's commit phase, before any
   * `useEffect` runs — a plain effect in the parent is enough, no
   * `flushSync` needed (verified: this is the "ref + effect" pattern the
   * design review itself suggested as the safe option).
   */
  markButtonRef?: React.Ref<HTMLButtonElement>;
}) {
  const { show, nextEpisode } = item;
  const backdropUrl = nextEpisode.still_path ?? show.backdrop_path ?? show.poster_path;
  const markWatched = useMarkWatched();
  // `formatReadyLabel` returns null once the backlog is 30j+ old — the badge
  // override (demo hero's "Exemple") always wins when supplied, otherwise
  // omit the eyebrow line entirely rather than rendering nothing/empty.
  const eyebrowLabel = badge?.label ?? formatReadyLabel(item);

  // Signature "compteur mécanique" bump: ticks `display` up to the new
  // `progress.watched` in a few steps (rather than jumping instantly) and
  // flashes cyan + a slight scale while it does, for ~240ms — the exact same
  // math as `VhsCounter`'s own bump effect, duplicated here on purpose: the
  // hero ticket's sober markup is hand-rolled (see the removed dead "hero"
  // variant note in vhs-counter.tsx), not routed through the shared
  // component, so this keeps the *visual* signature consistent without
  // merging the two. Callers rely on the parent giving this component a
  // fresh `key` (see `HomeContent`) whenever the underlying show OR season
  // changes, so a hero rotation never gets misread as "just watched one more
  // episode".
  const [display, setDisplay] = useState(progress?.watched ?? 0);
  const [bump, setBump] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  // Reveal d'entrée — UNIQUEMENT sur ce ticket (jamais par item de liste,
  // cf. ReadyListItem/StartCard, non concernés). Même pattern que
  // ProgressCard/NextEpisodeCard (fiche série) : `useInViewOnce` plutôt que
  // les utilitaires `animate-in` de tw-animate-css, réservés aux primitives
  // Radix ailleurs dans l'app. Se rejoue à chaque rotation du hero (remount
  // via la clé composite posée par HomeContent), jamais lors d'une simple
  // avance sur place (même clé = pas de remount = `inView` déjà `true`).
  const { ref: revealRef, inView } = useInViewOnce<HTMLDivElement>();
  // Last {watched, total} pair this effect has seen — the backstop below
  // compares against this rather than the (possibly still-tweening)
  // `display` state, so the comparison is stable regardless of where a
  // previous tween had gotten to.
  const prevProgressRef = useRef(progress);
  useEffect(() => {
    if (progress === undefined) return;
    const prev = prevProgressRef.current;
    prevProgressRef.current = progress;

    if (display === progress.watched) return;

    // Defensive backstop — the composite `key={show.id}-${season_number}`
    // on the parent call site (HomeContent) is the PRIMARY fix for a season
    // rollover on the SAME hero show (e.g. the season finale just got
    // marked watched from this very ticket): it forces a fresh mount
    // whenever the season changes, so in practice this effect never even
    // runs across that transition. This is only a secondary safety net for
    // if that key were ever to fail to change.
    //
    // Detects a genuine context reset by comparing `total` against the
    // previous render, not by the magnitude/direction of the `watched`
    // change — magnitude alone can't tell a large-but-legitimate
    // multi-episode increment or rollback WITHIN the same season (which
    // must always keep animating, however big the jump) apart from an
    // actual rollover to a different season/show (e.g. S1 10/10 -> S2
    // 0/13: a naive "did display shrink past the new total" check misses
    // this, since 10 is not > 13). `total` is scoped to one specific
    // season and, in practice, doesn't shift mid-season on its own — so
    // "same total as last time" is treated as proof of "still the same
    // season", and any `watched` change within it (up or down, any size)
    // is safe to animate normally; "different total" is treated as proof
    // of a context change, and jumps instantly with no tween/bump.
    const contextReset = prev !== undefined && progress.total !== prev.total;
    if (contextReset) {
      setDisplay(progress.watched);
      return;
    }

    if (prefersReducedMotion) {
      // No tween, no scale — jump straight to the new value. `bump` is still
      // set (harmless): since Lot 4, the render below already gates
      // `scale-110` on `!prefersReducedMotion`, and the counter/bar are cyan
      // in permanence regardless of `bump` — this branch no longer has any
      // visible consequence when reduced motion is on, but is left as-is
      // (not a logic change) rather than special-cased away.
      setDisplay(progress.watched);
      setBump(true);
      const timeoutId = setTimeout(() => setBump(false), 200);
      return () => clearTimeout(timeoutId);
    }

    setBump(true);
    const target = progress.watched;
    const diff = target - display;
    const steps = Math.min(Math.abs(diff), 6);
    const step = diff / (steps || 1);
    let i = 0;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const intervalId = setInterval(() => {
      i += 1;
      setDisplay((d) => (i >= steps ? target : Math.round(d + step)));
      if (i >= steps) {
        clearInterval(intervalId);
        timeoutId = setTimeout(() => setBump(false), 200);
      }
    }, 40);
    return () => {
      clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress?.watched, progress?.total, prefersReducedMotion]);

  const displayTotal = progress?.total ?? 0;
  const pct = displayTotal > 0 ? Math.min(100, (display / displayTotal) * 100) : 0;

  const handleMark = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (markWatched.isPending) return;
    onTap?.(e.currentTarget);
    markWatched.mutate({ episodeId: nextEpisode.id, showId: show.id });
  };

  const body = (
    <>
      {/* Full-bleed TMDb backdrop used as the card's atmosphere. */}
      {backdropUrl && (
        <div aria-hidden className="absolute inset-0">
          <img
            src={backdropUrl}
            alt=""
            width={1280}
            height={720}
            fetchPriority="high"
            decoding="async"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/30" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/70 to-transparent" />
        </div>
      )}

      <div className="relative flex h-full flex-col justify-end p-4">
        <div className="space-y-1">
          {eyebrowLabel && (
            <p
              className={`font-counter text-[10px] uppercase tracking-[0.25em] ${badge?.className ?? "text-primary"}`}
            >
              {eyebrowLabel}
            </p>
          )}
          <h2 className="font-display text-xl leading-tight text-foreground line-clamp-2">
            {show.title}
          </h2>
          {/*
            S/E PROÉMINENT d'abord, titre d'épisode muted ensuite, sur la
            même ligne (alignement maquette, revue design) — inverse l'ordre
            précédent (titre d'épisode seul ici, S/E relégué tout en bas dans
            le bloc compteur). Phosphore (`text-foreground`), jamais ambre :
            l'eyebrow ci-dessus est la SEULE étiquette ambre du ticket, cf.
            le problème "deux étiquettes qui se répètent" identifié au Lot 4
            — toujours d'actualité, seul l'EMPLACEMENT du S/E a changé, pas
            sa couleur. `min-w-0`/`truncate` sur le titre d'épisode : le S/E
            (longueur fixe, `shrink-0`) ne doit jamais céder de place à un
            titre d'épisode long.
          */}
          <div className="flex min-w-0 items-baseline gap-1.5">
            <span className="shrink-0 font-counter text-base font-semibold tracking-wide text-foreground">
              S{pad(nextEpisode.season_number)} · E{pad(nextEpisode.episode_number)}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
              {nextEpisode.title ?? "—"}
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          {/*
            Compteur signature élevé (Lot 4) — même grammaire que VhsCounter
            (variante "detail", la référence situationnelle la plus proche :
            une rangée horizontale compacte, pas la carte verticale dédiée de
            ProgressCard) : le grand chiffre est cyan EN PERMANENCE (jamais
            seulement pendant le bump), avec le même glow léger et continu.
            Révision (alignement maquette) : le S/E n'est PLUS répété ici — il
            vit maintenant dans l'en-tête, accolé au titre d'épisode (voir
            ci-dessus). Ce label devient "SAISON {N}" (mono muted, uppercase),
            purement contextuel pour la fraction cyan juste en dessous — sans
            redonder le numéro d'épisode déjà visible plus haut. Répartition à
            3 tons inchangée sur ce ticket : cyan = vu/progression (chiffre +
            barre), ambre = urgence temporelle (eyebrow du haut, seul),
            phosphore blanc = identifiant proéminent de l'épisode (S/E,
            en-tête). Le bloc [grand chiffre + barre] n'existe QUE si
            `progress` est fourni — jamais de placeholder quand la fraction
            n'est pas fiable (rotation en vol, cf. Lot 1) : le label "SAISON
            {N}" seul, rendu inconditionnellement, reste alors informatif sans
            inventer de chiffre.
          */}
          <div className="min-w-0 flex-1">
            <p className="font-counter text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Saison {nextEpisode.season_number}
            </p>
            {progress && (
              <>
                <div className="mt-1 flex items-baseline gap-1 font-counter tabular-nums">
                  <span
                    className={`text-[28px] leading-none tracking-tight text-cyan-accent transition-transform motion-reduce:transition-none ${
                      bump && !prefersReducedMotion ? "scale-110" : ""
                    }`}
                    style={{ textShadow: "0 0 14px rgba(77,217,196,0.35)" }}
                  >
                    {pad(display)}
                  </span>
                  <span className="text-lg leading-none text-muted-foreground">
                    /{pad(progress.total)}
                  </span>
                </div>
                {/* Barre 2px cyan en permanence (jamais ambre) — même
                    quantité que le grand chiffre au-dessus, donc même
                    langage de couleur ; le bump reste purement transitoire
                    (scale sur le chiffre), plus de bascule de couleur ici. */}
                <div className="mt-1.5 h-[2px] w-full overflow-hidden bg-muted-foreground/15">
                  <div
                    className="h-full bg-cyan-accent transition-[width] duration-300 ease-out motion-reduce:transition-none"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </>
            )}
          </div>
          {interactive && (
            <button
              ref={markButtonRef}
              type="button"
              onClick={handleMark}
              disabled={markWatched.isPending}
              aria-label="Marquer comme vu"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cyan-accent/40 bg-cyan-accent/15 text-cyan-accent backdrop-blur-sm transition-colors hover:bg-cyan-accent/25 disabled:opacity-50"
            >
              <Check className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </>
  );

  const className =
    "relative block overflow-hidden rounded-2xl border border-border bg-card aspect-[16/10]";

  const cardBody = !interactive ? (
    <div className={className}>{body}</div>
  ) : (
    <Link
      to="/show/$mediaType/$tmdbId"
      params={{
        mediaType: show.media_type,
        tmdbId: String(show.tmdb_id),
      }}
      className={className}
    >
      {body}
    </Link>
  );

  // Reveal posé sur un `<div>` conteneur qui ENVELOPPE le Link/div plutôt
  // que sur `Link` lui-même — évite de dépendre du transfert de `ref` de
  // TanStack Router pour ce composant.
  return (
    <div
      ref={revealRef}
      className={`opacity-0 translate-y-3 transition-[opacity,transform] duration-500 ease-out motion-reduce:opacity-100 motion-reduce:translate-y-0 motion-reduce:transition-none ${
        inView ? "opacity-100 translate-y-0" : ""
      }`}
    >
      {cardBody}
    </div>
  );
}
