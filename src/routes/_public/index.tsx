import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Play } from "lucide-react";
import { ScreenHeader } from "@/components/screen-header";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  addDaysToDateString,
  bucketUpcoming,
  buildReadyItems,
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

type HomeData = {
  today: string;
  followedActiveCount: number;
  hero: ReadyItem | null;
  reprendre: ReadyItem[];
  nouveau: ReadyItem[];
  readyCount: number;
  dayGroups: DayGroup[];
  upcomingCount: number;
  countdown: ReturnType<typeof nextCountdown>;
};

function HomeScreen() {
  const { user } = useAuth();

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
          "id, season_number, episode_number, title, air_date, show:shows!inner(id, tmdb_id, media_type, title, poster_path)",
        )
        .in("show_id", showIds)
        .not("air_date", "is", null)
        .lte("air_date", future)
        .order("air_date", { ascending: true });

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

      const ready = buildReadyItems(episodes, watchedSet, showStatusByShowId, today);
      const { hero, reprendre, nouveau } = selectHero(ready);
      const dayGroups = groupUpcomingByDay(episodes, today, 90);
      const upcomingCount = countUpcomingEntries(dayGroups);
      const countdown = nextCountdown(episodes, today);

      return {
        today,
        followedActiveCount: showIds.length,
        hero,
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
      <ScreenHeader eyebrow="Ce soir" title="Programme">
        Vos prochaines diffusions, en un coup d'œil.
      </ScreenHeader>

      {!user ? (
        <AnonymousHome />
      ) : isLoading || !data ? (
        <div className="mx-5 h-40 animate-pulse rounded-xl bg-card" />
      ) : (
        <HomeContent data={data} />
      )}
    </>
  );
}

function AnonymousHome() {
  return (
    <>
      <div className="mx-5 rounded-xl border border-dashed border-border bg-transparent p-6 text-center">
        <p className="font-counter text-[11px] uppercase tracking-widest text-muted-foreground">
          Mode découverte
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Créez un compte pour suivre vos séries et voir votre programme personnalisé.
        </p>
        <Link
          to="/auth"
          className="mt-4 inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground"
        >
          Se connecter / Créer un compte
        </Link>
      </div>
      <div className="mx-5">
        <DiscoverySection variant="grid" />
      </div>
    </>
  );
}

function HomeContent({ data }: { data: HomeData }) {
  const state = resolveHomeState({
    followedActiveCount: data.followedActiveCount,
    readyCount: data.readyCount,
    upcomingCount: data.upcomingCount,
  });

  if (state === "no_shows") {
    return <NoShowsPanel discovery={<DiscoverySection variant="grid" />} />;
  }

  if (state === "all_caught_up") {
    return <AllCaughtUpBanner discovery={<DiscoverySection variant="compact" />} />;
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
        {data.hero && <HeroTicket item={data.hero} />}

        {data.reprendre.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
              Reprendre
            </p>
            <div className="space-y-2">
              {data.reprendre.map((item) => (
                <ReadyListItem key={item.show.id} item={item} />
              ))}
            </div>
          </div>
        )}

        {data.nouveau.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
              Nouveau
            </p>
            <div className="space-y-2">
              {data.nouveau.map((item) => (
                <ReadyListItem key={item.show.id} item={item} />
              ))}
            </div>
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

function HeroTicket({ item }: { item: ReadyItem }) {
  const { show, nextEpisode } = item;
  return (
    <Link
      to="/show/$mediaType/$tmdbId"
      params={{
        mediaType: show.media_type,
        tmdbId: String(show.tmdb_id),
      }}
      className="relative block overflow-hidden rounded-xl border border-border bg-card"
    >
      {/* Perforation notches */}
      <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-background" />
      <span className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 h-4 w-4 rounded-full bg-background" />

      <div className="flex gap-4 p-4">
        <div className="h-24 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-surface-elevated">
          {show.poster_path && (
            <img src={show.poster_path} alt={show.title} className="h-full w-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-counter text-[10px] uppercase tracking-[0.25em] text-primary">
            {formatReadyLabel(item)}
          </p>
          <h2 className="mt-1 font-display text-lg leading-tight text-foreground truncate">
            {show.title}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground truncate">{nextEpisode.title ?? "—"}</p>
          <div className="mt-3 flex items-center justify-between rounded-md bg-surface-elevated px-3 py-1.5">
            <span className="font-counter text-sm tracking-widest text-cyan-accent">
              S{pad(nextEpisode.season_number)} E{pad(nextEpisode.episode_number)}
            </span>
            <Play className="h-4 w-4 text-primary" />
          </div>
        </div>
      </div>
      <div className="border-t border-dashed border-border px-4 py-2">
        <p className="font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
          Nightframe · Ticket #{pad(nextEpisode.id % 100)}
        </p>
      </div>
    </Link>
  );
}
