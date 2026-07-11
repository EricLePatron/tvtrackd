import { useMemo } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  addDaysToDateString,
  buildTimelineDayGroups,
  type ScheduleEpisode,
  type TimelineDayGroup,
} from "@/lib/schedule";

/** How much past history to load upfront, before any backward scroll. */
const INITIAL_PAST_DAYS = 14;
/** Fixed forward horizon — never paginated further, matches the product ask. */
const FUTURE_WINDOW_DAYS = 90;
/** Size of each backward page once the user scrolls past the initial window. */
const PAST_PAGE_WINDOW_DAYS = 30;

export type WindowParam = { start: string; end: string };

type EpisodePage = {
  start: string;
  end: string;
  episodes: ScheduleEpisode[];
  /** Only computed for `air_date <= today` rows in this page — future episodes are never "watched". */
  watchedEpisodeIds: number[];
};

async function fetchWatchedIds(userId: string, episodeIds: number[]): Promise<number[]> {
  if (!episodeIds.length) return [];
  const { data, error } = await supabase
    .from("watch_status")
    .select("episode_id")
    .eq("user_id", userId)
    .in("episode_id", episodeIds);
  if (error) throw error;
  return (data ?? []).map((w) => w.episode_id);
}

/**
 * Fetches one bounded [start, end] window of episodes (+ which of the
 * past/today ones are watched) for a set of shows. Exported so
 * `use-calendar-week.ts` can fetch its own single-week window through the
 * exact same query shape as the Agenda's infinite-scroll pages, without
 * duplicating the Supabase query.
 */
export async function fetchEpisodePage(
  userId: string,
  showIds: number[],
  today: string,
  { start, end }: WindowParam,
): Promise<EpisodePage> {
  if (!showIds.length) return { start, end, episodes: [], watchedEpisodeIds: [] };

  const { data: eps, error } = await supabase
    .from("episodes")
    .select(
      "id, season_number, episode_number, title, air_date, show:shows!inner(id, tmdb_id, media_type, title, poster_path)",
    )
    .in("show_id", showIds)
    .not("air_date", "is", null)
    .gte("air_date", start)
    .lte("air_date", end)
    .order("air_date", { ascending: true });
  if (error) throw error;

  const episodes = (eps ?? []) as unknown as ScheduleEpisode[];
  const pastEpisodeIds = episodes.filter((e) => e.air_date! <= today).map((e) => e.id);
  const watchedEpisodeIds = await fetchWatchedIds(userId, pastEpisodeIds);

  return { start, end, episodes, watchedEpisodeIds };
}

export type CalendarTimeline = {
  today: string;
  dayGroups: TimelineDayGroup[];
  /** True while the very first window (today-14j → today+90j) is resolving. */
  isLoading: boolean;
  /** True while an older backward page is being fetched (top-of-list spinner). */
  isFetchingPreviousPage: boolean;
  /** A page fetch (followed shows or an episode window) failed — distinct from "no more history". */
  isError: boolean;
  hasPreviousPage: boolean;
  fetchPreviousPage: () => void;
  /** False once `followed` has resolved and the user follows zero a_voir/en_cours shows. */
  hasFollowedShows: boolean;
};

export type FollowedShowsData = {
  showIds: number[];
  earliestDate: string | null;
};

/**
 * Followed (a_voir/en_cours) show ids + the earliest cached episode air_date
 * among them — shared data layer for BOTH /calendar views (Agenda's
 * backward-pagination bound and Semaine's per-week episode fetch). Extracted
 * from `useCalendarTimeline` so the two hooks hit the exact same React Query
 * cache entry (`queryKey` below is unchanged) instead of each firing this
 * query independently when the user switches views.
 */
export function useCalendarFollowedShows() {
  const { user } = useAuth();

  const followed = useQuery({
    queryKey: ["calendar-timeline-followed", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<FollowedShowsData> => {
      const { data, error } = await supabase
        .from("user_shows")
        .select("show_id")
        .eq("user_id", user!.id)
        .in("status", ["a_voir", "en_cours"])
        // Postgres does not guarantee row order without ORDER BY. This feeds
        // `queryKey` below (via the sorted showIds), so a stable order here
        // matters: without it, an unrelated row-order change between two
        // identical requests (e.g. on window refocus) would change the key
        // and blow away the whole loaded backward-pagination history.
        .order("show_id", { ascending: true });
      if (error) throw error;
      const showIds = (data ?? []).map((r) => r.show_id);

      let earliestDate: string | null = null;
      if (showIds.length) {
        const { data: earliest, error: earliestError } = await supabase
          .from("episodes")
          .select("air_date")
          .in("show_id", showIds)
          .not("air_date", "is", null)
          .order("air_date", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (earliestError) throw earliestError;
        earliestDate = earliest?.air_date ?? null;
      }

      return { showIds, earliestDate };
    },
  });

  // Sorted defensively (belt-and-suspenders on top of the `ORDER BY` above)
  // so any derived queryKey never changes unless the *set* of followed shows
  // actually changes.
  const showIds = useMemo(
    () => [...(followed.data?.showIds ?? [])].sort((a, b) => a - b),
    [followed.data],
  );

  return { ...followed, showIds };
}

/**
 * Data layer for the full /calendar timeline: fixed 90-day future window
 * loaded upfront in one shot, plus unlimited backward pagination by 30-day
 * windows as the user scrolls up, bounded by the earliest cached episode
 * among the user's followed (a_voir/en_cours) shows — never an arbitrary
 * symmetric cutoff. Reads exclusively from the shared Supabase cache
 * (`episodes`/`shows`), no TMDb calls.
 */
export function useCalendarTimeline(): CalendarTimeline {
  const { user } = useAuth();
  // Computed once per mount so the window doesn't drift across a long session.
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const followed = useCalendarFollowedShows();
  const showIds = followed.showIds;
  const earliestDate = followed.data?.earliestDate ?? null;

  const initialStart = addDaysToDateString(today, -INITIAL_PAST_DAYS);
  const initialEnd = addDaysToDateString(today, FUTURE_WINDOW_DAYS);

  const episodesQuery = useInfiniteQuery({
    queryKey: ["calendar-timeline-episodes", user?.id, showIds.join(",")],
    enabled: !!user && !!followed.data,
    initialPageParam: { start: initialStart, end: initialEnd } as WindowParam,
    queryFn: ({ pageParam }) => fetchEpisodePage(user!.id, showIds, today, pageParam),
    // The future horizon is fixed at 90 days — no forward pagination.
    getNextPageParam: () => undefined,
    getPreviousPageParam: (firstPage) => {
      if (!showIds.length || !earliestDate) return undefined;
      const prevEnd = addDaysToDateString(firstPage.start, -1);
      if (prevEnd < earliestDate) return undefined; // no episodes older than this exist
      const prevStart = addDaysToDateString(prevEnd, -(PAST_PAGE_WINDOW_DAYS - 1));
      return { start: prevStart, end: prevEnd };
    },
  });

  const { data, isLoading, isError, isFetchingPreviousPage, hasPreviousPage, fetchPreviousPage } =
    episodesQuery;

  const dayGroups = useMemo(() => {
    if (!data) return [];
    const allEpisodes: ScheduleEpisode[] = [];
    const watchedSet = new Set<number>();
    for (const page of data.pages) {
      allEpisodes.push(...page.episodes);
      for (const id of page.watchedEpisodeIds) watchedSet.add(id);
    }
    return buildTimelineDayGroups(allEpisodes, watchedSet, today);
  }, [data, today]);

  return {
    today,
    dayGroups,
    isLoading: !!user && (followed.isLoading || (isLoading && !data)),
    isFetchingPreviousPage,
    // A failed page fetch throws instead of silently resolving to an empty
    // page (see fetchEpisodePage/fetchWatchedIds) — surfaced here so the UI
    // can tell a real "end of history" apart from a transient error.
    isError: isError || followed.isError,
    hasPreviousPage: hasPreviousPage ?? false,
    fetchPreviousPage: () => void fetchPreviousPage(),
    hasFollowedShows: followed.data ? followed.data.showIds.length > 0 : true,
  };
}
