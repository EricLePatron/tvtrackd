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

/**
 * Whether an episode's `title` is a placeholder TMDb value carrying no real
 * information beyond the episode number itself — e.g. `"Episode 1"` /
 * `"Épisode 1"` (TMDb falls back to this generic label for episodes it has
 * no real title for yet, commonly recently-added or not-yet-detailed
 * episodes). `null`/empty also counts as generic. Feeds
 * `NextReleaseHeroCard` (both `soon`/`today` variants): the episode-title
 * line is only rendered when this returns `false`, rather than showing a
 * redundant "Épisode 6" right under an already-visible "S02 · E06" line.
 *
 * Deliberately an EXACT match against `episode ${episodeNumber}` /
 * `épisode ${episodeNumber}` (the episode's OWN number, not a loose regex
 * like `/^episode/i`) — a real episode title that happens to start with or
 * contain the word "épisode" (e.g. a title literally about an episode of
 * something else) must never be treated as generic just because it shares
 * that word; only the exact placeholder pattern for THIS episode's own
 * number is filtered out.
 */
export function isGenericEpisodeTitle(title: string | null, episodeNumber: number): boolean {
  if (!title || !title.trim()) return true;
  const normalized = title.trim().toLowerCase();
  return normalized === `episode ${episodeNumber}` || normalized === `épisode ${episodeNumber}`;
}

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

/**
 * IANA zone the app treats as "local" for date-only concepts like `today` —
 * the product is French-market-scoped (see CLAUDE.md), so a fixed zone (not
 * the visitor's own device/browser zone, and not the server's host zone
 * either) keeps "aujourd'hui" consistent for every user and on both the
 * client and any server-side evaluation, regardless of where either happens
 * to be physically/deployment-wise.
 */
export const HOME_TIMEZONE = "Europe/Paris";

/**
 * Civil date (`YYYY-MM-DD`) of `date` as observed in `timeZone` — the
 * fuseau-aware replacement for `new Date().toISOString().slice(0, 10)`
 * (always UTC), which made "today" wrong for 1-2 hours after local midnight
 * for any zone ahead of UTC — e.g. Europe/Paris, in BOTH its CET (UTC+1,
 * winter) and CEST (UTC+2, summer) offsets. Built via
 * `Intl.DateTimeFormat(...).formatToParts` and assembled manually rather than
 * relying on a specific locale's default string shape (e.g. hoping "en-CA"
 * always formats as `YYYY-MM-DD`) — explicit part assembly is robust to any
 * ICU/locale-data differences between environments (browser vs. Node/SSR).
 * Callers still hand the result to the existing `toUtcMs`/`daysBetween`
 * family below as a plain `YYYY-MM-DD` string — those stay UTC-parsers of a
 * date string, unchanged; only the ANCHOR `today` value itself becomes
 * Europe/Paris-aware.
 */
export function getTodayInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
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
 * Ranks `en_cours` ReadyItems by *watch* recency (most recently watched
 * first) — the primary sort for the hero slot among fresh candidates (see
 * `selectHero`), and also for `reprendre`/`reprendreDormant` (Option A:
 * "Reprendre" reads as a continue-watching list, consistent with the hero).
 *
 * A show with a known `lastWatchedAt` always outranks one with none at all —
 * an actual watch (even a fairly old one, as long as it's still
 * hero-fresh-eligible) is a stronger "currently watching" signal than "never
 * touched". When neither item has a known `lastWatchedAt` (both fresh,
 * never-watched `en_cours` shows — e.g. just flagged `en_cours` with no
 * `watch_status` row yet), OR the two timestamps are exactly equal instants
 * (e.g. a burst of concurrent optimistic mark-watched taps that stamps
 * several shows with the identical `now()` — see `recomputeFromBatch` in
 * `use-mark-watched.ts`), falls back to `byEarliestAirDate` (oldest backlog
 * first, then title) — the OLD backlog-based rule, preserved here as a
 * deterministic tie-break rather than dropped.
 */
function compareByHeroRecency(lastWatchedAtByShowId: ReadonlyMap<number, string>) {
  return (a: ReadyItem, b: ReadyItem) => {
    const aTime = lastWatchedAtByShowId.get(a.show.id);
    const bTime = lastWatchedAtByShowId.get(b.show.id);
    if (aTime && bTime) {
      const diff = new Date(bTime).getTime() - new Date(aTime).getTime();
      if (diff !== 0) return diff;
      return byEarliestAirDate(a, b);
    }
    if (aTime && !bTime) return -1;
    if (!aTime && bTime) return 1;
    return byEarliestAirDate(a, b);
  };
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
 * (see `HERO_STALE_DAYS`), the one *most recently watched* wins — see
 * `compareByHeroRecency` — always over any `a_voir` show, no matter how old
 * or recent the `a_voir` show's backlog is (an `a_voir` show has no watch
 * history to rank by definition — it hasn't been started yet). This
 * replaced an earlier "oldest ready backlog wins" rule: ranking by backlog
 * age alone could pin the hero on a show whose oldest unwatched episode is
 * years stale while a show the user is actively bingeing right now sits one
 * slot down (e.g. an old, long-abandoned rewatch backlog outranking a show
 * watched yesterday) — recency of the last actual watch is what the hero is
 * meant to represent ("what am I watching right now"); backlog age now only
 * survives as `compareByHeroRecency`'s deterministic tie-break for shows
 * with no comparable watch-recency signal.
 *
 * Falls back to the oldest `a_voir` item (by backlog age, `byEarliestAirDate`
 * — recency doesn't apply, there is no watch history yet) when there is no
 * fresh `en_cours` candidate, and — only when neither exists — falls back to
 * the oldest `en_cours` item by backlog age even if it IS stale, rather than
 * ever leaving `hero` null while `readyItems` is non-empty: the 60j guard is
 * a *preference* for a fresher show, never an absolute exclusion that could
 * leave Zone A completely blank. Both fallback branches deliberately stay on
 * `byEarliestAirDate` rather than `compareByHeroRecency`: recency is only a
 * meaningful primary signal among the fresh `en_cours` set the hero rule
 * cares about — once we're already in a fallback branch there's no
 * "currently watching" candidate left to rank by recency in the first place.
 *
 * Beyond the hero, the remaining `en_cours` shows are ALSO ranked by
 * `compareByHeroRecency` (not `byEarliestAirDate`) before splitting into
 * `reprendre` (last watched < `LIST_STALE_DAYS`) and `reprendreDormant` (>=
 * `LIST_STALE_DAYS`) — "Reprendre" reads as a continue-watching list, most
 * recently watched first, consistent with how the hero itself is now picked.
 * The Home screen only ever renders `reprendre` (capped to 3 rows + a "Voir
 * tout" link, see index.tsx's `REPRENDRE_VISIBLE_COUNT`) — this ranking
 * directly decides WHICH 3 shows are visible there, not just their order.
 * `reprendreDormant` is only reachable through the library. A show with no
 * watch history at all is never dormant, same reasoning as the hero guard.
 * Note the two thresholds are independent: a hero picked from the 30-59j
 * band is still fresh enough to win the hero slot, it just wouldn't also
 * show up in `reprendre` if it *hadn't* won hero — no double-counting either
 * way since the hero is always excluded from both `reprendre` and
 * `reprendreDormant`.
 *
 * ASSUMED CONSEQUENCE — DO NOT "FIX" WITHOUT PRODUCT SIGN-OFF: tapping the
 * episode of ANY fresh `en_cours` show (not just the current hero's own —
 * this includes a visible "Reprendre" row) can promote that show to hero
 * IMMEDIATELY, because `useMarkWatched`'s optimistic `recomputeFromBatch`
 * (`src/hooks/use-mark-watched.ts`) bumps the tapped show's
 * `lastWatchedAtByShowId` entry to `now()`, and `now()` will essentially
 * always outrank any other show's real (historical) watch timestamp under
 * `compareByHeroRecency`. This is a deliberate, product-validated
 * consequence of "hero = what I'm watching right now" (Option A / "Direction
 * A" of the hero-recency rework), not an accidental side effect — see the
 * `[Direction A]`-tagged tests in `src/hooks/use-mark-watched.test.ts` for
 * the exact promotion/demotion behavior this produces. A future change that
 * tries to make a non-hero show's tap "never touch the hero" would be
 * reverting this decision, not fixing a bug.
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
  // Sorted by backlog age (byEarliestAirDate) — kept as-is for the
  // last-resort hero fallback below, which deliberately stays on backlog age
  // rather than recency (see doc comment above).
  const enCours = readyItems.filter((i) => i.status === "en_cours").sort(byEarliestAirDate);
  const aVoir = readyItems.filter((i) => i.status === "a_voir").sort(byEarliestAirDate);

  const daysSince = (item: ReadyItem) =>
    daysSinceLastWatch(item.show.id, today, lastWatchedAtByShowId);
  const isHeroStale = (item: ReadyItem) => {
    const days = daysSince(item);
    return days !== null && days >= HERO_STALE_DAYS;
  };

  // Fresh en_cours shows, ranked by watch recency (most recently watched
  // first) — this is the actual hero ranking. `enCours` itself is left
  // sorted by backlog age (untouched) so the last-resort fallback below
  // (`enCours[0]`) keeps its original semantics.
  const freshEnCours = enCours
    .filter((i) => !isHeroStale(i))
    .sort(compareByHeroRecency(lastWatchedAtByShowId));

  let hero: ReadyItem | null = null;
  if (freshEnCours.length) {
    hero = freshEnCours[0];
  } else if (aVoir.length) {
    hero = aVoir[0];
  } else if (enCours.length) {
    hero = enCours[0]; // last-resort fallback — see doc comment above.
  }

  // Every non-hero en_cours show, ranked by the SAME watch-recency rule as
  // the hero (Option A — see doc comment above), then split active/dormant.
  const enCoursByRecency = [...enCours].sort(compareByHeroRecency(lastWatchedAtByShowId));
  const reprendre: ReadyItem[] = [];
  const reprendreDormant: ReadyItem[] = [];
  for (const item of enCoursByRecency) {
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
  /**
   * Set when the spotlighted episode is part of a same-day BATCH DROP of its
   * season — see `SeasonDrop`/`computeSeasonDrop`. Left `undefined` for an
   * ordinary single-episode release. Populated by BOTH `selectTodayRelease`
   * ("Sort aujourd'hui") and `selectNextReleases` ("Bientôt") with a
   * provisional `wholeSeason: false`; the caller then confirms `wholeSeason`
   * against the official season count via `resolveNextReleaseDrop`.
   * `selectPremiereSoon` never sets it (a premiere is a single first episode).
   */
  drop?: SeasonDrop;
};

/**
 * A same-day BATCH DROP of a season — 2+ episodes of the same show+season
 * sharing one `air_date` (Netflix/Amazon "toute la saison d'un coup", e.g.
 * Batman: Caped Crusader). `count` = how many dropped that day (surfaced as
 * "N épisodes" only for a PARTIAL drop); `wholeSeason` = true ONLY when the
 * batch is confirmed to be the entire season against TMDb's official
 * per-season count. Deliberately carries NO episode-number range: a drop is
 * shown as its season + a "Saison complète"/"N épisodes" tag, never a
 * `S02·E01–E10` span (design: the range is redundant with the tag and reads
 * as clutter next to it).
 */
export type SeasonDrop = {
  count: number;
  wholeSeason: boolean;
};

/**
 * Describes whether `showId`'s `seasonNumber` had a same-day BATCH DROP on
 * `date` — 2+ of its episodes sharing that exact `air_date` (mirrors
 * `groupUpcomingByDay`'s own `>= 2` "drop" threshold). Returns `undefined`
 * for a lone episode (the common weekly-release case). Feeds
 * `selectTodayRelease`'s "Sort aujourd'hui" drop, the counterpart of the
 * batch info `selectNextReleases` reads straight from `groupUpcomingByDay`.
 *
 * `wholeSeason` is returned as a PROVISIONAL `false` here on purpose: whether
 * the batch is the WHOLE season can only be told against TMDb's official
 * per-season count (`seasons.episode_count`), NEVER against the episodes
 * present in `episodes` — that list is bounded by the Home fetch (air_date
 * non-null, ≤ today+90), so a season released in several waves (a "Part 1 /
 * Part 2" whose second wave has no announced date yet) has its later episodes
 * missing entirely, and a naive "batch === cached episodes" check would read
 * a half-season drop as a full one. The caller confirms `wholeSeason` against
 * that official count via `resolveNextReleaseDrop`.
 */
export function computeSeasonDrop(
  episodes: ScheduleEpisode[],
  showId: number,
  seasonNumber: number,
  date: string,
): SeasonDrop | undefined {
  let count = 0;
  for (const ep of episodes) {
    if (ep.show.id !== showId || ep.season_number !== seasonNumber) continue;
    if (ep.air_date === date) count++;
  }
  if (count < 2) return undefined;
  return { count, wholeSeason: false };
}

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
      const isDrop = entry.type === "drop";
      const episode = isDrop ? entry.episodes[0] : entry.episode;
      result.push({
        show: entry.show,
        episode,
        date: group.date,
        daysUntil: daysBetween(today, group.date),
        // Batch info comes straight from the day-group's own "drop" entry
        // (2+ same-day episodes of one show+season — `groupUpcomingByDay`'s
        // `>= 2` threshold, identical to this card's). `wholeSeason` stays a
        // provisional `false` here — the reliable check needs TMDb's official
        // per-season count, applied by the caller via `resolveNextReleaseDrop`
        // once that count is fetched (see HomeScreen's queryFn). Left
        // `undefined` for an ordinary single-episode release.
        drop: isDrop ? { count: entry.count, wholeSeason: false } : undefined,
      });
    }
  }

  return result;
}

/**
 * Re-resolves a `NextReleaseItem`'s provisional drop `wholeSeason` (always
 * `false` out of `selectTodayRelease`/`selectNextReleases`, which have no
 * official count on hand) against `officialEpisodeCount` — TMDb's
 * `seasons.episode_count`, fetched by the caller for exactly the shows that
 * have a drop. Uses the SAME `isSeasonTallyReliable` guard as the hero's
 * progress fraction (`heroProgress`, `deriveHomeView`) so "Saison complète"
 * is verified against the official count on BOTH drop surfaces ("Sort
 * aujourd'hui" and "Bientôt"). A no-op (returns the item unchanged) when it
 * has no drop; fails safe to `wholeSeason: false` when the count is unknown.
 */
export function resolveNextReleaseDrop(
  item: NextReleaseItem,
  officialEpisodeCount: number | null | undefined,
): NextReleaseItem {
  if (!item.drop) return item;
  return {
    ...item,
    drop: {
      ...item.drop,
      wholeSeason: isSeasonTallyReliable({ total: item.drop.count }, officialEpisodeCount),
    },
  };
}

/**
 * Coarse backlog-size tier for the "Sort aujourd'hui" ranking — 0 / 1-2 / 3+
 * — rather than the raw count, so a show with 1 vs. 2 stale unwatched
 * episodes doesn't out-rank on that alone; the NEXT tie-break
 * (`daysSinceLastWatch`, see `compareEventCandidates`) decides within the
 * same tier instead of the raw count doing it too eagerly.
 */
function backlogBucket(count: number): number {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  return 2;
}

/**
 * Number of already-aired, unwatched episodes of `showId` strictly BEFORE
 * `today` (the `<` comparison structurally excludes `today`'s own episode) —
 * the "priorBacklogCount" ranking signal for `selectTodayRelease`: a show the
 * user is caught up on (0) ranks ahead of one with a growing pile of
 * unwatched older episodes, even though both have a ready episode today.
 */
function countPriorBacklog(
  episodes: ScheduleEpisode[],
  watchedEpisodeIds: ReadonlySet<number>,
  showId: number,
  today: string,
): number {
  let count = 0;
  for (const ep of episodes) {
    if (ep.show.id !== showId) continue;
    if (!ep.air_date || ep.air_date >= today) continue;
    if (watchedEpisodeIds.has(ep.id)) continue;
    count++;
  }
  return count;
}

/**
 * Shared ranking comparator behind "Sort aujourd'hui" (`selectTodayRelease`)
 * and "Nouvelle saison" (`selectPremiereSoon`) — always starts with (1)
 * `priorBacklogCount` bucket ascending (see `backlogBucket`, "à jour" always
 * wins) and always ends with a final show-title tie-break for full
 * determinism. The middle two tiers — (a) `daysSinceLastWatch` ascending,
 * `null` (never watched) sorted LAST, and (b) the caller's own `statusRank`
 * (lower ranks first) — run in a caller-chosen ORDER, via
 * `options.statusBeforeRecency`:
 *
 * - `false` (default) — recency BEFORE status: "Sort aujourd'hui"'s order
 *   (bucket -> recency -> status -> title), UNCHANGED from Lot 1. Recency is
 *   a meaningful signal there because every candidate is `a_voir`/`en_cours`
 *   and typically HAS a real `lastWatchedAtByShowId` entry.
 * - `true` — status BEFORE recency: "Nouvelle saison"'s order (bucket ->
 *   status -> recency -> title), needed because `termine` candidates NEVER
 *   have a `lastWatchedAtByShowId` entry (see `selectPremiereSoon`'s doc
 *   comment) — putting recency first would make the confirmed
 *   `termine > en_cours > a_voir` ranking unreachable in the common case (a
 *   real recency signal would always outrank `termine`'s structural `null`
 *   before the status tier is ever consulted). With status promoted ahead,
 *   recency is demoted to a late tie-break — still useful among candidates
 *   that share BOTH a backlog bucket AND a status (e.g. two `en_cours`
 *   candidates), just never able to override the status ranking itself.
 *
 * Generic over the candidate's status type so callers with different status
 * sets (`ActiveStatus` for "Sort aujourd'hui", the wider `PremiereStatus` for
 * "Nouvelle saison") both reuse this unchanged.
 */
function compareEventCandidates<S extends string>(
  lastWatchedAtByShowId: ReadonlyMap<number, string>,
  today: string,
  statusRank: (status: S) => number,
  options: { statusBeforeRecency?: boolean } = {},
) {
  const { statusBeforeRecency = false } = options;

  const compareByRecency = (a: { show: ShowLite }, b: { show: ShowLite }): number => {
    const aDays = daysSinceLastWatch(a.show.id, today, lastWatchedAtByShowId);
    const bDays = daysSinceLastWatch(b.show.id, today, lastWatchedAtByShowId);
    if (aDays === bDays) return 0;
    if (aDays === null) return 1;
    if (bDays === null) return -1;
    return aDays - bDays;
  };

  const compareByStatus = (a: { status: S }, b: { status: S }): number =>
    statusRank(a.status) - statusRank(b.status);

  return (
    a: { show: ShowLite; status: S; priorBacklogCount: number },
    b: { show: ShowLite; status: S; priorBacklogCount: number },
  ): number => {
    const bucketDiff = backlogBucket(a.priorBacklogCount) - backlogBucket(b.priorBacklogCount);
    if (bucketDiff !== 0) return bucketDiff;

    const [firstCmp, secondCmp] = statusBeforeRecency
      ? [compareByStatus(a, b), compareByRecency(a, b)]
      : [compareByRecency(a, b), compareByStatus(a, b)];
    if (firstCmp !== 0) return firstCmp;
    if (secondCmp !== 0) return secondCmp;

    return a.show.title.localeCompare(b.show.title);
  };
}

/**
 * Single "spotlight" pick among TODAY's ready-and-unwatched episodes across
 * followed (`a_voir`/`en_cours`) shows — feeds the Home's "Sort aujourd'hui"
 * card (`TodayReleaseBlock`, index.tsx). NOT a new category layered on top of
 * `buildReadyItems`: an episode airing today is already `air_date <= today`,
 * so it's already counted in `readyCount` and already surfaces via the
 * hero/Reprendre/À commencer lists — this is a highlighted DUPLICATE of the
 * single best "airs today" candidate among those, ranked by
 * `compareEventCandidates` (`en_cours` before `a_voir` as the status
 * tie-break). A direct consequence: this can only ever return non-null when
 * `readyCount > 0` (there is no `air_date === today` case where
 * `buildReadyItems` wouldn't already have picked it up), i.e. only in the
 * Home's `normal`/`ready_only` states — never `no_shows`/`all_caught_up`/
 * `upcoming_only`.
 *
 * `excludeShowIds` mirrors `selectNextReleases`'s own option — the Home
 * queryFn passes the hero's own show, so "Sort aujourd'hui" never repeats
 * what's already dominating Zone A as the hero.
 *
 * Only ever one candidate per show, even if (rare) a show drops 2+ episodes
 * the same day — episodes are sorted by `byEpisodeOrder` BEFORE dedup, so the
 * pick is always that show's earliest episode of the day, deterministically
 * (Postgres/PostgREST give no ordering guarantee among rows sharing the same
 * `air_date`).
 */
export function selectTodayRelease(
  episodes: ScheduleEpisode[],
  watchedEpisodeIds: ReadonlySet<number>,
  showStatusByShowId: ReadonlyMap<number, ActiveStatus>,
  lastWatchedAtByShowId: ReadonlyMap<number, string>,
  today: string,
  options: { excludeShowIds?: ReadonlySet<number> } = {},
): NextReleaseItem | null {
  const { excludeShowIds } = options;

  const todaysEpisodes = episodes
    .filter((ep) => ep.air_date === today && !watchedEpisodeIds.has(ep.id))
    .sort(byEpisodeOrder);

  const seenShowIds = new Set<number>();
  const candidates: {
    show: ShowLite;
    episode: ScheduleEpisode;
    status: ActiveStatus;
    priorBacklogCount: number;
  }[] = [];
  for (const episode of todaysEpisodes) {
    const showId = episode.show.id;
    if (excludeShowIds?.has(showId)) continue;
    if (seenShowIds.has(showId)) continue;
    const status = showStatusByShowId.get(showId);
    if (!status) continue; // not a followed (a_voir/en_cours) show
    seenShowIds.add(showId);
    candidates.push({
      show: episode.show,
      episode,
      status,
      priorBacklogCount: countPriorBacklog(episodes, watchedEpisodeIds, showId, today),
    });
  }

  if (!candidates.length) return null;

  candidates.sort(
    compareEventCandidates<ActiveStatus>(lastWatchedAtByShowId, today, (status) =>
      status === "en_cours" ? 0 : 1,
    ),
  );

  const winner = candidates[0];
  const drop = computeSeasonDrop(episodes, winner.show.id, winner.episode.season_number, today);
  return { show: winner.episode.show, episode: winner.episode, date: today, daysUntil: 0, drop };
}

/** Status of a "Première bientôt" candidate — wider than `ActiveStatus`: includes `termine` (a finished show whose new season is about to premiere), the canonical case this block exists for. `abandonne`/`archive` are structurally excluded — the caller only ever feeds this from the `a_voir`/`en_cours` fetch plus a dedicated `termine`-only fetch (see index.tsx's queryFn), never the other two statuses. */
export type PremiereStatus = ActiveStatus | "termine";

/**
 * Single "spotlight" pick among upcoming SEASON PREMIERES (`episode_number
 * === 1`, strictly future `air_date`) of shows the user has AT LEAST
 * started — feeds the Home's "Nouvelle saison" card (`PremiereSoonBlock`,
 * index.tsx). Two source pools, passed in already pre-filtered by the caller
 * (this function does no Supabase-shaped filtering itself):
 *
 * - `activeEpisodes` — the SAME `a_voir`/`en_cours` episodes fetch already
 *   used everywhere else on the Home screen (see index.tsx). Eligibility:
 *   `lastWatchedAtByShowId.has(showId)` — the show has been watched at
 *   least once. This is what excludes a NEVER-STARTED `a_voir` show (added
 *   to the library but never actually watched) — its premiere isn't
 *   "returning", it's just another upcoming release, already covered by
 *   "Bientôt"/`selectNextReleases`. `priorBacklogCount` (same definition as
 *   `selectTodayRelease`'s) naturally distinguishes "caught up, ready for
 *   the new season" from "still behind on the current one".
 * - `termineEpisodes` — a SEPARATE, minimal fetch (show id + season-1
 *   episodes only, no accompanying `watch_status` query) for shows marked
 *   `termine`. Eligibility is unconditional (a `termine` show is by
 *   definition fully watched) and `priorBacklogCount` is ASSUMED `0` by
 *   construction, never computed from `activeEpisodes` (which structurally
 *   can't contain a `termine` show's episodes — that fetch is scoped to
 *   `a_voir`/`en_cours` — nor from `termineEpisodes`, which was never
 *   fetched with that intent: no re-verification of `watch_status` for
 *   `termine` shows, by design, to avoid a third full episodes+watched
 *   fetch just for this one edge case).
 *
 * Ranked by the SAME `compareEventCandidates` machinery as
 * `selectTodayRelease`, but with `options.statusBeforeRecency: true` — a
 * DIFFERENT tier order: (1) `priorBacklogCount` bucket ascending, "à jour"
 * always preferred — (2) `statusRank`, widened here to `termine` (0) >
 * `en_cours` (1) > `a_voir` (2) — (3) `daysSinceLastWatch` ascending, `null`
 * sorted last, as a LATE tie-break only — (4) show title.
 *
 * Status is deliberately promoted ahead of recency here (unlike
 * `selectTodayRelease`, which keeps recency ahead of status — see
 * `compareEventCandidates`'s doc comment for why both orders coexist):
 * `termine` shows NEVER get a `lastWatchedAtByShowId` entry (index.tsx's
 * queryFn runs no recency query for them at all), so a `null` recency signal
 * is a STRUCTURAL property of every `termine` candidate, not a sign of low
 * engagement — ranking recency ahead of status would have made the
 * confirmed `termine > en_cours > a_voir` ordering unreachable in the common
 * case (an eligible `a_voir`/`en_cours` competitor's real recency signal
 * would always win first). With status promoted, recency still meaningfully
 * breaks ties WITHIN the same bucket+status (e.g. two `en_cours`
 * candidates), it just never overrides the status ranking itself.
 *
 * `excludeShowIds` mirrors `selectTodayRelease`'s own option — the Home
 * queryFn passes the hero's own show. Only ONE candidate per show (a show
 * can't appear in both pools at once — `user_shows.status` is exclusive), no
 * de-dup pass needed beyond that.
 */
export function selectPremiereSoon(
  activeEpisodes: ScheduleEpisode[],
  termineEpisodes: ScheduleEpisode[],
  watchedEpisodeIds: ReadonlySet<number>,
  showStatusByShowId: ReadonlyMap<number, ActiveStatus>,
  lastWatchedAtByShowId: ReadonlyMap<number, string>,
  today: string,
  options: { excludeShowIds?: ReadonlySet<number> } = {},
): NextReleaseItem | null {
  const { excludeShowIds } = options;

  const candidates: {
    show: ShowLite;
    episode: ScheduleEpisode;
    status: PremiereStatus;
    priorBacklogCount: number;
  }[] = [];

  for (const episode of activeEpisodes) {
    if (episode.episode_number !== 1) continue;
    if (!episode.air_date || episode.air_date <= today) continue;
    const showId = episode.show.id;
    if (excludeShowIds?.has(showId)) continue;
    const status = showStatusByShowId.get(showId);
    if (!status) continue; // not a followed (a_voir/en_cours) show
    if (!lastWatchedAtByShowId.has(showId)) continue; // never started — excluded
    candidates.push({
      show: episode.show,
      episode,
      status,
      priorBacklogCount: countPriorBacklog(activeEpisodes, watchedEpisodeIds, showId, today),
    });
  }

  for (const episode of termineEpisodes) {
    if (episode.episode_number !== 1) continue;
    if (!episode.air_date || episode.air_date <= today) continue;
    const showId = episode.show.id;
    if (excludeShowIds?.has(showId)) continue;
    candidates.push({
      show: episode.show,
      episode,
      status: "termine",
      priorBacklogCount: 0, // assumed by construction — see doc comment above
    });
  }

  if (!candidates.length) return null;

  const statusRank: Record<PremiereStatus, number> = { termine: 0, en_cours: 1, a_voir: 2 };
  candidates.sort(
    compareEventCandidates<PremiereStatus>(
      lastWatchedAtByShowId,
      today,
      (status) => statusRank[status],
      { statusBeforeRecency: true },
    ),
  );

  const winner = candidates[0];
  return {
    show: winner.episode.show,
    episode: winner.episode,
    date: winner.episode.air_date!,
    daysUntil: daysBetween(today, winner.episode.air_date!),
  };
}

/**
 * "aujourd'hui" / "demain" / "Nj" — vocabulaire de référence du countdown
 * utilisé par le pill de la carte "prochaine sortie" de la Home
 * (`NextReleaseHeroCard`, seul gabarit du bloc "Bientôt" depuis le passage à
 * `limit: 1`), pensé pour un pill compact plutôt qu'une phrase :
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
  /**
   * Single spotlight pick among today's ready, unwatched episodes — see
   * `selectTodayRelease`'s doc comment. `null` whenever there's nothing
   * airing exactly today among followed shows (the overwhelmingly common
   * case) — the caller (`HomeContent`) treats `null` as "render no
   * 'Sort aujourd'hui' block", never a placeholder.
   */
  todayRelease: NextReleaseItem | null;
  /**
   * Single spotlight pick among upcoming season premieres of shows the user
   * has at least started — see `selectPremiereSoon`'s doc comment. `null`
   * whenever there's no eligible premiere scheduled (the common case) — the
   * caller (`HomeContent`) treats `null` as "render no 'Nouvelle saison'
   * block", never a placeholder. Unlike `hero`/`todayRelease`, this is NOT
   * recomputed by `useMarkWatched`'s optimistic patch (`recomputeFromBatch`)
   * — a season premiere is always a strictly future episode, structurally
   * unaffected by marking a past/today episode watched, same reasoning as
   * `nextReleases`/`dayGroups` (Zone B) — carried over unchanged via
   * `...prevHome`.
   */
  premiereSoon: NextReleaseItem | null;
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
