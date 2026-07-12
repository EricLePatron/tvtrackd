import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useCalendarFollowedShows, fetchEpisodePage } from "@/hooks/use-calendar-timeline";
import { addDaysToDateString, buildWeekDayGroups, type TimelineDayGroup } from "@/lib/schedule";

export type CalendarWeek = {
  weekStart: string;
  /** Always exactly 7 entries (Monday..Sunday), empty or not. */
  dayGroups: TimelineDayGroup[];
  isLoading: boolean;
  /** A page fetch (followed shows or the week's episode window) failed. */
  isError: boolean;
  /** Retries whichever fetch failed — the episode window (the followed-shows
   *  query has no dedicated retry surface here, same as `useCalendarTimeline`). */
  refetch: () => void;
};

/**
 * Data layer for the /calendar "Semaine" grid: a single bounded
 * [weekStart, weekStart+6] fetch, refetched whole whenever `weekStart`
 * changes — deliberately NOT built on `useCalendarTimeline`'s infinite
 * backward-pagination (that hook is anchored on "today" at mount with no
 * forward pagination past J+90 and only sequential backward pages past
 * J-14; the week grid needs arbitrary random-access navigation to any week,
 * past or future, which an infinite-scroll cursor can't express). Shares the
 * followed-shows query (`useCalendarFollowedShows`) with the Agenda view so
 * switching views doesn't refire it.
 *
 * `enabled` lets the caller skip the episodes fetch entirely while the user
 * is sitting in the Agenda view, so switching the toggle doesn't fire an
 * unnecessary Supabase read every time.
 */
export function useCalendarWeek(
  weekStart: string,
  { enabled }: { enabled: boolean },
): CalendarWeek {
  const { user } = useAuth();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const followed = useCalendarFollowedShows();
  const showIds = followed.showIds;
  const weekEnd = useMemo(() => addDaysToDateString(weekStart, 6), [weekStart]);

  const episodesQuery = useQuery({
    queryKey: ["calendar-week-episodes", user?.id, showIds.join(","), weekStart],
    enabled: !!user && enabled && !!followed.data,
    queryFn: () => fetchEpisodePage(user!.id, showIds, today, { start: weekStart, end: weekEnd }),
  });

  const dayGroups = useMemo(() => {
    if (!episodesQuery.data) return [];
    const watchedSet = new Set(episodesQuery.data.watchedEpisodeIds);
    return buildWeekDayGroups(episodesQuery.data.episodes, watchedSet, weekStart, today);
  }, [episodesQuery.data, weekStart, today]);

  return {
    weekStart,
    dayGroups,
    isLoading: !!user && enabled && (followed.isLoading || episodesQuery.isLoading),
    isError: episodesQuery.isError || followed.isError,
    refetch: () => void episodesQuery.refetch(),
  };
}
