import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { ScreenHeader } from "@/components/screen-header";
import { useMarkWatched } from "@/hooks/use-mark-watched";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  addDaysToDateString,
  bucketUpcoming,
  buildLastWatchedAtByShow,
  buildReadyItems,
  computeSeasonTally,
  countUpcomingEntries,
  groupUpcomingByDay,
  nextCountdown,
  resolveHomeState,
  selectHero,
  formatReadyLabel,
  type ActiveStatus,
  type DayGroup,
  type ReadyItem,
  type ScheduleEpisode,
} from "@/lib/schedule";
import { ReadyListItem } from "@/components/home/ready-list-item";
import { StartRail } from "@/components/home/start-rail";
import { UpcomingBucketRails } from "@/components/home/upcoming-section";
import { DiscoverySection } from "@/components/home/discovery-section";
import {
  NoShowsPanel,
  AllCaughtUpBanner,
  NothingNowCountdownTicket,
  NothingScheduledNotice,
} from "@/components/home/empty-states";

export const Route = createFileRoute("/_public/")({
  component: HomeScreen,
});

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

/** Rows shown before "Reprendre" collapses into a "Voir tout" link. */
const REPRENDRE_VISIBLE_COUNT = 3;

type HomeData = {
  today: string;
  followedActiveCount: number;
  hero: ReadyItem | null;
  /** Hero's current-season watched/total, when computable — see `HeroTicket`'s `progress` prop. */
  heroProgress: { watched: number; total: number } | null;
  reprendre: ReadyItem[];
  nouveau: ReadyItem[];
  readyCount: number;
  dayGroups: DayGroup[];
  upcomingCount: number;
  countdown: ReturnType<typeof nextCountdown>;
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
          nouveau: [],
          readyCount: 0,
          dayGroups: [],
          upcomingCount: 0,
          countdown: null,
        };
      }

      // No lower bound on the past — a followed show can be arbitrarily late.
      const future = addDaysToDateString(today, 90);

      const { data: eps } = await supabase
        .from("episodes")
        .select(
          "id, season_number, episode_number, title, air_date, still_path, show:shows!inner(id, tmdb_id, media_type, title, poster_path, backdrop_path)",
        )
        .in("show_id", showIds)
        .not("air_date", "is", null)
        .lte("air_date", future)
        .order("air_date", { ascending: true });

      const episodes = (eps ?? []) as unknown as ScheduleEpisode[];
      const epIds = episodes.map((e) => e.id);
      // `watched_at` is fetched alongside `episode_id` (no extra round-trip)
      // to derive a per-show "last watched" recency signal — see
      // `buildLastWatchedAtByShow` and its use in `selectHero`'s 60j hero
      // guard.
      const { data: watched } = epIds.length
        ? await supabase
            .from("watch_status")
            .select("episode_id, watched_at")
            .eq("user_id", user!.id)
            .in("episode_id", epIds)
        : { data: [] };
      const watchedRows = watched ?? [];
      const watchedSet = new Set(watchedRows.map((w) => w.episode_id));
      const lastWatchedAtByShowId = buildLastWatchedAtByShow(episodes, watchedRows);

      const ready = buildReadyItems(episodes, watchedSet, showStatusByShowId, today);
      // `reprendreDormant` isn't consumed by the UI this lot — dormant shows
      // are only reachable through /library — but the split itself already
      // shapes `reprendre` (active-only, capped to 3 + "Voir tout").
      const { hero, reprendre, nouveau } = selectHero(ready, today, lastWatchedAtByShowId);
      const heroProgress = hero
        ? computeSeasonTally(episodes, watchedSet, hero.show.id, hero.nextEpisode.season_number)
        : null;
      const dayGroups = groupUpcomingByDay(episodes, today, 90);
      const upcomingCount = countUpcomingEntries(dayGroups);
      const countdown = nextCountdown(episodes, today);

      return {
        today,
        followedActiveCount: showIds.length,
        hero,
        heroProgress,
        reprendre,
        nouveau,
        readyCount: ready.length,
        dayGroups,
        upcomingCount,
        countdown,
      };
    },
  });

  return (
    <>
      <ScreenHeader eyebrow="Ce soir" title="Programme" hideAuthPill={hideHeaderAuthPill}>
        Vos prochaines diffusions, en un coup d'œil.
      </ScreenHeader>

      {!user ? (
        <AnonymousHome />
      ) : isLoading || !data ? (
        <div className="mx-5 h-40 animate-pulse rounded-xl bg-card" />
      ) : (
        <HomeContent data={data} />
      )}

      {/* Découverte — un seul encart, à un emplacement fixe, quel que soit
          l'état de la Home. */}
      <div className="mx-5 mt-8">
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
  // Animate the VHS counter's bump once on mount, purely for demo effect —
  // reuses VhsCounter's own increment logic (triggered by a `watched` prop
  // change), not a new animation mechanism.
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

      <div className="mt-5 rounded-xl border border-border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Suivez vos séries épisode par épisode, sans jamais perdre votre historique.
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Calendrier, statuts, rewatchs — tout au même endroit.
        </p>
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
      </div>
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

  if (state === "upcoming_only" && data.countdown) {
    return (
      <>
        <NothingNowCountdownTicket countdown={data.countdown} />
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
        {data.hero && <HeroTicket item={data.hero} progress={data.heroProgress ?? undefined} />}

        {data.reprendre.length > 0 && (
          <div className="mt-5">
            <div className="mb-2 flex items-baseline justify-between">
              <p className="font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
                Reprendre
              </p>
              {/* "Reprendre" is capped to 3 visible rows — the rest is only
                  reachable through the library, filtered on the en_cours tab
                  via the shared status search-param (see library.tsx). */}
              {data.reprendre.length > REPRENDRE_VISIBLE_COUNT && (
                <Link
                  to="/library"
                  search={{ status: "en_cours" }}
                  className="font-counter text-[10px] uppercase tracking-widest text-primary"
                >
                  Voir tout · +{data.reprendre.length - REPRENDRE_VISIBLE_COUNT} à reprendre ›
                </Link>
              )}
            </div>
            <div className="space-y-2">
              {data.reprendre.slice(0, REPRENDRE_VISIBLE_COUNT).map((item) => (
                <ReadyListItem key={item.show.id} item={item} />
              ))}
            </div>
          </div>
        )}

        {data.nouveau.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
              À commencer
            </p>
            <StartRail items={data.nouveau} />
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
      <h2 className="font-display text-base text-foreground">Programme à venir</h2>
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
  const pct =
    progress && progress.total > 0 ? Math.min(100, (progress.watched / progress.total) * 100) : 0;

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
          <img src={backdropUrl} alt="" className="h-full w-full object-cover" />
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
            Sober mechanical counter: one uniform-size mono line (no boxed
            pastille, no S-vs-E size mismatch), a discreet fraction on the
            right (only when season-progress data is available), and a thin
            2px amber bar underneath — never a bordered/backdrop-blur box.
          */}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-counter text-base uppercase tracking-widest text-foreground">
                S{pad(nextEpisode.season_number)} E{pad(nextEpisode.episode_number)}
              </span>
              {progress && (
                <span className="font-counter text-xs uppercase tracking-widest text-muted-foreground">
                  {pad(progress.watched)} / {pad(progress.total)}
                </span>
              )}
            </div>
            {progress && (
              <div className="mt-1.5 h-[2px] w-full overflow-hidden bg-muted-foreground/15">
                <div
                  className="h-full bg-primary transition-[width] duration-300 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>
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

  if (!interactive) {
    return <div className={className}>{body}</div>;
  }

  return (
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
}
