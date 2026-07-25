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
  groupUpcomingByDay,
  resolveHomeState,
  formatReadyLabel,
  seasonCountKey,
  selectNextReleases,
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
import { NextReleaseCard } from "@/components/home/next-release-card";
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
      const today = new Date().toISOString().slice(0, 10);

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
      // `limit` varies by state: `normal` caps the "Bientôt" teaser at 2 (1
      // big + 1 compact) alongside the hero/backlog, while `upcoming_only`
      // (no ready backlog at all — see `resolveHomeState`) makes this block
      // the PRIMARY content of the screen, so it gets a higher cap (~5: 1
      // big + up to 4 compact). Overflow beyond either cap stays covered by
      // the "Programme à venir" rail below, unaffected by this cap.
      const homeState = resolveHomeState({
        followedActiveCount: showIds.length,
        readyCount,
        upcomingCount,
      });
      const nextReleasesLimit = homeState === "upcoming_only" ? 5 : 2;
      // Excludes the hero's own show — it already dominates that show's
      // slot as "à voir maintenant"; repeating it here as "Nj" would read as
      // redundant rather than as a genuinely different upcoming release.
      // `hero` is always null in `upcoming_only` (readyCount 0), so this
      // naturally becomes `undefined` there — no special-casing needed. See
      // `selectNextReleases`'s doc comment.
      const nextReleases = selectNextReleases(dayGroups, today, {
        limit: nextReleasesLimit,
        excludeShowIds: hero ? new Set([hero.show.id]) : undefined,
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
          <p className="mb-3 font-display text-sm font-semibold text-foreground">À découvrir</p>
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

function HomeContent({ data }: { data: HomeData }) {
  const state = resolveHomeState({
    followedActiveCount: data.followedActiveCount,
    readyCount: data.readyCount,
    upcomingCount: data.upcomingCount,
  });

  if (state === "no_shows") {
    return <NoShowsPanel />;
  }

  if (state === "all_caught_up") {
    return <AllCaughtUpBanner />;
  }

  const buckets = bucketUpcoming(data.dayGroups, data.today);

  if (state === "upcoming_only") {
    // No hero/backlog at all in this state — the "Bientôt" block (same
    // shared gabarit as in `normal`, just a higher `limit` set server-side
    // in the queryFn) IS the primary content at the top of the screen, so
    // its header is always shown (never gated on `length >= 2` the way
    // `normal`'s is — see `NextReleasesBlock`).
    return (
      <>
        <div className="mx-5">
          <NextReleasesBlock items={data.nextReleases} today={data.today} alwaysShowHeader />
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
      {/* Zone A — À voir maintenant */}
      <div className="mx-5">
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
          />
        )}

        {data.reprendre.length > 0 && (
          <div className="mt-5">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
              <p className="font-display text-sm font-semibold text-foreground">Reprendre</p>
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
              {data.reprendre.slice(0, REPRENDRE_VISIBLE_COUNT).map((item) => (
                <ReadyListItem
                  key={item.show.id}
                  item={item}
                  progress={data.reprendreProgressByShowId.get(item.show.id)}
                />
              ))}
            </div>
          </div>
        )}

        {data.nouveau.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 font-display text-sm font-semibold text-foreground">À commencer</p>
            <StartRail items={data.nouveau} />
          </div>
        )}

        {/* Bloc "Bientôt" — UNIQUEMENT en état `normal` (backlog ET sortie
            future connues, cf. resolveHomeState) : `upcoming_only` rend son
            propre bloc "Bientôt" plus haut dans ce fichier (même gabarit
            partagé, `limit` plus élevé) et `ready_only` n'a par construction
            aucune entrée à afficher ici (upcomingCount === 0 => dayGroups
            vide => nextReleases vide). Placé APRÈS "Reprendre"/"À
            commencer", juste avant la Zone B : l'ordre validé en état
            `normal` est Hero → Reprendre → À commencer → Bientôt →
            Programme à venir. */}
        {state === "normal" && data.nextReleases.length > 0 && (
          <div className="mt-5">
            <NextReleasesBlock items={data.nextReleases} today={data.today} />
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
    </>
  );
}

/**
 * Shared "Bientôt" block — rang #1 en grand format (`NextReleaseHeroCard`),
 * rangs #2+ en format compact (`NextReleaseCard`), sous un en-tête de
 * section "Bientôt" (Archivo). Seule différence entre ses deux call sites
 * (`HomeContent`'s `normal` et `upcoming_only` branches) : `alwaysShowHeader`
 * — `normal` garde la règle "eyebrow seulement à partir de 2 items" (un item
 * seul se suffit à lui-même, à côté du hero/backlog déjà présents),
 * `upcoming_only` affiche toujours l'en-tête puisque ce bloc est alors le
 * seul contenu en tête d'écran (pas de hero pour l'accompagner). `limit` (le
 * nombre d'`items` reçus) est décidé en amont, dans le queryFn de
 * `HomeScreen` — ce composant se contente d'afficher ce qu'on lui donne.
 */
function NextReleasesBlock({
  items,
  today,
  alwaysShowHeader = false,
}: {
  items: NextReleaseItem[];
  today: string;
  alwaysShowHeader?: boolean;
}) {
  if (!items.length) return null;

  return (
    <div>
      {(alwaysShowHeader || items.length >= 2) && (
        <p className="mb-2 font-display text-sm font-semibold text-foreground">Bientôt</p>
      )}
      <div className="space-y-2">
        {items.map((item, index) =>
          index === 0 ? (
            <NextReleaseHeroCard key={item.show.id} item={item} />
          ) : (
            <NextReleaseCard key={item.show.id} item={item} today={today} />
          ),
        )}
      </div>
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
      {/* `font-display font-semibold`, sans uppercase/tracking-widest —
          révision design alignant les en-têtes de section ("Reprendre"/
          "Bientôt"/"À commencer"/"Programme à venir") sur Archivo pleine
          opacité plutôt que sur la famille eyebrow mono (font-counter),
          désormais réservée aux libellés secondaires (badges, "Voir tout ›",
          compteurs). `font-semibold` explicite (retour QA) : un `<p>` sans
          poids explicite hérite du 400 (regular), contrairement à un `<h2>`
          qui hérite du 700 par défaut — laisser l'inférence de balise
          décider du poids aurait rendu "Reprendre"/"Bientôt"/"À commencer"
          plus légers que "Programme à venir" alors que les 4 doivent former
          un palier visuel homogène. Taille déjà `text-sm`/`text-foreground`
          avant ce lot — seule la famille de police, le poids et le tracking
          changent ici. Les <h3> "Demain"/"Cette semaine"/"Plus tard"
          (upcoming-section.tsx) restent inchangés (hors périmètre de cette
          révision, qui liste explicitement les 4 en-têtes concernés). */}
      <h2 className="font-display text-sm font-semibold text-foreground">Programme à venir</h2>
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

  const handleMark = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (markWatched.isPending) return;
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
          <p className="text-sm text-muted-foreground line-clamp-1">{nextEpisode.title ?? "—"}</p>
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          {/*
            Compteur signature élevé (Lot 4) — même grammaire que VhsCounter
            (variante "detail", la référence situationnelle la plus proche :
            une rangée horizontale compacte, pas la carte verticale dédiée de
            ProgressCard) : le grand chiffre est cyan EN PERMANENCE (jamais
            seulement pendant le bump), avec le même glow léger et continu.
            Le S/E, inline avec la fraction, reste en label secondaire
            AU-DESSUS, réutilisant la position de l'eyebrow déjà présent plus
            haut sur ce même ticket.
            Révision (mise en avant du n° d'épisode, design review) : le S/E
            passe de `text-[10px] text-muted-foreground` à `text-lg
            text-foreground` (phosphore, plus lisible) — MAIS reste hors de
            la famille ambre (`text-primary`) pour ne PAS recréer le problème
            identifié en Lot 4 : l'eyebrow du haut (badge/`formatReadyLabel`,
            "Ce soir"/"Prêt · Nj") et le S/E partageaient alors exactement la
            même classe ambre, un effet "deux étiquettes qui se répètent".
            Répartition à 3 tons inchangée sur ce ticket : cyan = vu/
            progression (chiffre + barre), ambre = urgence temporelle
            (eyebrow du haut, seul), phosphore blanc = identifiant proéminent
            de l'épisode (S/E, plus grand mais toujours neutre en couleur).
            Le bloc [grand chiffre + barre] n'existe QUE si `progress` est
            fourni — jamais de placeholder quand la fraction n'est pas
            fiable (rotation en vol, cf. Lot 1) : le S/E seul, rendu
            inconditionnellement, porte alors toute l'information plutôt que
            de laisser un chiffre inventé.
          */}
          <div className="min-w-0 flex-1">
            <p className="font-counter text-lg font-semibold tracking-wide text-foreground">
              S{pad(nextEpisode.season_number)} E{pad(nextEpisode.episode_number)}
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
