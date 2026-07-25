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
  backdrop_path: string | null;
};

export type EpisodeLite = {
  id: number;
  season_number: number;
  episode_number: number;
  title: string | null;
  air_date: string | null; // "YYYY-MM-DD" (Postgres date, no time)
  still_path?: string | null;
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
 * Watched/total tally for one show's one season — used to feed the hero
 * ticket's optional progress fraction (`HeroTicket`'s `progress` prop in
 * src/routes/_public/index.tsx). Mirrors the season-tally formula already
 * inline in `buildLibraryProgress` below (filter by `season_number`, count
 * watched vs length), extracted as its own tiny helper rather than reusing
 * `buildLibraryProgress` itself — that function is scoped to "next episode
 * across the whole show", which the hero already knows independently
 * (`ReadyItem.nextEpisode`), and its existing, well-tested behavior is left
 * untouched here to avoid any risk of regressing the library grid.
 */
export function computeSeasonTally(
  episodes: ScheduleEpisode[],
  watchedEpisodeIds: ReadonlySet<number>,
  showId: number,
  seasonNumber: number,
): { watched: number; total: number } {
  const seasonEpisodes = episodes.filter(
    (e) => e.show.id === showId && e.season_number === seasonNumber,
  );
  const watched = seasonEpisodes.filter((e) => watchedEpisodeIds.has(e.id)).length;
  return { watched, total: seasonEpisodes.length };
}

/**
 * Whether a `computeSeasonTally` result can be trusted as a *complete*
 * season total — guards against a progress bar/chip looking falsely close
 * to 100% for a long-hiatus season. The Home screen's `episodes` fetch caps
 * the future at J+90 (see index.tsx), so a season still airing with
 * episodes announced further out than that would have its `total` silently
 * undercounted by `computeSeasonTally` (which only ever sees what got
 * fetched). `officialEpisodeCount` is TMDb's own per-season count (the
 * `seasons.episode_count` cache column, fetched separately — see
 * index.tsx — for the hero's own season AND, since Étage 2.2, for each
 * visible "Reprendre" row's own season too, see `seasonCountKey`): the
 * tally is only reliable once it has caught up to that official count.
 * `null`/`undefined` (not yet known, or the season row isn't cached) is
 * treated as unreliable — fail safe, never fail loud. `0` is treated the
 * same way: a season legitimately has at least one episode by the time a
 * hero/Reprendre row can point at it, so `episode_count = 0` only ever
 * means "not populated yet" in the `seasons` cache, never a real
 * zero-episode season — trusting it would have let a tally of `{ total: 0 }`
 * through as "reliable" by pure coincidence (`0 >= 0`).
 */
export function isSeasonTallyReliable(
  tally: { total: number },
  officialEpisodeCount: number | null | undefined,
): boolean {
  return (
    officialEpisodeCount != null && officialEpisodeCount > 0 && tally.total >= officialEpisodeCount
  );
}

/**
 * Composite key for the `seasons.episode_count` cache used to reliability-
 * check a season tally OUTSIDE the hero (which uses a single scalar,
 * `heroSeasonEpisodeCount` — it only ever needs one season at a time). A
 * plain string (not a nested Map) so it can flow through `HomeRawInputs` as
 * a simple `ReadonlyMap<string, number>`, cheaply serializable/comparable,
 * and trivial to carry unchanged through `useMarkWatched`'s optimistic
 * recompute (see `recomputeFromBatch`).
 */
export function seasonCountKey(showId: number, seasonNumber: number): string {
  return `${showId}:${seasonNumber}`;
}

/**
 * Season watched/total tally for each visible "Reprendre" row (its OWN
 * current season, i.e. `item.nextEpisode.season_number` — mirrors the
 * hero's own season-scoped progress, `heroProgress`) — feeds the
 * `VhsCounter` "grid" chip on `ReadyListItem` (Étage 2.2 of the Home
 * refonte: progression saison en cours, pas le total série).
 *
 * A show is present in the returned map ONLY when its tally is reliable
 * (`isSeasonTallyReliable`) — same fail-safe behavior as the hero's
 * `heroProgress` (`null` when unreliable): the caller must treat a missing
 * entry as "no fraction to show yet" rather than rendering a falsely-low
 * tally. This also means a show whose `nextEpisode` just rolled over to a
 * NEW season (e.g. right after marking its previous season finale watched)
 * naturally has no entry until the next server refetch populates
 * `seasonEpisodeCounts` for that new `(showId, seasonNumber)` pair — no
 * explicit "reset on rotation" needed here, unlike the hero's own
 * `heroSeasonEpisodeCount`/`heroKeyOf` bookkeeping in `use-mark-watched.ts`:
 * looking up a key that was never fetched is already indistinguishable from
 * "not yet known" by construction.
 */
export function computeReprendreProgress(
  reprendreItems: readonly ReadyItem[],
  episodes: ScheduleEpisode[],
  watchedEpisodeIds: ReadonlySet<number>,
  seasonEpisodeCounts: ReadonlyMap<string, number>,
): ReadonlyMap<number, { watched: number; total: number }> {
  const result = new Map<number, { watched: number; total: number }>();
  for (const item of reprendreItems) {
    const tally = computeSeasonTally(
      episodes,
      watchedEpisodeIds,
      item.show.id,
      item.nextEpisode.season_number,
    );
    const officialCount = seasonEpisodeCounts.get(
      seasonCountKey(item.show.id, item.nextEpisode.season_number),
    );
    if (isSeasonTallyReliable(tally, officialCount)) {
      result.set(item.show.id, tally);
    }
  }
  return result;
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
  /**
   * Season number of the most recently AIRED episode, one entry per known
   * show — including shows that ARE caught up (no `progressByShowId` entry).
   * Feeds the library grid's "à jour" chip (e.g. "S03 · À jour"), which
   * still needs to name a season even though there's no *next* episode to
   * point at. Absent for a show with zero aired episodes (defensive — not
   * expected for an `en_cours` show, but left unset rather than guessed).
   */
  caughtUpSeasonByShowId: ReadonlyMap<number, number>;
  /**
   * Unwatched, already-aired episodes across the WHOLE show (all seasons) —
   * one entry per known show, including caught-up ones (0). Powers the
   * library's "Progression (bientôt fini d'abord)" sort, which needs a
   * series-wide backlog size rather than `LibraryProgressEntry`'s
   * current-season-only tally. Free to compute here: `episodes` already
   * holds every season for shows in this scope (see the caller's "no time
   * window" query, needed for `nextEpisode` resolution below), so this adds
   * no extra fetch.
   */
  seriesRemainingByShowId: ReadonlyMap<number, number>;
} {
  const groups = new Map<number, ScheduleEpisode[]>();
  for (const ep of episodes) {
    const arr = groups.get(ep.show.id) ?? [];
    arr.push(ep);
    groups.set(ep.show.id, arr);
  }

  const knownShowIds = new Set(groups.keys());
  const progressByShowId = new Map<number, LibraryProgressEntry>();
  const caughtUpSeasonByShowId = new Map<number, number>();
  const seriesRemainingByShowId = new Map<number, number>();

  for (const [showId, eps] of groups) {
    const sorted = [...eps].sort(byEpisodeOrder);
    const aired = sorted.filter((e) => !!e.air_date && e.air_date <= today);
    if (aired.length) {
      caughtUpSeasonByShowId.set(showId, aired[aired.length - 1].season_number);
    }
    seriesRemainingByShowId.set(showId, aired.filter((e) => !watchedEpisodeIds.has(e.id)).length);

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

  return { knownShowIds, progressByShowId, caughtUpSeasonByShowId, seriesRemainingByShowId };
}

function byEarliestAirDate(a: ReadyItem, b: ReadyItem) {
  if (a.earliestAirDate !== b.earliestAirDate) {
    return a.earliestAirDate < b.earliestAirDate ? -1 : 1;
  }
  return a.show.title.localeCompare(b.show.title);
}

/**
 * Aggregates `watch_status.watched_at` into "most recent watch per show".
 * Takes rows that already carry `show_id` directly (resolved server-side via
 * a join — see the home screen's dedicated recency query in
 * src/routes/_public/index.tsx) rather than resolving `episode_id -> show_id`
 * through the (air_date-scoped) `episodes` array: an earlier version did the
 * latter, which silently dropped any watched episode whose cached `air_date`
 * is unknown (NULL) — common right after a CSV/Betaseries import that has no
 * per-episode date — making a show watched yesterday look "dormant" simply
 * because the episode that proves it has no known air date. Decoupling from
 * `air_date` entirely fixes this at the root instead of patching around it.
 */
export function buildLastWatchedAtByShow(
  watchedRows: ReadonlyArray<{ show_id: number; watched_at: string }>,
): ReadonlyMap<number, string> {
  const result = new Map<number, string>();
  for (const row of watchedRows) {
    const prev = result.get(row.show_id);
    // Compared as actual instants, not strings — Postgres/Supabase can
    // serialize timestamptz with varying fractional-second precision, which
    // would break a naive lexicographic string comparison.
    if (!prev || new Date(row.watched_at).getTime() > new Date(prev).getTime()) {
      result.set(row.show_id, row.watched_at);
    }
  }
  return result;
}

/** A show with no `watch_status` row at all reads as "not stale" (no negative signal), never as "60j+/30j+ dormant". */
export function daysSinceLastWatch(
  showId: number,
  today: string,
  lastWatchedAtByShowId: ReadonlyMap<number, string>,
): number | null {
  const lastWatchedAt = lastWatchedAtByShowId.get(showId);
  if (!lastWatchedAt) return null;
  return daysBetween(lastWatchedAt.slice(0, 10), today);
}

/** An `en_cours` show untouched for this many days can no longer win the hero slot (see `selectHero`). */
export const HERO_STALE_DAYS = 60;

/** An `en_cours` show untouched for this many days drops out of the visible "Reprendre" rows into `reprendreDormant` (see `selectHero`). */
export const LIST_STALE_DAYS = 30;

/**
 * Library "En cours" tab split (Actif / En pause) — same freshness rule and
 * threshold (`LIST_STALE_DAYS`) as `selectHero`'s `reprendre`/`reprendreDormant`
 * split, exposed standalone here because the library needs it for EVERY
 * `en_cours` show (hero included), not just the non-hero ones Home renders.
 * A show with no watch history at all is never dormant (same reasoning as
 * `daysSinceLastWatch` and `selectHero`).
 */
export function splitEnCoursByFreshness(
  showIds: readonly number[],
  today: string,
  lastWatchedAtByShowId: ReadonlyMap<number, string>,
): { active: number[]; dormant: number[] } {
  const active: number[] = [];
  const dormant: number[] = [];
  for (const showId of showIds) {
    const days = daysSinceLastWatch(showId, today, lastWatchedAtByShowId);
    if (days !== null && days >= LIST_STALE_DAYS) dormant.push(showId);
    else active.push(showId);
  }
  return { active, dormant };
}

/**
 * Hero selection rule: among `en_cours` shows not stale for the hero slot
 * (see `HERO_STALE_DAYS`), the one with the oldest ready backlog always wins
 * over any `a_voir` show, no matter how much older the `a_voir` show's
 * backlog is. Falls back to the oldest `a_voir` item when there is no fresh
 * `en_cours` candidate, and — only when neither exists — falls back to the
 * oldest `en_cours` item even if it IS stale, rather than ever leaving
 * `hero` null while `readyItems` is non-empty: the 60j guard is a
 * *preference* for a fresher show, never an absolute exclusion that could
 * leave Zone A completely blank.
 *
 * Beyond the hero, the remaining `en_cours` shows split into `reprendre`
 * (last watched < `LIST_STALE_DAYS`) and `reprendreDormant` (>=
 * `LIST_STALE_DAYS`) — the Home screen only ever renders `reprendre`
 * (capped to 3 rows + a "Voir tout" link), `reprendreDormant` is only
 * reachable through the library. A show with no watch history at all is
 * never dormant, same reasoning as the hero guard. Note the two thresholds
 * are independent: a hero picked from the 30-59j band is still fresh enough
 * to win the hero slot, it just wouldn't also show up in `reprendre` if it
 * *hadn't* won hero — no double-counting either way since the hero is
 * always excluded from both `reprendre` and `reprendreDormant`.
 */
export function selectHero(
  readyItems: ReadyItem[],
  today: string,
  lastWatchedAtByShowId: ReadonlyMap<number, string>,
): {
  hero: ReadyItem | null;
  reprendre: ReadyItem[];
  reprendreDormant: ReadyItem[];
  nouveau: ReadyItem[];
} {
  const enCours = readyItems.filter((i) => i.status === "en_cours").sort(byEarliestAirDate);
  const aVoir = readyItems.filter((i) => i.status === "a_voir").sort(byEarliestAirDate);

  const daysSince = (item: ReadyItem) =>
    daysSinceLastWatch(item.show.id, today, lastWatchedAtByShowId);
  const isHeroStale = (item: ReadyItem) => {
    const days = daysSince(item);
    return days !== null && days >= HERO_STALE_DAYS;
  };
  const freshEnCours = enCours.filter((i) => !isHeroStale(i));

  let hero: ReadyItem | null = null;
  if (freshEnCours.length) {
    hero = freshEnCours[0];
  } else if (aVoir.length) {
    hero = aVoir[0];
  } else if (enCours.length) {
    hero = enCours[0]; // last-resort fallback — see doc comment above.
  }

  const reprendre: ReadyItem[] = [];
  const reprendreDormant: ReadyItem[] = [];
  for (const item of enCours) {
    if (item.show.id === hero?.show.id) continue; // never duplicate the hero into either list
    const days = daysSince(item);
    if (days !== null && days >= LIST_STALE_DAYS) reprendreDormant.push(item);
    else reprendre.push(item);
  }

  const nouveau =
    hero?.status === "a_voir" ? aVoir.filter((i) => i.show.id !== hero!.show.id) : aVoir;

  return { hero, reprendre, reprendreDormant, nouveau };
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

export type NextReleaseItem = {
  show: ShowLite;
  episode: ScheduleEpisode;
  /** Raw YYYY-MM-DD air_date of `episode` — feeds `formatUpcomingDayLabel` for the card's secondary line. */
  date: string;
  daysUntil: number;
};

/**
 * Up to `limit` distinct-by-show upcoming releases (soonest first) — feeds
 * the "prochaine sortie" card(s) rendered directly under the Home hero in the
 * `normal` state (backlog AND a scheduled future episode both present — see
 * `resolveHomeState`/`HomeContent` in index.tsx). Deliberately derived from
 * `dayGroups` (already computed for Zone B/"Programme à venir", itself
 * already future-only and date-sorted via `groupUpcomingByDay`) rather than
 * `episodes` directly — no extra pass over the raw episode list, and no risk
 * of drifting from the exact ordering `bucketUpcoming`/the calendar rails
 * use.
 *
 * A show contributes at most ONE entry — its single soonest upcoming episode
 * — even if it has several future releases scheduled; a "drop" entry (a
 * batch of 2+ episodes of the same show/season landing the same day, see
 * `groupUpcomingByDay`) contributes its first episode in season/episode
 * order (`episodes[0]`, already the earliest of that batch).
 *
 * `excludeShowIds` lets the caller omit the Home hero's own show (see
 * index.tsx's queryFn) — the hero already dominates that show's slot as
 * "à voir maintenant"; repeating it here as "dans Nj" would read as
 * redundant/confusing rather than as a genuinely different upcoming release.
 * `hero` is always `null` in the `upcoming_only` state (no ready backlog at
 * all), so callers passing `hero ? new Set([hero.show.id]) : undefined`
 * naturally end up with no exclusion there — no special-casing needed.
 *
 * Also the SOLE selection function behind the Home's "Bientôt" teaser in
 * BOTH the `normal` state (capped at 2: 1 big + 1 compact card, alongside
 * the hero/backlog) and the `upcoming_only` state (capped higher, ~5: this
 * IS the primary content of the screen there) — the caller picks `limit`
 * per state (see `HomeScreen`'s queryFn). Deliberately NOT two separate
 * selection functions for what is conceptually the same "what's coming up
 * for each show" concept — an earlier revision had a second, parallel
 * function (`nextUpcomingPerShow`/`UpcomingShowNext`) for the `upcoming_only`
 * empty state; it has been retired in favor of this single function to
 * avoid two selection algorithms (and two rendering templates) for the same
 * idea drifting apart silently.
 */
export function selectNextReleases(
  dayGroups: DayGroup[],
  today: string,
  options: { limit?: number; excludeShowIds?: ReadonlySet<number> } = {},
): NextReleaseItem[] {
  const { limit = 2, excludeShowIds } = options;
  const seenShowIds = new Set<number>();
  const result: NextReleaseItem[] = [];

  for (const group of dayGroups) {
    if (result.length >= limit) break;
    for (const entry of group.entries) {
      if (result.length >= limit) break;
      const showId = entry.show.id;
      if (excludeShowIds?.has(showId)) continue;
      if (seenShowIds.has(showId)) continue;
      seenShowIds.add(showId);
      const episode = entry.type === "drop" ? entry.episodes[0] : entry.episode;
      result.push({
        show: entry.show,
        episode,
        date: group.date,
        daysUntil: daysBetween(today, group.date),
      });
    }
  }

  return result;
}

/**
 * "aujourd'hui" / "demain" / "Nj" — vocabulaire de référence du countdown
 * partagé par les cartes "prochaine sortie" de la Home (`NextReleaseCard`,
 * `NextReleaseHeroCard`), pensé pour un pill compact plutôt qu'une phrase :
 * "2 j" / "demain" / "aujourd'hui", volontairement sans "dans" (retiré —
 * wording validé en revue design) et avec "j" abrégé, jamais "jours".
 *
 * PAS partagé avec la fiche série : `UpcomingSchedule`
 * (`show.$mediaType.$tmdbId.tsx`) a sa PROPRE fonction locale
 * `formatCountdown`, indépendante de celle-ci, qui affiche toujours "Dans
 * 2j"/"Demain"/"Aujourd'hui" (capitalisé, avec "dans") — un vocabulaire
 * délibérément différent pour une carte plus phrasée que le pill compact de
 * la Home. Les deux ont chacune leur propre garantie `daysUntil >= 0`
 * (`selectNextReleases` ici, `Math.max(0, ...)` côté fiche) mais ne
 * s'appellent jamais l'une l'autre — à ne pas présenter comme "extrait à
 * l'identique" dans un futur commentaire, ce n'est pas le cas.
 */
export function formatCountdownLabel(daysUntil: number): string {
  if (daysUntil === 0) return "aujourd'hui";
  if (daysUntil === 1) return "demain";
  return `${daysUntil} j`;
}

/**
 * Raw scheduling inputs behind the Home screen's derived view (`HomeData`
 * below) — everything `deriveHomeView` needs to re-run `buildReadyItems` /
 * `selectHero` / `computeSeasonTally` from scratch. Kept alongside the
 * already-derived fields (rather than discarded after the initial fetch) so
 * `useMarkWatched`'s `onMutate` can recompute the Home view locally
 * (optimistic "advance in place" / hero rotation) without duplicating any of
 * that logic — see `deriveHomeView`.
 */
export type HomeRawInputs = {
  episodes: ScheduleEpisode[];
  showStatusByShowId: ReadonlyMap<number, ActiveStatus>;
  lastWatchedAtByShowId: ReadonlyMap<number, string>;
  watchedEpisodeIds: ReadonlySet<number>;
  /**
   * TMDb's official `episode_count` for the CURRENT hero's own (showId,
   * seasonNumber) only — fed to `isSeasonTallyReliable`. `null` when unknown
   * (not yet fetched, or the recomputed hero points at a different show/
   * season than the one this count was fetched for — see `deriveHomeView`).
   */
  heroSeasonEpisodeCount: number | null;
  /**
   * TMDb's official `episode_count` (same `seasons` cache column as
   * `heroSeasonEpisodeCount`, see `seasonCountKey`) for every visible
   * "Reprendre" row's OWN current season — Étage 2.2 (progression saison en
   * cours sur "Reprendre", `computeReprendreProgress`). A missing key means
   * "not yet fetched for this (show, season) pair" — the affected row simply
   * shows no fraction until the next server refetch, no explicit reset
   * needed (see `computeReprendreProgress`'s doc comment). Only ever
   * populated for the rows actually rendered (`REPRENDRE_VISIBLE_COUNT`,
   * index.tsx) — never for the full, unsliced `reprendre` list.
   */
  reprendreSeasonEpisodeCounts: ReadonlyMap<string, number>;
};

/**
 * Full Home screen query data (`["home-schedule", user.id]`). `raw` is an
 * internal bag, never read directly by render code (`HomeContent`,
 * `HeroTicket`, etc. only ever read the derived fields above it) — it exists
 * solely to let `useMarkWatched` recompute this same shape optimistically.
 */
export type HomeData = {
  today: string;
  followedActiveCount: number;
  hero: ReadyItem | null;
  /** Hero's current-season watched/total, when computable — see `HeroTicket`'s `progress` prop. */
  heroProgress: { watched: number; total: number } | null;
  reprendre: ReadyItem[];
  /** Season watched/total tally per visible "Reprendre" row, when reliable — see `computeReprendreProgress`. Feeds `ReadyListItem`'s `VhsCounter` "grid" chip. */
  reprendreProgressByShowId: ReadonlyMap<number, { watched: number; total: number }>;
  nouveau: ReadyItem[];
  readyCount: number;
  dayGroups: DayGroup[];
  upcomingCount: number;
  /**
   * Up to `limit` distinct-by-show upcoming releases (hero's own show
   * excluded when there is one) — see `selectNextReleases`. Rendered under a
   * shared "Bientôt" section in BOTH the `normal` state (capped at 2,
   * alongside the hero/backlog) and the `upcoming_only` state (capped
   * higher, ~5 — the primary content of the screen there). The caller
   * (`HomeScreen`'s queryFn) picks `limit` per state.
   */
  nextReleases: NextReleaseItem[];
  raw: HomeRawInputs;
};

/**
 * Derives the "À voir maintenant" part of `HomeData` (hero + heroProgress +
 * reprendre + reprendreProgressByShowId + nouveau + readyCount) from
 * `HomeRawInputs` — the exact same pipeline the Home screen's `queryFn` runs
 * on initial load, factored out so `useMarkWatched`'s `onMutate` can re-run
 * it locally against an optimistic `watchedEpisodeIds` (current watched set
 * + the episode just tapped) instead of hand-rolling a shortcut that would
 * risk diverging from `selectHero`'s actual rotation rules (freshness
 * thresholds, en_cours > a_voir priority, last-resort fallback, etc.).
 *
 * Deliberately does NOT touch `dayGroups`/`upcomingCount`/`nextReleases`
 * ("Programme à venir" / "Bientôt"): `groupUpcomingByDay` and
 * `selectNextReleases` only ever consider `air_date > today` and take no
 * watched-set input at all, so marking a past/today episode watched cannot
 * affect them — callers should carry those fields over unchanged from the
 * previous `HomeData`.
 */
export function deriveHomeView(
  raw: HomeRawInputs,
  today: string,
): Pick<
  HomeData,
  "hero" | "heroProgress" | "reprendre" | "reprendreProgressByShowId" | "nouveau" | "readyCount"
> {
  const ready = buildReadyItems(raw.episodes, raw.watchedEpisodeIds, raw.showStatusByShowId, today);
  const { hero, reprendre, nouveau } = selectHero(ready, today, raw.lastWatchedAtByShowId);

  let heroProgress: { watched: number; total: number } | null = null;
  if (hero) {
    const tally = computeSeasonTally(
      raw.episodes,
      raw.watchedEpisodeIds,
      hero.show.id,
      hero.nextEpisode.season_number,
    );
    heroProgress = isSeasonTallyReliable(tally, raw.heroSeasonEpisodeCount) ? tally : null;
  }

  const reprendreProgressByShowId = computeReprendreProgress(
    reprendre,
    raw.episodes,
    raw.watchedEpisodeIds,
    raw.reprendreSeasonEpisodeCounts,
  );

  return {
    hero,
    heroProgress,
    reprendre,
    reprendreProgressByShowId,
    nouveau,
    readyCount: ready.length,
  };
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

/**
 * "Prêt · Nj" / "Ce soir" — never "à voir" (reserved for the library status)
 * nor "en retard" (too anxiety-inducing for what's meant to be a positive
 * "your next episode is ready" signal — wording change validated by the
 * design/product review). Degrades as the backlog ages rather than staying
 * in days forever: 1-6j shows the day count, 7-29j switches to a week count,
 * and 30j+ shows nothing at all (callers must treat `null` as "omit this
 * line entirely" rather than inventing a filler word). Whatever the bucket,
 * the caller's styling stays amber (`text-primary`), never red — this
 * function only decides the text, never a color.
 */
export function formatReadyLabel(item: Pick<ReadyItem, "isLate" | "lateDays">): string | null {
  if (!item.isLate || item.lateDays === 0) return "Ce soir";
  if (item.lateDays < 7) return `Prêt · ${item.lateDays}j`;
  if (item.lateDays < 30) {
    const weeks = Math.max(1, Math.floor(item.lateDays / 7));
    return `Prêt · ${weeks} sem`;
  }
  return null;
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
