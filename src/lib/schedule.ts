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
 * season total — guards against the hero ticket's progress bar looking
 * falsely close to 100% for a long-hiatus season. The Home screen's
 * `episodes` fetch caps the future at J+90 (see index.tsx), so a season
 * still airing with episodes announced further out than that would have its
 * `total` silently undercounted by `computeSeasonTally` (which only ever
 * sees what got fetched). `officialEpisodeCount` is TMDb's own per-season
 * count (the `seasons.episode_count` cache column, fetched separately —
 * see index.tsx — only for the hero's own season, a single cheap row
 * lookup): the tally is only reliable once it has caught up to that
 * official count. `null`/`undefined` (not yet known, or the season row
 * isn't cached) is treated as unreliable — fail safe, never fail loud.
 * `0` is treated the same way: a season legitimately has at least one
 * episode by the time a hero ticket can point at it, so `episode_count = 0`
 * only ever means "not populated yet" in the `seasons` cache, never a real
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
function daysSinceLastWatch(
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

/**
 * "aujourd'hui" / "demain" / "dans Nj" — vocabulaire de référence du
 * countdown, extrait à l'identique de `NextEpisodeCard` (fiche série,
 * `show.$mediaType.$tmdbId.tsx`) pour que la Home (`NothingNowCountdownTicket`,
 * `empty-states.tsx`) et la fiche partagent la même formulation plutôt que
 * deux implémentations qui redivergeraient silencieusement. Volontairement
 * "j" abrégé, jamais "jours" — aligné caractère pour caractère sur la fiche.
 * Suppose `daysUntil >= 0` (aucun clamp défensif ici) : les deux appelants
 * actuels le garantissent déjà — `nextCountdown` ci-dessus ne considère que
 * des épisodes strictement futurs (`daysUntil` toujours >= 1 en pratique),
 * et `NextEpisodeCard` clampe son propre calcul via `Math.max(0, ...)` avant
 * d'appeler cette fonction.
 */
export function formatCountdownLabel(daysUntil: number): string {
  if (daysUntil === 0) return "aujourd'hui";
  if (daysUntil === 1) return "demain";
  return `dans ${daysUntil} j`;
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
  nouveau: ReadyItem[];
  readyCount: number;
  dayGroups: DayGroup[];
  upcomingCount: number;
  countdown: ReturnType<typeof nextCountdown>;
  raw: HomeRawInputs;
};

/**
 * Derives the "À voir maintenant" part of `HomeData` (hero + heroProgress +
 * reprendre + nouveau + readyCount) from `HomeRawInputs` — the exact same
 * pipeline the Home screen's `queryFn` runs on initial load, factored out so
 * `useMarkWatched`'s `onMutate` can re-run it locally against an optimistic
 * `watchedEpisodeIds` (current watched set + the episode just tapped) instead
 * of hand-rolling a shortcut that would risk diverging from `selectHero`'s
 * actual rotation rules (freshness thresholds, en_cours > a_voir priority,
 * last-resort fallback, etc.).
 *
 * Deliberately does NOT touch `dayGroups`/`upcomingCount`/`countdown`
 * ("Programme à venir"): `groupUpcomingByDay` and `nextCountdown` only ever
 * consider `air_date > today` and take no watched-set input at all, so
 * marking a past/today episode watched cannot affect them — callers should
 * carry those three fields over unchanged from the previous `HomeData`.
 */
export function deriveHomeView(
  raw: HomeRawInputs,
  today: string,
): Pick<HomeData, "hero" | "heroProgress" | "reprendre" | "nouveau" | "readyCount"> {
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

  return { hero, heroProgress, reprendre, nouveau, readyCount: ready.length };
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
 * "En retard · Nj" / "Ce soir" — never the word "à voir" (reserved for the
 * library status). Degrades as the backlog ages rather than staying in days
 * forever: 1-6j shows the day count, 7-29j switches to a week count, and
 * 30j+ shows nothing at all (no "Prêt", no filler word — callers must treat
 * `null` as "omit this line entirely"). Whatever the bucket, the caller's
 * styling stays amber (`text-primary`), never red — this function only
 * decides the text, never a color.
 */
export function formatReadyLabel(item: Pick<ReadyItem, "isLate" | "lateDays">): string | null {
  if (!item.isLate || item.lateDays === 0) return "Ce soir";
  if (item.lateDays < 7) return `En retard · ${item.lateDays}j`;
  if (item.lateDays < 30) {
    const weeks = Math.max(1, Math.floor(item.lateDays / 7));
    return `En retard · ${weeks} sem`;
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
