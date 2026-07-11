/**
 * Pure scheduling helpers for the home screen ("À voir maintenant" / "Programme
 * à venir") and the dedicated /calendar screen. No React, no Supabase — every
 * function here takes plain data + a `today` string (YYYY-MM-DD) and returns
 * plain data, so it can be unit-tested in isolation.
 */

export type ActiveStatus = "a_voir" | "en_cours";

export type ShowLite = {
  id: number;
  tmdb_id: number;
  media_type: string;
  title: string;
  poster_path: string | null;
};

export type EpisodeLite = {
  id: number;
  season_number: number;
  episode_number: number;
  title: string | null;
  air_date: string | null; // "YYYY-MM-DD" (Postgres date, no time)
};

export type ScheduleEpisode = EpisodeLite & { show: ShowLite };

export type ReadyItem = {
  show: ShowLite;
  status: ActiveStatus;
  /** All ready (aired, not yet watched) episodes for this show, sorted season/episode asc. */
  episodes: ScheduleEpisode[];
  /** First unwatched episode in season/episode order — what the card/ticket points to. */
  nextEpisode: ScheduleEpisode;
  /** episodes.length - 1, used for the "+N disponibles" badge. */
  extraCount: number;
  /** Earliest air_date among the ready episodes of this show. */
  earliestAirDate: string;
  isLate: boolean;
  lateDays: number;
};

export type UpcomingSingleEntry = {
  type: "single";
  show: ShowLite;
  episode: ScheduleEpisode;
  /**
   * Optional "already watched" flag — never populated by `groupUpcomingByDay`
   * (Home's rail is future-only, so "watched" never applies there). Only the
   * /calendar timeline (`buildFlatRows` in `calendar-timeline-rows.ts`) sets
   * this, for past/today episodes. Left `undefined` for every existing Home
   * call site, which keeps `EntryCard`'s "Vu" badge invisible there.
   */
  watched?: boolean;
};

export type UpcomingDropEntry = {
  type: "drop";
  show: ShowLite;
  seasonNumber: number;
  episodes: ScheduleEpisode[];
  count: number;
};

export type UpcomingEntry = UpcomingSingleEntry | UpcomingDropEntry;

export type DayGroup = {
  date: string;
  entries: UpcomingEntry[];
};

export type UpcomingBuckets = {
  demain: DayGroup[];
  cetteSemaine: DayGroup[];
  plusTard: DayGroup[];
};

export type HomeState = "no_shows" | "all_caught_up" | "upcoming_only" | "ready_only" | "normal";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Parses a "YYYY-MM-DD" string as a UTC-midnight timestamp (avoids local-tz drift). */
function toUtcMs(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
}

/** Same as `toUtcMs`, but as a `Date` — for callers that need `Intl`/`getUTCDate` etc. */
function toUtcDate(dateStr: string): Date {
  return new Date(toUtcMs(dateStr));
}

/** Capitalizes the first letter — `Intl.DateTimeFormat("fr-FR", ...)` short weekday/month labels come back lowercase. */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function daysBetween(fromDateStr: string, toDateStr: string): number {
  return Math.round((toUtcMs(toDateStr) - toUtcMs(fromDateStr)) / DAY_MS);
}

export function addDaysToDateString(dateStr: string, n: number): string {
  const d = new Date(toUtcMs(dateStr) + n * DAY_MS);
  return d.toISOString().slice(0, 10);
}

function byEpisodeOrder(a: ScheduleEpisode, b: ScheduleEpisode) {
  if (a.season_number !== b.season_number) return a.season_number - b.season_number;
  return a.episode_number - b.episode_number;
}

/**
 * Builds one ReadyItem per followed show (status a_voir/en_cours) that has at
 * least one aired (air_date <= today), unwatched episode. Aggregates *all*
 * ready+unwatched episodes of that show into a single item, regardless of
 * whether they aired on the same day or accumulated over several weeks.
 */
export function buildReadyItems(
  episodes: ScheduleEpisode[],
  watchedEpisodeIds: ReadonlySet<number>,
  showStatusByShowId: ReadonlyMap<number, ActiveStatus>,
  today: string,
): ReadyItem[] {
  const groups = new Map<number, ScheduleEpisode[]>();

  for (const ep of episodes) {
    if (!ep.air_date || ep.air_date > today) continue;
    if (watchedEpisodeIds.has(ep.id)) continue;
    const status = showStatusByShowId.get(ep.show.id);
    if (!status) continue;
    const arr = groups.get(ep.show.id) ?? [];
    arr.push(ep);
    groups.set(ep.show.id, arr);
  }

  const items: ReadyItem[] = [];
  for (const [showId, eps] of groups) {
    const sorted = [...eps].sort(byEpisodeOrder);
    const earliestAirDate = sorted.reduce(
      (min, e) => (e.air_date! < min ? e.air_date! : min),
      sorted[0].air_date!,
    );
    const status = showStatusByShowId.get(showId)!;
    const lateDays = Math.max(0, daysBetween(earliestAirDate, today));
    items.push({
      show: sorted[0].show,
      status,
      episodes: sorted,
      nextEpisode: sorted[0],
      extraCount: sorted.length - 1,
      earliestAirDate,
      isLate: earliestAirDate < today,
      lateDays,
    });
  }

  return items;
}

/**
 * Per-show progress data for the library grid ("En cours" tab): next episode
 * to watch + a tally scoped to that episode's SEASON only (not the whole
 * series). Deliberately NOT built on top of `buildReadyItems` (which needs a
 * show-status map irrelevant to callers that already pre-filter show ids) but
 * mirrors it exactly on the parts that matter:
 * - `nextEpisode` uses the identical "ready episode" predicate as
 *   `buildReadyItems` (aired, not yet watched) and the same `byEpisodeOrder`
 *   sort, so a show with several seasons airing concurrently still resolves
 *   to the oldest unwatched episode in season/episode order, never air-date
 *   order.
 * - the season tally uses the same watched/total computation already done
 *   inline for `VhsCounter` on the show detail page (filter episodes by
 *   `season_number`, count watched vs length) — no new formula.
 */
export type LibraryProgressEntry = {
  showId: number;
  nextEpisode: ScheduleEpisode;
  seasonWatched: number;
  seasonTotal: number;
};

export function buildLibraryProgress(
  episodes: ScheduleEpisode[],
  watchedEpisodeIds: ReadonlySet<number>,
  today: string,
): {
  /** Show ids present in `episodes` — i.e. shows with cached episode data at all. */
  knownShowIds: ReadonlySet<number>;
  /**
   * One entry per show with a ready (aired, unwatched) episode. A show id
   * present in `knownShowIds` but absent here is "caught up" (no chip data
   * to show, distinct from "no cached data at all").
   */
  progressByShowId: ReadonlyMap<number, LibraryProgressEntry>;
} {
  const groups = new Map<number, ScheduleEpisode[]>();
  for (const ep of episodes) {
    const arr = groups.get(ep.show.id) ?? [];
    arr.push(ep);
    groups.set(ep.show.id, arr);
  }

  const knownShowIds = new Set(groups.keys());
  const progressByShowId = new Map<number, LibraryProgressEntry>();

  for (const [showId, eps] of groups) {
    const sorted = [...eps].sort(byEpisodeOrder);
    const nextEpisode = sorted.find(
      (e) => !!e.air_date && e.air_date <= today && !watchedEpisodeIds.has(e.id),
    );
    if (!nextEpisode) continue; // caught up — no tally needed (never shown for this state)

    const seasonEps = sorted.filter((e) => e.season_number === nextEpisode.season_number);
    const seasonWatched = seasonEps.filter((e) => watchedEpisodeIds.has(e.id)).length;

    progressByShowId.set(showId, {
      showId,
      nextEpisode,
      seasonWatched,
      seasonTotal: seasonEps.length,
    });
  }

  return { knownShowIds, progressByShowId };
}

function byEarliestAirDate(a: ReadyItem, b: ReadyItem) {
  if (a.earliestAirDate !== b.earliestAirDate) {
    return a.earliestAirDate < b.earliestAirDate ? -1 : 1;
  }
  return a.show.title.localeCompare(b.show.title);
}

/**
 * Hero selection rule: an `en_cours` show with a ready episode always wins the
 * hero slot over any `a_voir` show, no matter how much older the `a_voir`
 * show's backlog is. Falls back to the oldest `a_voir` item only when there is
 * no `en_cours` candidate at all.
 */
export function selectHero(readyItems: ReadyItem[]): {
  hero: ReadyItem | null;
  reprendre: ReadyItem[];
  nouveau: ReadyItem[];
} {
  const enCours = readyItems.filter((i) => i.status === "en_cours").sort(byEarliestAirDate);
  const aVoir = readyItems.filter((i) => i.status === "a_voir").sort(byEarliestAirDate);

  if (enCours.length) {
    return { hero: enCours[0], reprendre: enCours.slice(1), nouveau: aVoir };
  }
  if (aVoir.length) {
    return { hero: aVoir[0], reprendre: [], nouveau: aVoir.slice(1) };
  }
  return { hero: null, reprendre: [], nouveau: [] };
}

/**
 * Groups strictly-future episodes (air_date > today) by exact calendar day,
 * within a fixed window. Episodes of the same show + season sharing the exact
 * same air_date are collapsed into a single "drop" entry.
 */
export function groupUpcomingByDay(
  episodes: ScheduleEpisode[],
  today: string,
  windowDays = 90,
): DayGroup[] {
  const windowEnd = addDaysToDateString(today, windowDays);
  const byDate = new Map<string, ScheduleEpisode[]>();

  for (const ep of episodes) {
    if (!ep.air_date) continue;
    if (ep.air_date <= today || ep.air_date > windowEnd) continue;
    const arr = byDate.get(ep.air_date) ?? [];
    arr.push(ep);
    byDate.set(ep.air_date, arr);
  }

  const groups: DayGroup[] = [];
  for (const [date, eps] of byDate) {
    const bySeasonShow = new Map<string, ScheduleEpisode[]>();
    for (const ep of eps) {
      const key = `${ep.show.id}:${ep.season_number}`;
      const arr = bySeasonShow.get(key) ?? [];
      arr.push(ep);
      bySeasonShow.set(key, arr);
    }

    const entries: UpcomingEntry[] = [];
    for (const group of bySeasonShow.values()) {
      const sorted = [...group].sort(byEpisodeOrder);
      if (sorted.length >= 2) {
        entries.push({
          type: "drop",
          show: sorted[0].show,
          seasonNumber: sorted[0].season_number,
          episodes: sorted,
          count: sorted.length,
        });
      } else {
        entries.push({ type: "single", show: sorted[0].show, episode: sorted[0] });
      }
    }
    entries.sort((a, b) => a.show.title.localeCompare(b.show.title));
    groups.push({ date, entries });
  }

  groups.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return groups;
}

/** Splits day groups into DEMAIN / CETTE SEMAINE (J+2..J+7) / PLUS TARD (J+8..window). */
export function bucketUpcoming(dayGroups: DayGroup[], today: string): UpcomingBuckets {
  const tomorrow = addDaysToDateString(today, 1);
  const weekEnd = addDaysToDateString(today, 7);

  const demain: DayGroup[] = [];
  const cetteSemaine: DayGroup[] = [];
  const plusTard: DayGroup[] = [];

  for (const group of dayGroups) {
    if (group.date === tomorrow) demain.push(group);
    else if (group.date <= weekEnd) cetteSemaine.push(group);
    else plusTard.push(group);
  }

  return { demain, cetteSemaine, plusTard };
}

/** Total number of upcoming entries across all day groups (used for empty-state dispatch). */
export function countUpcomingEntries(dayGroups: DayGroup[]): number {
  return dayGroups.reduce((sum, g) => sum + g.entries.length, 0);
}

/** For the "quelque chose arrive" empty ticket: the single closest future episode. */
export function nextCountdown(
  episodes: ScheduleEpisode[],
  today: string,
): { show: ShowLite; episode: ScheduleEpisode; daysUntil: number } | null {
  let best: ScheduleEpisode | null = null;
  for (const ep of episodes) {
    if (!ep.air_date || ep.air_date <= today) continue;
    if (!best || ep.air_date < best.air_date!) best = ep;
  }
  if (!best) return null;
  return { show: best.show, episode: best, daysUntil: daysBetween(today, best.air_date!) };
}

/** Dispatch logic for the 4 (+1 normal) home states. */
export function resolveHomeState(input: {
  followedActiveCount: number;
  readyCount: number;
  upcomingCount: number;
}): HomeState {
  const { followedActiveCount, readyCount, upcomingCount } = input;
  if (followedActiveCount === 0) return "no_shows";
  if (readyCount === 0 && upcomingCount === 0) return "all_caught_up";
  if (readyCount === 0 && upcomingCount > 0) return "upcoming_only";
  if (readyCount > 0 && upcomingCount === 0) return "ready_only";
  return "normal";
}

/** "En retard · Nj" / "Ce soir" — never the word "à voir" (reserved for the library status). */
export function formatReadyLabel(item: Pick<ReadyItem, "isLate" | "lateDays">): string {
  if (!item.isLate || item.lateDays === 0) return "Ce soir";
  return `En retard · ${item.lateDays}j`;
}

/** "Aujourd'hui" / "Demain" or a short "Lun. 14 juil" style label, computed in UTC to match `today`. */
export function formatUpcomingDayLabel(dateStr: string, today: string): string {
  if (dateStr === today) return "Aujourd'hui";
  if (dateStr === addDaysToDateString(today, 1)) return "Demain";
  const label = toUtcDate(dateStr).toLocaleDateString("fr-FR", {
    timeZone: "UTC",
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
  return capitalize(label);
}

/**
 * Split-out date parts for the /calendar screen's "counter module" day
 * header (`CalendarDayHeader`): the day-of-month on its own (for the square
 * module) plus weekday/month separately (stacked to the right of it) —
 * unlike `formatUpcomingDayLabel`, which returns one combined string for the
 * plain-text label used elsewhere (Home rails, /calendar's own previous
 * label). Deliberately reuses `toUtcDate`/`capitalize` rather than
 * re-parsing the date string, and mirrors `formatUpcomingDayLabel`'s
 * "today" special-case (no weekday/month shown at all for today, just the
 * word "Aujourd'hui") rather than introducing a different rule.
 */
export type DayLabelParts =
  | { isToday: true; dayNumber: string }
  | { isToday: false; dayNumber: string; weekday: string; month: string };

export function getDayLabelParts(dateStr: string, today: string): DayLabelParts {
  const date = toUtcDate(dateStr);
  const dayNumber = String(date.getUTCDate());

  if (dateStr === today) {
    return { isToday: true, dayNumber };
  }

  const weekday = capitalize(
    date.toLocaleDateString("fr-FR", { timeZone: "UTC", weekday: "short" }),
  );
  const month = capitalize(date.toLocaleDateString("fr-FR", { timeZone: "UTC", month: "short" }));
  return { isToday: false, dayNumber, weekday, month };
}

/**
 * --- Full bidirectional timeline (dedicated /calendar screen) ---
 *
 * Unlike `groupUpcomingByDay` (Home teaser: future-only, "drop" aggregation),
 * the timeline shows one row per episode, spans past + future, and never
 * aggregates same-day/same-season episodes into a summary — every episode of
 * followed shows stays individually visible while scrolling back in time.
 */

export type TimelineEpisode = ScheduleEpisode & { watched: boolean };

export type TimelineDayGroup = {
  date: string;
  /** `date === today` — used to force-render this group even when empty. */
  isToday: boolean;
  /** `date <= today` — drives the `saturated` visual treatment + watched badge eligibility. */
  isPastOrToday: boolean;
  episodes: TimelineEpisode[];
};

function byShowTitleThenEpisodeOrder(a: ScheduleEpisode, b: ScheduleEpisode) {
  const titleCmp = a.show.title.localeCompare(b.show.title);
  if (titleCmp !== 0) return titleCmp;
  return byEpisodeOrder(a, b);
}

/**
 * Groups episodes by exact calendar day across an arbitrary [today - past,
 * today + future] range, one row per episode (no "drop" aggregation). Days
 * without any episode are omitted, except `today` itself which is always
 * included (possibly empty) so the timeline has a stable anchor point to
 * scroll to on mount.
 */
export function buildTimelineDayGroups(
  episodes: ScheduleEpisode[],
  watchedEpisodeIds: ReadonlySet<number>,
  today: string,
): TimelineDayGroup[] {
  const byDate = new Map<string, ScheduleEpisode[]>();

  for (const ep of episodes) {
    if (!ep.air_date) continue;
    const arr = byDate.get(ep.air_date) ?? [];
    arr.push(ep);
    byDate.set(ep.air_date, arr);
  }
  if (!byDate.has(today)) byDate.set(today, []);

  const groups: TimelineDayGroup[] = [];
  for (const [date, eps] of byDate) {
    const sorted = [...eps].sort(byShowTitleThenEpisodeOrder);
    groups.push({
      date,
      isToday: date === today,
      isPastOrToday: date <= today,
      episodes: sorted.map((e) => ({ ...e, watched: watchedEpisodeIds.has(e.id) })),
    });
  }

  groups.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return groups;
}

/**
 * --- /calendar "Semaine" grid view ---
 *
 * Unlike `buildTimelineDayGroups` (vertical list: omits empty non-today days,
 * force-inserts an empty "today" group even outside the queried window), the
 * week grid renders a FIXED 7-column layout — every day of the week must be
 * present, empty or not, and a day outside the displayed week (e.g. "today"
 * while browsing a different week) must never sneak in. Hence a dedicated
 * builder rather than reusing `buildTimelineDayGroups` with post-filtering.
 */

/** Monday (ISO/FR week start) of the week containing `dateStr`. */
export function getMondayOfWeek(dateStr: string): string {
  const date = toUtcDate(dateStr);
  // getUTCDay(): 0 = Sunday .. 6 = Saturday. Distance back to Monday: Sunday
  // is 6 days after the previous Monday, every other day is (dow - 1).
  const dow = date.getUTCDay();
  const offsetFromMonday = dow === 0 ? 6 : dow - 1;
  return addDaysToDateString(dateStr, -offsetFromMonday);
}

/** The 7 calendar dates of the week starting at `weekStart` (Monday..Sunday). */
export function getWeekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysToDateString(weekStart, i));
}

/**
 * Groups episodes into exactly 7 day-columns (Monday..Sunday) for the week
 * starting at `weekStart` — every date in `getWeekDates(weekStart)` gets a
 * group, empty or not, in date order. `episodes` is expected to already be
 * scoped to this week by the caller (the data layer fetches a bounded
 * [weekStart, weekStart+6] window); any episode outside that range is
 * ignored defensively rather than trusted to shape the output. Same
 * episode-level granularity as the Agenda timeline — never aggregates
 * same-day/same-season episodes into a "drop" summary.
 */
export function buildWeekDayGroups(
  episodes: ScheduleEpisode[],
  watchedEpisodeIds: ReadonlySet<number>,
  weekStart: string,
  today: string,
): TimelineDayGroup[] {
  const weekDates = getWeekDates(weekStart);
  const weekDateSet = new Set(weekDates);

  const byDate = new Map<string, ScheduleEpisode[]>();
  for (const ep of episodes) {
    if (!ep.air_date || !weekDateSet.has(ep.air_date)) continue;
    const arr = byDate.get(ep.air_date) ?? [];
    arr.push(ep);
    byDate.set(ep.air_date, arr);
  }

  return weekDates.map((date) => {
    const sorted = [...(byDate.get(date) ?? [])].sort(byShowTitleThenEpisodeOrder);
    return {
      date,
      isToday: date === today,
      isPastOrToday: date <= today,
      episodes: sorted.map((e) => ({ ...e, watched: watchedEpisodeIds.has(e.id) })),
    };
  });
}
