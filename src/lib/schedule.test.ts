import { describe, expect, it } from "vitest";
import {
  buildLastWatchedAtByShow,
  buildLibraryProgress,
  buildReadyItems,
  computeReprendreProgress,
  computeSeasonTally,
  deriveHomeView,
  formatCountdownLabel,
  formatReadyLabel,
  getDayLabelParts,
  getTodayInTimeZone,
  groupUpcomingByDay,
  HERO_STALE_DAYS,
  isSeasonTallyReliable,
  seasonCountKey,
  selectHero,
  selectNextReleases,
  selectPremiereSoon,
  selectTodayRelease,
  splitEnCoursByFreshness,
  type ActiveStatus,
  type HomeRawInputs,
  type ReadyItem,
  type ScheduleEpisode,
  type ShowLite,
} from "./schedule";

const show = (id: number, title = `Show ${id}`): ShowLite => ({
  id,
  tmdb_id: id,
  media_type: "tv",
  title,
  poster_path: null,
  backdrop_path: null,
});

function ep(
  showRef: ShowLite,
  id: number,
  season_number: number,
  episode_number: number,
  air_date: string | null,
): ScheduleEpisode {
  return {
    id,
    season_number,
    episode_number,
    title: `S${season_number}E${episode_number}`,
    air_date,
    show: showRef,
  };
}

const TODAY = "2026-07-08";

describe("buildLibraryProgress", () => {
  it("picks the first aired, unwatched episode in season/episode order as nextEpisode", () => {
    const s = show(1);
    const episodes = [
      ep(s, 101, 1, 1, "2026-01-01"),
      ep(s, 102, 1, 2, "2026-01-08"),
      ep(s, 103, 1, 3, "2026-01-15"),
    ];
    const watched = new Set([101]);

    const { progressByShowId } = buildLibraryProgress(episodes, watched, TODAY);

    expect(progressByShowId.get(1)?.nextEpisode.id).toBe(102);
  });

  it("resolves season/episode order over air-date order across concurrently airing seasons", () => {
    // S1E10 aired long ago and is still unwatched; S2E1 aired more recently
    // (closer to `today`) but must NOT win — season/episode order always
    // takes priority over air-date recency, matching buildReadyItems and
    // firstUnwatched elsewhere in the app.
    const s = show(1);
    const episodes = [ep(s, 110, 1, 10, "2025-01-01"), ep(s, 201, 2, 1, "2026-07-01")];
    const watched = new Set<number>();

    const { progressByShowId } = buildLibraryProgress(episodes, watched, TODAY);

    expect(progressByShowId.get(1)?.nextEpisode.id).toBe(110);
  });

  it("reports 'caught up' (no progress entry) when the season is fully watched but the show isn't finished", () => {
    const s = show(1);
    const episodes = [
      ep(s, 101, 3, 1, "2026-01-01"),
      ep(s, 102, 3, 2, "2026-01-08"),
      // Season 4 not aired yet (air_date in the future / unknown).
      ep(s, 401, 4, 1, "2026-12-01"),
    ];
    const watched = new Set([101, 102]);

    const { knownShowIds, progressByShowId } = buildLibraryProgress(episodes, watched, TODAY);

    expect(knownShowIds.has(1)).toBe(true);
    expect(progressByShowId.has(1)).toBe(false);
  });

  it("never selects an episode with an unknown air_date, even if unwatched", () => {
    const s = show(1);
    const episodes = [
      ep(s, 101, 1, 1, "2026-01-01"),
      ep(s, 102, 1, 2, null), // unknown air date, unwatched
    ];
    const watched = new Set([101]);

    const { progressByShowId } = buildLibraryProgress(episodes, watched, TODAY);

    // Episode 102 can never become "next" (matches firstUnwatched/buildReadyItems
    // behavior elsewhere) — the show reads as caught up instead of pointing at
    // an episode with no known air date.
    expect(progressByShowId.has(1)).toBe(false);
  });

  it("never selects a future (not-yet-aired) episode as nextEpisode", () => {
    const s = show(1);
    const episodes = [ep(s, 101, 1, 1, "2026-12-25")];
    const watched = new Set<number>();

    const { progressByShowId } = buildLibraryProgress(episodes, watched, TODAY);

    expect(progressByShowId.has(1)).toBe(false);
  });

  it("scopes the watched/total tally to nextEpisode's season only, not the whole series", () => {
    const s = show(1);
    const episodes = [
      ep(s, 101, 1, 1, "2026-01-01"),
      ep(s, 102, 1, 2, "2026-01-08"),
      ep(s, 201, 2, 1, "2026-02-01"),
      ep(s, 202, 2, 2, "2026-02-08"),
      ep(s, 203, 2, 3, "2026-02-15"),
    ];
    // Season 1 fully watched, season 2 partially watched — nextEpisode should
    // land in season 2, and the tally must only count season 2 episodes.
    const watched = new Set([101, 102, 201]);

    const { progressByShowId } = buildLibraryProgress(episodes, watched, TODAY);
    const entry = progressByShowId.get(1);

    expect(entry?.nextEpisode.id).toBe(202);
    expect(entry?.seasonWatched).toBe(1);
    expect(entry?.seasonTotal).toBe(3);
  });

  it("ignores watch_count/rewatch magnitude — presence in the watched set is enough to skip an episode", () => {
    const s = show(1);
    const episodes = [ep(s, 101, 1, 1, "2026-01-01"), ep(s, 102, 1, 2, "2026-01-08")];
    // A rewatch only ever adds/updates a row for an ALREADY watched episode;
    // buildLibraryProgress only cares about set membership, never a count.
    const watched = new Set([101]);

    const { progressByShowId } = buildLibraryProgress(episodes, watched, TODAY);

    expect(progressByShowId.get(1)?.nextEpisode.id).toBe(102);
  });

  it("keeps shows independent — one show's data never leaks into another's tally", () => {
    const s1 = show(1);
    const s2 = show(2);
    const episodes = [
      ep(s1, 101, 1, 1, "2026-01-01"),
      ep(s1, 102, 1, 2, "2026-01-08"),
      ep(s2, 901, 1, 1, "2026-01-01"),
    ];
    const watched = new Set([101, 901]);

    const { progressByShowId } = buildLibraryProgress(episodes, watched, TODAY);

    expect(progressByShowId.get(1)?.nextEpisode.id).toBe(102);
    expect(progressByShowId.has(2)).toBe(false); // show 2's single episode is watched -> caught up
  });

  it("excludes shows with no cached episode data from knownShowIds entirely", () => {
    const s = show(1);
    const episodes = [ep(s, 101, 1, 1, "2026-01-01")];
    const watched = new Set<number>();

    const { knownShowIds } = buildLibraryProgress(episodes, watched, TODAY);

    expect(knownShowIds.has(1)).toBe(true);
    expect(knownShowIds.has(999)).toBe(false); // show never opened / no episodes cached
  });

  it("still resolves the correct nextEpisode when only the tail of a season/episode-sorted list is truncated", () => {
    // Documents why the library.tsx episodes query orders by
    // season_number/episode_number: if PostgREST's default row cap ever
    // truncates the payload, dropping the tail of a sorted list only removes
    // later (already-caught-up or not-yet-relevant) episodes, never the
    // early, still-unwatched one that nextEpisode must resolve to.
    const s = show(1);
    const fullSeasonSortedEpisodes = [
      ep(s, 101, 1, 1, "2026-01-01"),
      ep(s, 102, 1, 2, "2026-01-08"),
      ep(s, 103, 1, 3, "2026-01-15"),
      ep(s, 201, 2, 1, "2026-02-01"),
      ep(s, 202, 2, 2, "2026-02-08"),
    ];
    // Simulates a row-cap truncation that cuts the tail of the sorted list.
    const truncated = fullSeasonSortedEpisodes.slice(0, 3);
    const watched = new Set([101]);

    const { progressByShowId } = buildLibraryProgress(truncated, watched, TODAY);

    expect(progressByShowId.get(1)?.nextEpisode.id).toBe(102);
    expect(progressByShowId.get(1)?.seasonTotal).toBe(3);
  });

  it("caughtUpSeasonByShowId names the season of the most recently aired episode, even when caught up", () => {
    const s = show(1);
    const episodes = [
      ep(s, 101, 1, 1, "2026-01-01"),
      ep(s, 102, 1, 2, "2026-01-08"),
      ep(s, 201, 2, 1, "2026-07-01"), // aired, watched — still the "current" season
      ep(s, 202, 2, 2, "2026-08-01"), // not yet aired
    ];
    const watched = new Set([101, 102, 201]);

    const { progressByShowId, caughtUpSeasonByShowId } = buildLibraryProgress(
      episodes,
      watched,
      TODAY,
    );

    expect(progressByShowId.has(1)).toBe(false); // caught up on everything aired
    expect(caughtUpSeasonByShowId.get(1)).toBe(2);
  });

  it("seriesRemainingByShowId counts unwatched AIRED episodes across every season, not just the current one", () => {
    const s = show(1);
    const episodes = [
      ep(s, 101, 1, 1, "2026-01-01"), // watched
      ep(s, 102, 1, 2, "2026-01-08"), // unwatched, aired
      ep(s, 201, 2, 1, "2026-07-01"), // unwatched, aired
      ep(s, 202, 2, 2, "2026-08-01"), // not yet aired — excluded
    ];
    const watched = new Set([101]);

    const { seriesRemainingByShowId } = buildLibraryProgress(episodes, watched, TODAY);

    expect(seriesRemainingByShowId.get(1)).toBe(2);
  });

  it("seriesRemainingByShowId is 0 for a show fully caught up on aired episodes", () => {
    const s = show(1);
    const episodes = [ep(s, 101, 1, 1, "2026-01-01")];
    const watched = new Set([101]);

    const { seriesRemainingByShowId } = buildLibraryProgress(episodes, watched, TODAY);

    expect(seriesRemainingByShowId.get(1)).toBe(0);
  });
});

describe("getDayLabelParts", () => {
  const TODAY = "2026-07-08"; // a Wednesday

  it("returns the `isToday` variant (day number only, no weekday/month) for today", () => {
    const parts = getDayLabelParts(TODAY, TODAY);

    expect(parts).toEqual({ isToday: true, dayNumber: "8" });
  });

  it("returns day number + capitalized weekday/month for a past date", () => {
    const parts = getDayLabelParts("2026-07-06", TODAY); // a Monday

    expect(parts).toEqual({
      isToday: false,
      dayNumber: "6",
      weekday: "Lun.",
      month: "Juil.",
    });
  });

  it("returns day number + capitalized weekday/month for a future date", () => {
    const parts = getDayLabelParts("2026-07-13", TODAY); // a Monday, next week

    expect(parts).toEqual({
      isToday: false,
      dayNumber: "13",
      weekday: "Lun.",
      month: "Juil.",
    });
  });

  it("does not zero-pad the day number", () => {
    const parts = getDayLabelParts("2026-07-06", TODAY);

    expect(parts.dayNumber).toBe("6");
    expect(parts.dayNumber).not.toBe("06");
  });
});

describe("formatReadyLabel", () => {
  it("returns 'Ce soir' when the item isn't late at all", () => {
    expect(formatReadyLabel({ isLate: false, lateDays: 0 })).toBe("Ce soir");
  });

  it("returns 'Ce soir' when isLate is true but lateDays is 0 (defensive, shouldn't happen in practice)", () => {
    expect(formatReadyLabel({ isLate: true, lateDays: 0 })).toBe("Ce soir");
  });

  it("shows a day count for 1-6j late", () => {
    expect(formatReadyLabel({ isLate: true, lateDays: 1 })).toBe("Prêt · 1j");
    expect(formatReadyLabel({ isLate: true, lateDays: 6 })).toBe("Prêt · 6j");
  });

  it("switches to a week count at the 7j boundary", () => {
    expect(formatReadyLabel({ isLate: true, lateDays: 7 })).toBe("Prêt · 1 sem");
  });

  it("floors to whole weeks within the 7-29j range", () => {
    expect(formatReadyLabel({ isLate: true, lateDays: 13 })).toBe("Prêt · 1 sem");
    expect(formatReadyLabel({ isLate: true, lateDays: 14 })).toBe("Prêt · 2 sem");
    expect(formatReadyLabel({ isLate: true, lateDays: 29 })).toBe("Prêt · 4 sem");
  });

  it("returns null (no label at all) at the 30j boundary and beyond", () => {
    expect(formatReadyLabel({ isLate: true, lateDays: 30 })).toBeNull();
    expect(formatReadyLabel({ isLate: true, lateDays: 90 })).toBeNull();
  });
});

describe("formatCountdownLabel", () => {
  // Vocabulaire du pill compact "prochaine sortie" de la Home
  // (`NextReleaseHeroCard`) — PAS partagé avec la fiche série :
  // `UpcomingSchedule` (show.$mediaType.$tmdbId.tsx) a sa propre fonction
  // locale `formatCountdown`, indépendante, qui affiche toujours
  // "Dans Nj"/"Demain"/"Aujourd'hui" (phrasing volontairement différent,
  // plus complet, pour cette carte-là).
  it('returns "aujourd\'hui" for 0 days', () => {
    expect(formatCountdownLabel(0)).toBe("aujourd'hui");
  });

  it('returns "demain" for 1 day', () => {
    expect(formatCountdownLabel(1)).toBe("demain");
  });

  it('returns "Nj" (abbreviated "j", never "jours", no leading "dans") for 2+ days', () => {
    expect(formatCountdownLabel(2)).toBe("2 j");
    expect(formatCountdownLabel(10)).toBe("10 j");
  });
});

describe("buildLastWatchedAtByShow", () => {
  it("picks the max watched_at per show, not the first/last row in insertion order", () => {
    const watchedRows = [
      { show_id: 1, watched_at: "2026-01-05T10:00:00.000Z" },
      { show_id: 1, watched_at: "2026-06-01T10:00:00.000Z" }, // more recent, inserted last
    ];

    const result = buildLastWatchedAtByShow(watchedRows);

    expect(result.get(1)).toBe("2026-06-01T10:00:00.000Z");
  });

  it("compares timestamps as instants, not as strings, across differing fractional-second precision", () => {
    // A naive lexicographic string comparison would rank the shorter string
    // ("...T10:00:01Z", no fractional seconds) BEFORE "...T10:00:00.500Z"
    // (fractional seconds present) because "1" > "." in ASCII — even though
    // 10:00:01 is chronologically LATER than 10:00:00.5. This must resolve
    // to the true later instant.
    const watchedRows = [
      { show_id: 1, watched_at: "2026-01-05T10:00:00.500Z" },
      { show_id: 1, watched_at: "2026-01-05T10:00:01Z" },
    ];

    const result = buildLastWatchedAtByShow(watchedRows);

    expect(result.get(1)).toBe("2026-01-05T10:00:01Z");
  });

  it("keeps shows independent — one show's watch rows never leak into another's", () => {
    const watchedRows = [
      { show_id: 1, watched_at: "2026-01-05T10:00:00.000Z" },
      { show_id: 2, watched_at: "2026-06-01T10:00:00.000Z" },
    ];

    const result = buildLastWatchedAtByShow(watchedRows);

    expect(result.get(1)).toBe("2026-01-05T10:00:00.000Z");
    expect(result.get(2)).toBe("2026-06-01T10:00:00.000Z");
  });

  it("returns an empty map when there are no watched rows at all", () => {
    const result = buildLastWatchedAtByShow([]);

    expect(result.size).toBe(0);
  });

  it("[M1 regression] counts a show as recently watched even when the watched episode has no known air_date", () => {
    // Fix for M1: the recency signal used to be derived from episode_id ->
    // show_id resolution through the (air_date IS NOT NULL-scoped) `episodes`
    // array fetched for scheduling, which silently dropped any watched
    // episode whose cached air_date is unknown — common right after a CSV/
    // Betaseries import with no per-episode dates. `buildLastWatchedAtByShow`
    // now takes rows that already carry `show_id` directly (resolved via a
    // Supabase join in index.tsx, entirely independent of `air_date`), so
    // there is structurally no way for an unknown air_date to hide a watch
    // from this function anymore — this test documents that guarantee by
    // exercising the exact "just watched, date unknown" shape (a row with no
    // `episodes`/`air_date` involvement at all).
    const watchedRows = [{ show_id: 42, watched_at: "2026-07-07T09:00:00.000Z" }];

    const result = buildLastWatchedAtByShow(watchedRows);

    expect(result.get(42)).toBe("2026-07-07T09:00:00.000Z");
  });
});

describe("selectHero", () => {
  // Builds one ReadyItem per show via the real buildReadyItems (rather than
  // hand-rolling ReadyItem literals) so earliestAirDate/lateDays/isLate stay
  // internally consistent with how the app actually produces them.
  function readyItems(
    shows: { showRef: ShowLite; status: ActiveStatus; episodes: ScheduleEpisode[] }[],
  ) {
    const allEpisodes = shows.flatMap((s) => s.episodes);
    const statusByShowId = new Map<number, ActiveStatus>(
      shows.map((s) => [s.showRef.id, s.status]),
    );
    return buildReadyItems(allEpisodes, new Set(), statusByShowId, TODAY);
  }

  it("prefers a fresh en_cours show over a stale (60j+) one for the hero slot, even with an older backlog", () => {
    const stale = show(1, "Stale Show"); // earliest backlog episode, but abandoned
    const fresh = show(2, "Fresh Show");
    const items = readyItems([
      { showRef: stale, status: "en_cours", episodes: [ep(stale, 101, 1, 1, "2026-01-01")] },
      { showRef: fresh, status: "en_cours", episodes: [ep(fresh, 201, 1, 1, "2026-06-01")] },
    ]);
    const lastWatchedAtByShowId = new Map([
      [1, "2026-04-01T00:00:00.000Z"], // ~98j before TODAY (2026-07-08) -> stale
      [2, "2026-07-01T00:00:00.000Z"], // ~7j before TODAY -> fresh
    ]);

    const { hero, reprendre, reprendreDormant } = selectHero(items, TODAY, lastWatchedAtByShowId);

    expect(hero?.show.id).toBe(2);
    // The stale show is also >=30j dormant here, so it lands in
    // reprendreDormant rather than the visible reprendre list — it doesn't
    // vanish, it's just not one of the 3 visible "Reprendre" rows.
    expect(reprendre).toEqual([]);
    expect(reprendreDormant.map((i) => i.show.id)).toEqual([1]);
  });

  it("treats the exact HERO_STALE_DAYS (60j) boundary as stale (>=, not >), 59j as still fresh", () => {
    const staleAt60 = show(1, "Stale At 60j"); // earliest backlog, but exactly 60j since last watch
    const freshAt59 = show(2, "Fresh At 59j"); // later backlog, but only 59j since last watch
    const items = readyItems([
      {
        showRef: staleAt60,
        status: "en_cours",
        episodes: [ep(staleAt60, 101, 1, 1, "2025-12-01")],
      },
      {
        showRef: freshAt59,
        status: "en_cours",
        episodes: [ep(freshAt59, 201, 1, 1, "2026-01-01")],
      },
    ]);
    const lastWatchedAtByShowId = new Map([
      [1, "2026-05-09T00:00:00.000Z"], // exactly HERO_STALE_DAYS (60j) before TODAY -> stale
      [2, "2026-05-10T00:00:00.000Z"], // exactly 59j before TODAY -> still fresh
    ]);
    expect(HERO_STALE_DAYS).toBe(60); // guards this test against a silent threshold change

    const { hero, reprendreDormant } = selectHero(items, TODAY, lastWatchedAtByShowId);

    expect(hero?.show.id).toBe(2);
    // 60j is also >=30j (LIST_STALE_DAYS), so the stale show lands in
    // reprendreDormant rather than disappearing.
    expect(reprendreDormant.map((i) => i.show.id)).toEqual([1]);
  });

  it("treats a show with no watch_status row at all (lastWatchedAt unknown) as NOT stale", () => {
    const neverWatched = show(1, "Never Watched"); // e.g. just marked en_cours, no watch yet
    const items = readyItems([
      {
        showRef: neverWatched,
        status: "en_cours",
        episodes: [ep(neverWatched, 101, 1, 1, "2026-01-01")],
      },
    ]);

    const { hero } = selectHero(items, TODAY, new Map());

    expect(hero?.show.id).toBe(1);
  });

  it("falls back to the oldest a_voir show when every en_cours candidate is stale", () => {
    const staleEnCours = show(1, "Stale");
    const aVoir = show(2, "A Voir");
    const items = readyItems([
      {
        showRef: staleEnCours,
        status: "en_cours",
        episodes: [ep(staleEnCours, 101, 1, 1, "2026-01-01")],
      },
      { showRef: aVoir, status: "a_voir", episodes: [ep(aVoir, 201, 1, 1, "2026-01-01")] },
    ]);
    const lastWatchedAtByShowId = new Map([[1, "2026-01-01T00:00:00.000Z"]]); // way past 60j

    const { hero, reprendre, reprendreDormant, nouveau } = selectHero(
      items,
      TODAY,
      lastWatchedAtByShowId,
    );

    expect(hero?.show.id).toBe(2);
    // The stale en_cours show doesn't disappear — it's also >=30j dormant,
    // so it lands in reprendreDormant rather than the visible reprendre list.
    expect(reprendre).toEqual([]);
    expect(reprendreDormant.map((i) => i.show.id)).toEqual([1]);
    expect(nouveau).toEqual([]);
  });

  it("never leaves hero null when readyItems is non-empty: falls back to the stale en_cours itself if nothing else qualifies", () => {
    const onlyStaleShow = show(1, "Alone And Stale");
    const items = readyItems([
      {
        showRef: onlyStaleShow,
        status: "en_cours",
        episodes: [ep(onlyStaleShow, 101, 1, 1, "2026-01-01")],
      },
    ]);
    const lastWatchedAtByShowId = new Map([[1, "2026-01-01T00:00:00.000Z"]]); // way past 60j, no other candidate

    const { hero, reprendre } = selectHero(items, TODAY, lastWatchedAtByShowId);

    expect(hero?.show.id).toBe(1);
    expect(reprendre).toEqual([]); // hero isn't duplicated into reprendre
  });

  it("returns hero: null only when readyItems itself is empty", () => {
    const { hero, reprendre, nouveau } = selectHero([], TODAY, new Map());

    expect(hero).toBeNull();
    expect(reprendre).toEqual([]);
    expect(nouveau).toEqual([]);
  });

  it("splits non-hero en_cours shows into active reprendre (<30j) and reprendreDormant (>=30j)", () => {
    // Distinct air_dates (heroShow earliest) so hero selection isn't left to
    // the show-title tie-break — it must unambiguously be the show with the
    // oldest ready backlog among the fresh (<60j) candidates.
    const heroShow = show(1, "Hero");
    const active = show(2, "Active");
    const dormant = show(3, "Dormant");
    const items = readyItems([
      { showRef: heroShow, status: "en_cours", episodes: [ep(heroShow, 101, 1, 1, "2025-12-01")] },
      { showRef: active, status: "en_cours", episodes: [ep(active, 201, 1, 1, "2026-01-15")] },
      { showRef: dormant, status: "en_cours", episodes: [ep(dormant, 301, 1, 1, "2026-02-01")] },
    ]);
    const lastWatchedAtByShowId = new Map([
      [1, "2026-07-07T00:00:00.000Z"], // 1j — freshest, wins hero
      [2, "2026-06-20T00:00:00.000Z"], // ~18j — active
      [3, "2026-05-01T00:00:00.000Z"], // ~68j — dormant
    ]);

    const { hero, reprendre, reprendreDormant } = selectHero(items, TODAY, lastWatchedAtByShowId);

    expect(hero?.show.id).toBe(1);
    expect(reprendre.map((i) => i.show.id)).toEqual([2]);
    expect(reprendreDormant.map((i) => i.show.id)).toEqual([3]);
  });

  it("treats the 30j boundary itself as dormant (>=, not >)", () => {
    const heroShow = show(1, "Hero");
    const boundary = show(2, "Boundary");
    const items = readyItems([
      { showRef: heroShow, status: "en_cours", episodes: [ep(heroShow, 101, 1, 1, "2025-12-01")] },
      {
        showRef: boundary,
        status: "en_cours",
        episodes: [ep(boundary, 201, 1, 1, "2026-01-15")],
      },
    ]);
    // Exactly 30 days before TODAY (2026-07-08).
    const lastWatchedAtByShowId = new Map([
      [1, "2026-07-07T00:00:00.000Z"],
      [2, "2026-06-08T00:00:00.000Z"],
    ]);

    const { reprendre, reprendreDormant } = selectHero(items, TODAY, lastWatchedAtByShowId);

    expect(reprendre).toEqual([]);
    expect(reprendreDormant.map((i) => i.show.id)).toEqual([2]);
  });

  it("never counts a show with no watch history at all as dormant", () => {
    const heroShow = show(1, "Hero");
    const neverWatched = show(2, "Never Watched");
    const items = readyItems([
      { showRef: heroShow, status: "en_cours", episodes: [ep(heroShow, 101, 1, 1, "2025-12-01")] },
      {
        showRef: neverWatched,
        status: "en_cours",
        episodes: [ep(neverWatched, 201, 1, 1, "2026-01-15")],
      },
    ]);
    const lastWatchedAtByShowId = new Map([[1, "2026-07-07T00:00:00.000Z"]]); // show 2 absent entirely

    const { reprendre, reprendreDormant } = selectHero(items, TODAY, lastWatchedAtByShowId);

    expect(reprendre.map((i) => i.show.id)).toEqual([2]);
    expect(reprendreDormant).toEqual([]);
  });

  it("ranks the hero by watch recency, not backlog age (repro: Buffy's ancient backlog loses to Newport Beach watched yesterday)", () => {
    const buffy = show(1, "Buffy"); // oldest ready backlog (2001) but not touched in a while
    const newportBeach = show(2, "Newport Beach"); // newer backlog (2006), watched yesterday
    const items = readyItems([
      { showRef: buffy, status: "en_cours", episodes: [ep(buffy, 101, 6, 1, "2001-01-01")] },
      {
        showRef: newportBeach,
        status: "en_cours",
        episodes: [ep(newportBeach, 201, 1, 1, "2006-01-01")],
      },
    ]);
    const lastWatchedAtByShowId = new Map([
      [1, "2026-05-20T00:00:00.000Z"], // ~49j before TODAY — fresh, but the older watch of the two
      [2, "2026-07-07T00:00:00.000Z"], // 1j before TODAY — most recently watched
    ]);

    const { hero, reprendre } = selectHero(items, TODAY, lastWatchedAtByShowId);

    expect(hero?.show.id).toBe(2); // Newport Beach wins despite Buffy's much older backlog
    expect(reprendre.map((i) => i.show.id)).toEqual([1]); // Buffy is bumped down, not excluded
  });

  it("prefers a fresh en_cours show WITH watch history over one with no history at all, even if the latter's backlog is older", () => {
    const neverWatched = show(1, "Never Watched"); // older backlog, but zero watch_status rows
    const watchedOnce = show(2, "Watched Once"); // newer backlog, but a real (if not-recent) watch
    const items = readyItems([
      {
        showRef: neverWatched,
        status: "en_cours",
        episodes: [ep(neverWatched, 101, 1, 1, "2020-01-01")],
      },
      {
        showRef: watchedOnce,
        status: "en_cours",
        episodes: [ep(watchedOnce, 201, 1, 1, "2026-06-01")],
      },
    ]);
    const lastWatchedAtByShowId = new Map([
      [2, "2026-05-15T00:00:00.000Z"], // ~54j before TODAY — old-ish, but still under HERO_STALE_DAYS (fresh)
    ]);

    const { hero } = selectHero(items, TODAY, lastWatchedAtByShowId);

    expect(hero?.show.id).toBe(2); // real (even old-ish) history outranks no history at all
  });

  it("falls back to backlog age (byEarliestAirDate) when two fresh en_cours shows both have no watch history at all", () => {
    const older = show(1, "Older Backlog"); // no watch_status row
    const newer = show(2, "Newer Backlog"); // no watch_status row either
    const items = readyItems([
      { showRef: older, status: "en_cours", episodes: [ep(older, 101, 1, 1, "2026-01-01")] },
      { showRef: newer, status: "en_cours", episodes: [ep(newer, 201, 1, 1, "2026-02-01")] },
    ]);

    const { hero } = selectHero(items, TODAY, new Map());

    expect(hero?.show.id).toBe(1); // same result as the old backlog-based rule — no regression
  });

  it("falls back to backlog age (byEarliestAirDate) as a deterministic tie-break when two fresh en_cours shows share the exact same lastWatchedAt instant", () => {
    // Mirrors a burst of concurrent optimistic mark-watched taps stamping
    // several shows with the identical `now()` — see `recomputeFromBatch` in
    // use-mark-watched.ts.
    const older = show(1, "Older Backlog");
    const newer = show(2, "Newer Backlog");
    const items = readyItems([
      { showRef: older, status: "en_cours", episodes: [ep(older, 101, 1, 1, "2026-01-01")] },
      { showRef: newer, status: "en_cours", episodes: [ep(newer, 201, 1, 1, "2026-02-01")] },
    ]);
    const sameInstant = "2026-07-07T12:00:00.000Z";
    const lastWatchedAtByShowId = new Map([
      [1, sameInstant],
      [2, sameInstant],
    ]);

    const { hero } = selectHero(items, TODAY, lastWatchedAtByShowId);

    expect(hero?.show.id).toBe(1); // tie-break falls back to the older backlog
  });

  it("[Option A] orders 'reprendre' by watch recency (most recent first), disagreeing with backlog-age order — locks in the new rule, not a coincidence", () => {
    const heroShow = show(1, "Hero");
    const olderBacklog = show(2, "Older Backlog"); // oldest backlog among non-hero shows...
    const newerBacklog = show(3, "Newer Backlog"); // ...but watched more recently than show 2
    const items = readyItems([
      { showRef: heroShow, status: "en_cours", episodes: [ep(heroShow, 101, 1, 1, "2026-06-01")] },
      {
        showRef: olderBacklog,
        status: "en_cours",
        episodes: [ep(olderBacklog, 201, 1, 1, "2025-01-01")], // oldest backlog -> would rank #1 under the old rule
      },
      {
        showRef: newerBacklog,
        status: "en_cours",
        episodes: [ep(newerBacklog, 301, 1, 1, "2026-05-01")],
      },
    ]);
    const lastWatchedAtByShowId = new Map([
      [1, "2026-07-08T00:00:00.000Z"], // today — wins hero
      [2, "2026-06-01T00:00:00.000Z"], // ~37j — watched LEAST recently of the two non-hero shows
      [3, "2026-07-05T00:00:00.000Z"], // ~3j — watched MOST recently, despite the newer (less "late") backlog
    ]);

    const { hero, reprendre } = selectHero(items, TODAY, lastWatchedAtByShowId);

    expect(hero?.show.id).toBe(1);
    // Old rule (byEarliestAirDate) would order this [2, 3] (show 2's backlog
    // is older). New rule (watch recency) orders it [3, 2] instead — this is
    // the assertion that actually distinguishes the two rules.
    expect(reprendre.map((i) => i.show.id)).toEqual([3, 2]);
  });
});

describe("splitEnCoursByFreshness", () => {
  it("mirrors selectHero's active/dormant split (<30j active, >=30j dormant), including the hero's own show id", () => {
    // Unlike selectHero's reprendre/reprendreDormant (which excludes the
    // hero), the library's "En cours" tab needs every en_cours show split,
    // hero included — this is the one behavioral difference from
    // selectHero's split, exercised here.
    const lastWatchedAtByShowId = new Map([
      [1, "2026-07-07T00:00:00.000Z"], // 1j — active
      [2, "2026-06-08T00:00:00.000Z"], // exactly 30j — dormant (boundary)
      [3, "2026-05-01T00:00:00.000Z"], // ~68j — dormant
    ]);

    const { active, dormant } = splitEnCoursByFreshness([1, 2, 3], TODAY, lastWatchedAtByShowId);

    expect(active).toEqual([1]);
    expect(dormant).toEqual([2, 3]);
  });

  it("never counts a show with no watch history at all as dormant", () => {
    const { active, dormant } = splitEnCoursByFreshness([1], TODAY, new Map());

    expect(active).toEqual([1]);
    expect(dormant).toEqual([]);
  });
});

describe("computeSeasonTally", () => {
  it("scopes watched/total to the given show + season only", () => {
    const s1 = show(1);
    const s2 = show(2);
    const episodes = [
      ep(s1, 101, 1, 1, "2026-01-01"),
      ep(s1, 102, 1, 2, "2026-01-08"),
      ep(s1, 201, 2, 1, "2026-02-01"), // different season, same show — excluded
      ep(s2, 901, 1, 1, "2026-01-01"), // different show, same season number — excluded
    ];
    const watched = new Set([101, 201, 901]);

    const result = computeSeasonTally(episodes, watched, 1, 1);

    expect(result).toEqual({ watched: 1, total: 2 });
  });

  it("returns { watched: 0, total: 0 } when the show/season combination isn't present", () => {
    const s = show(1);
    const episodes = [ep(s, 101, 1, 1, "2026-01-01")];

    const result = computeSeasonTally(episodes, new Set(), 1, 99);

    expect(result).toEqual({ watched: 0, total: 0 });
  });

  it("ignores rewatch magnitude — set membership alone counts an episode as watched", () => {
    const s = show(1);
    const episodes = [ep(s, 101, 1, 1, "2026-01-01"), ep(s, 102, 1, 2, "2026-01-08")];
    const watched = new Set([101]);

    const result = computeSeasonTally(episodes, watched, 1, 1);

    expect(result).toEqual({ watched: 1, total: 2 });
  });
});

describe("isSeasonTallyReliable", () => {
  it("[M2] treats the tally as unreliable when the official episode count is unknown (null/undefined)", () => {
    // Fix for M2: the Home screen's `episodes` fetch caps the future at
    // J+90, so a still-airing, long-hiatus season could have its `total`
    // silently undercounted — without a known official count to compare
    // against, we must not claim reliability just because a tally exists.
    expect(isSeasonTallyReliable({ total: 9 }, null)).toBe(false);
    expect(isSeasonTallyReliable({ total: 9 }, undefined)).toBe(false);
  });

  it("treats the tally as unreliable when it hasn't caught up to the official count yet (long-hiatus undercount)", () => {
    // e.g. 9 episodes fetched within the J+90 window, but TMDb says the
    // season has 12 — 3 more are announced further out than the fetch window
    // covers. Showing "9/9 = 100%" here would be exactly the misleading bar
    // M2 flagged.
    expect(isSeasonTallyReliable({ total: 9 }, 12)).toBe(false);
  });

  it("treats the tally as reliable once it has caught up to (or exceeds) the official count", () => {
    expect(isSeasonTallyReliable({ total: 9 }, 9)).toBe(true);
    expect(isSeasonTallyReliable({ total: 10 }, 9)).toBe(true); // over-count edge case: still trusted
  });

  it("[QA nit] never treats an official count of 0 as reliable, even for a matching { total: 0 } tally", () => {
    // `0 >= 0` would otherwise pass the naive `total >= officialEpisodeCount`
    // check by coincidence — but `episode_count = 0` in the `seasons` cache
    // only ever means "not populated yet", never a genuine zero-episode
    // season (a hero always points at an already-aired episode, so its
    // season has at least one).
    expect(isSeasonTallyReliable({ total: 0 }, 0)).toBe(false);
  });
});

describe("deriveHomeView", () => {
  // Lot 1 (Home optimistic mark-watched): `deriveHomeView` is the exact
  // pipeline `useMarkWatched`'s `onMutate` re-runs locally against an
  // optimistic `watchedEpisodeIds` (current set + the tapped episode) to
  // advance/rotate the hero without duplicating `buildReadyItems`/
  // `selectHero`'s actual rules — see `src/hooks/use-mark-watched.ts`.
  function raw(over: Partial<HomeRawInputs> & Pick<HomeRawInputs, "episodes">): HomeRawInputs {
    return {
      showStatusByShowId: new Map(),
      lastWatchedAtByShowId: new Map(),
      watchedEpisodeIds: new Set(),
      heroSeasonEpisodeCount: null,
      reprendreSeasonEpisodeCounts: new Map(),
      ...over,
    };
  }

  it("advances the hero in place (same show/season) when a ready backlog episode is marked watched but backlog remains", () => {
    const s = show(1);
    const episodes = [ep(s, 101, 1, 1, "2026-01-01"), ep(s, 102, 1, 2, "2026-01-08")];
    const showStatusByShowId = new Map<number, ActiveStatus>([[1, "en_cours"]]);

    const before = deriveHomeView(
      raw({
        episodes,
        showStatusByShowId,
        watchedEpisodeIds: new Set(),
        heroSeasonEpisodeCount: 2,
      }),
      TODAY,
    );
    expect(before.hero?.nextEpisode.id).toBe(101);
    expect(before.hero?.extraCount).toBe(1);
    expect(before.heroProgress).toEqual({ watched: 0, total: 2 });

    // Simulates onMutate: episode 101 added to the optimistic watched set,
    // `heroSeasonEpisodeCount` reused (same show/season as before).
    const after = deriveHomeView(
      raw({
        episodes,
        showStatusByShowId,
        watchedEpisodeIds: new Set([101]),
        heroSeasonEpisodeCount: 2,
      }),
      TODAY,
    );

    expect(after.hero?.show.id).toBe(1);
    expect(after.hero?.nextEpisode.id).toBe(102); // advanced to the next ready episode
    expect(after.hero?.extraCount).toBe(0);
    expect(after.heroProgress).toEqual({ watched: 1, total: 2 }); // ticked up, same total
  });

  it("drops the show and rotates the hero to the next candidate once its entire ready backlog is cleared", () => {
    const heroShow = show(1, "Hero Show"); // only one ready episode — its whole backlog
    const nextCandidate = show(2, "Next Candidate");
    const episodes = [
      ep(heroShow, 101, 1, 1, "2026-01-01"),
      ep(nextCandidate, 201, 1, 1, "2026-02-01"),
    ];
    const showStatusByShowId = new Map<number, ActiveStatus>([
      [1, "en_cours"],
      [2, "a_voir"],
    ]);

    const before = deriveHomeView(raw({ episodes, showStatusByShowId }), TODAY);
    expect(before.hero?.show.id).toBe(1); // en_cours always wins the hero slot over a_voir

    const after = deriveHomeView(
      raw({ episodes, showStatusByShowId, watchedEpisodeIds: new Set([101]) }),
      TODAY,
    );

    expect(after.hero?.show.id).toBe(2); // rotated — show 1 has no ready episode left at all
    expect(after.readyCount).toBe(1);
  });

  it("clears the hero entirely (hero: null, readyCount: 0) when the last ready episode overall is marked watched", () => {
    const s = show(1);
    const episodes = [ep(s, 101, 1, 1, "2026-01-01")];
    const showStatusByShowId = new Map<number, ActiveStatus>([[1, "en_cours"]]);

    const after = deriveHomeView(
      raw({ episodes, showStatusByShowId, watchedEpisodeIds: new Set([101]) }),
      TODAY,
    );

    expect(after.hero).toBeNull();
    expect(after.readyCount).toBe(0);
    expect(after.reprendre).toEqual([]);
    expect(after.nouveau).toEqual([]);
  });

  it("hides heroProgress (null) once the hero has rotated to a show/season whose official episode count isn't known", () => {
    // Mirrors `useMarkWatched`'s onMutate: `heroSeasonEpisodeCount` is only
    // ever reused when the recomputed hero is the SAME show+season as
    // before — a rotation resets it to `null` rather than reusing a count
    // that belonged to a different season, even if the new season happens
    // to be fully aired (which would otherwise look "reliable").
    const heroShow = show(1, "Hero Show");
    const nextCandidate = show(2, "Next Candidate");
    const episodes = [
      ep(heroShow, 101, 1, 1, "2026-01-01"),
      ep(nextCandidate, 201, 1, 1, "2026-02-01"),
    ];
    const showStatusByShowId = new Map<number, ActiveStatus>([
      [1, "en_cours"],
      [2, "a_voir"],
    ]);

    const after = deriveHomeView(
      raw({
        episodes,
        showStatusByShowId,
        watchedEpisodeIds: new Set([101]),
        heroSeasonEpisodeCount: null, // reset by the caller on rotation
      }),
      TODAY,
    );

    expect(after.hero?.show.id).toBe(2);
    expect(after.heroProgress).toBeNull();
  });

  it("re-eligibilizes a dormant show for 'reprendre' once its lastWatchedAt is refreshed to today", () => {
    const heroShow = show(1, "Hero Show"); // freshest — wins the hero slot
    const dormant = show(2, "Dormant Show"); // >=30j since last watch, two ready episodes left
    const episodes = [
      ep(heroShow, 101, 1, 1, "2025-12-01"),
      ep(dormant, 201, 1, 1, "2026-01-01"),
      ep(dormant, 202, 1, 2, "2026-01-08"),
    ];
    const showStatusByShowId = new Map<number, ActiveStatus>([
      [1, "en_cours"],
      [2, "en_cours"],
    ]);

    const before = deriveHomeView(
      raw({
        episodes,
        showStatusByShowId,
        lastWatchedAtByShowId: new Map([
          [1, "2026-07-07T00:00:00.000Z"], // 1j — fresh
          [2, "2026-05-01T00:00:00.000Z"], // ~68j — dormant
        ]),
      }),
      TODAY,
    );
    expect(before.reprendre).toEqual([]); // dormant (>=30j) — not in the visible "reprendre" list

    // Simulates onMutate marking one of the dormant show's ready episodes,
    // which also refreshes its `lastWatchedAtByShowId` entry to "now".
    const after = deriveHomeView(
      raw({
        episodes,
        showStatusByShowId,
        watchedEpisodeIds: new Set([201]),
        lastWatchedAtByShowId: new Map([
          [1, "2026-07-07T00:00:00.000Z"],
          [2, "2026-07-08T00:00:00.000Z"], // refreshed to "today" by the mark-watched tap
        ]),
      }),
      TODAY,
    );

    expect(after.reprendre.map((i) => i.show.id)).toEqual([2]); // no longer dormant
  });

  it("keeps the hero on the same show across a mark-watched tap on its OWN episode, even with a competing en_cours show whose backlog is much older", () => {
    // Mirrors `recomputeFromBatch` in use-mark-watched.ts, which bumps the
    // tapped show's `lastWatchedAtByShowId` entry to "now" as part of the
    // same optimistic update — simulated here by supplying an already-bumped
    // map for the "after" call, exactly like that function would produce.
    const heroShow = show(1, "Hero Show"); // two ready episodes — backlog remains after one tap
    const competitor = show(2, "Ancient Backlog Competitor"); // much older backlog, but watched less recently
    const episodes = [
      ep(heroShow, 101, 1, 1, "2026-01-01"),
      ep(heroShow, 102, 1, 2, "2026-01-08"),
      ep(competitor, 201, 1, 1, "2020-01-01"),
    ];
    const showStatusByShowId = new Map<number, ActiveStatus>([
      [1, "en_cours"],
      [2, "en_cours"],
    ]);

    const before = deriveHomeView(
      raw({
        episodes,
        showStatusByShowId,
        lastWatchedAtByShowId: new Map([
          [1, "2026-07-05T00:00:00.000Z"], // ~3j — most recently watched, wins hero
          [2, "2026-06-01T00:00:00.000Z"], // ~37j — fresh, but watched less recently
        ]),
      }),
      TODAY,
    );
    expect(before.hero?.show.id).toBe(1);

    const after = deriveHomeView(
      raw({
        episodes,
        showStatusByShowId,
        watchedEpisodeIds: new Set([101]),
        lastWatchedAtByShowId: new Map([
          [1, "2026-07-08T00:00:00.000Z"], // bumped to "now" by the tap
          [2, "2026-06-01T00:00:00.000Z"], // unchanged
        ]),
      }),
      TODAY,
    );

    expect(after.hero?.show.id).toBe(1); // still the same show — never paradoxically rotated away
    expect(after.hero?.nextEpisode.id).toBe(102); // advanced in place, same show/season
  });

  it("rotates the hero to the MOST RECENTLY WATCHED remaining en_cours candidate once the current hero's backlog is fully cleared, not the one with the oldest backlog", () => {
    const heroShow = show(1, "Hero Show"); // single ready episode — its whole backlog
    const olderBacklogLessRecent = show(2, "Older Backlog, Less Recently Watched");
    const newerBacklogMoreRecent = show(3, "Newer Backlog, Watched Most Recently");
    const episodes = [
      ep(heroShow, 101, 1, 1, "2026-01-01"),
      ep(olderBacklogLessRecent, 201, 1, 1, "2020-01-01"), // oldest backlog -> would win under the old rule
      ep(newerBacklogMoreRecent, 301, 1, 1, "2026-03-01"),
    ];
    const showStatusByShowId = new Map<number, ActiveStatus>([
      [1, "en_cours"],
      [2, "en_cours"],
      [3, "en_cours"],
    ]);
    const lastWatchedAtByShowId = new Map([
      [1, "2026-07-07T00:00:00.000Z"], // ~1j — wins hero before the tap
      [2, "2026-06-01T00:00:00.000Z"], // ~37j — fresh, but watched least recently of the two candidates
      [3, "2026-07-01T00:00:00.000Z"], // ~7j — watched most recently of the two candidates
    ]);

    const before = deriveHomeView(
      raw({ episodes, showStatusByShowId, lastWatchedAtByShowId }),
      TODAY,
    );
    expect(before.hero?.show.id).toBe(1);

    const after = deriveHomeView(
      raw({
        episodes,
        showStatusByShowId,
        watchedEpisodeIds: new Set([101]), // clears show 1's entire ready backlog
        lastWatchedAtByShowId,
      }),
      TODAY,
    );

    expect(after.hero?.show.id).toBe(3); // most recently watched remaining candidate, not the oldest backlog (show 2)
  });

  it("is idempotent when the same episode id is already present in watchedEpisodeIds (protects against an accidental double-dispatch)", () => {
    const s = show(1);
    const episodes = [ep(s, 101, 1, 1, "2026-01-01"), ep(s, 102, 1, 2, "2026-01-08")];
    const showStatusByShowId = new Map<number, ActiveStatus>([[1, "en_cours"]]);
    const r = raw({
      episodes,
      showStatusByShowId,
      watchedEpisodeIds: new Set([101]),
      heroSeasonEpisodeCount: 2,
    });

    const first = deriveHomeView(r, TODAY);
    // Re-running with the id already present (as a second, redundant
    // mutate() for the same episode would) must produce an identical view.
    const second = deriveHomeView(r, TODAY);

    expect(second).toEqual(first);
    expect(second.hero?.nextEpisode.id).toBe(102);
  });

  it("never returns Zone B fields ('Programme à venir'/'Bientôt') at all — structurally cannot touch dayGroups/upcomingCount/nextReleases", () => {
    // `deriveHomeView` doesn't even accept episodes/watched data scoped to
    // the future, nor does it return anything for that part of `HomeData` —
    // `useMarkWatched`'s onMutate spreads `{ ...prevHome, ...view }`, so
    // `dayGroups`/`upcomingCount`/`nextReleases` are guaranteed to survive
    // unchanged from the previous `HomeData` snapshot. This test pins the
    // exact key set `deriveHomeView` returns, so a future change can't
    // silently start returning (and therefore overwriting) those fields.
    const s = show(1);
    const result = deriveHomeView(raw({ episodes: [ep(s, 101, 1, 1, "2026-01-01")] }), TODAY);

    expect(Object.keys(result).sort()).toEqual(
      [
        "hero",
        "heroProgress",
        "nouveau",
        "readyCount",
        "reprendre",
        "reprendreProgressByShowId",
      ].sort(),
    );
  });
});

describe("computeReprendreProgress", () => {
  // Minimal, valid `ReadyItem` stub — `computeReprendreProgress` only ever
  // reads `.show`/`.nextEpisode` off each item, but building through
  // `buildReadyItems` for every case would drag in unrelated fields (status,
  // lateness) irrelevant to these tests. The other `ReadyItem` fields are
  // filled with inert defaults, never asserted on here.
  function readyItem(s: ShowLite, nextEpisode: ScheduleEpisode): ReadyItem {
    return {
      show: s,
      status: "en_cours",
      episodes: [nextEpisode],
      nextEpisode,
      extraCount: 0,
      earliestAirDate: nextEpisode.air_date ?? "2026-01-01",
      isLate: false,
      lateDays: 0,
    };
  }

  it("includes a show's season tally only when the official episode count is known and reliable", () => {
    const s1 = show(1, "Reliable Show");
    const s2 = show(2, "Unknown Count Show");
    const episodes = [
      ep(s1, 101, 1, 1, "2026-01-01"),
      ep(s1, 102, 1, 2, "2026-01-08"),
      ep(s2, 201, 1, 1, "2026-01-01"),
    ];
    const watched = new Set([101]);
    const reprendreItems = [
      readyItem(s1, ep(s1, 102, 1, 2, "2026-01-08")),
      readyItem(s2, ep(s2, 201, 1, 1, "2026-01-01")),
    ];
    const seasonEpisodeCounts = new Map([[seasonCountKey(1, 1), 2]]); // only show 1 known

    const result = computeReprendreProgress(reprendreItems, episodes, watched, seasonEpisodeCounts);

    expect(result.get(1)).toEqual({ watched: 1, total: 2 });
    expect(result.has(2)).toBe(false); // show 2's count is unknown — no fraction, not a false one
  });

  it("scopes each show's tally to its OWN current season (nextEpisode.season_number), never the whole series", () => {
    const s = show(1);
    const episodes = [
      ep(s, 101, 1, 1, "2026-01-01"),
      ep(s, 102, 1, 2, "2026-01-08"),
      ep(s, 201, 2, 1, "2026-02-01"),
      ep(s, 202, 2, 2, "2026-02-08"),
    ];
    const watched = new Set([101, 102, 201]); // season 1 fully watched, season 2 partial
    const reprendreItems = [readyItem(s, ep(s, 202, 2, 2, "2026-02-08"))];
    const seasonEpisodeCounts = new Map([[seasonCountKey(1, 2), 2]]);

    const result = computeReprendreProgress(reprendreItems, episodes, watched, seasonEpisodeCounts);

    expect(result.get(1)).toEqual({ watched: 1, total: 2 }); // season 2 only, not 3/4
  });

  it("returns an empty map when reprendreItems is empty", () => {
    const result = computeReprendreProgress([], [], new Set(), new Map());

    expect(result.size).toBe(0);
  });

  it("keeps shows independent — one show's tally never leaks into another's, even sharing a season number", () => {
    const s1 = show(1);
    const s2 = show(2);
    const episodes = [ep(s1, 101, 1, 1, "2026-01-01"), ep(s2, 901, 1, 1, "2026-01-01")];
    const watched = new Set([101]);
    const reprendreItems = [
      readyItem(s1, ep(s1, 101, 1, 1, "2026-01-01")),
      readyItem(s2, ep(s2, 901, 1, 1, "2026-01-01")),
    ];
    const seasonEpisodeCounts = new Map([
      [seasonCountKey(1, 1), 1],
      [seasonCountKey(2, 1), 1],
    ]);

    const result = computeReprendreProgress(reprendreItems, episodes, watched, seasonEpisodeCounts);

    expect(result.get(1)).toEqual({ watched: 1, total: 1 });
    expect(result.get(2)).toEqual({ watched: 0, total: 1 });
  });
});

describe("seasonCountKey", () => {
  it("combines showId and seasonNumber into a stable, distinct string key", () => {
    expect(seasonCountKey(1, 2)).toBe("1:2");
    expect(seasonCountKey(1, 2)).not.toBe(seasonCountKey(2, 1)); // order matters, not just the pair of digits
    expect(seasonCountKey(12, 1)).not.toBe(seasonCountKey(1, 21)); // no ambiguous concatenation
  });
});

describe("selectNextReleases", () => {
  it("dedupes by show — a series with several future episodes contributes only its single soonest one", () => {
    const s = show(1, "Recurring Show");
    const episodes = [
      ep(s, 201, 1, 1, "2026-07-10"),
      ep(s, 202, 1, 2, "2026-07-17"), // later — must not appear
    ];
    const dayGroups = groupUpcomingByDay(episodes, TODAY, 90);

    const result = selectNextReleases(dayGroups, TODAY);

    expect(result).toHaveLength(1);
    expect(result[0].episode.id).toBe(201);
  });

  it("respects `limit`, taking the N soonest DISTINCT shows across days", () => {
    const s1 = show(1, "Show 1");
    const s2 = show(2, "Show 2");
    const s3 = show(3, "Show 3");
    const episodes = [
      ep(s1, 101, 1, 1, "2026-07-10"),
      ep(s2, 201, 1, 1, "2026-07-11"),
      ep(s3, 301, 1, 1, "2026-07-12"),
    ];
    const dayGroups = groupUpcomingByDay(episodes, TODAY, 90);

    const result = selectNextReleases(dayGroups, TODAY, { limit: 2 });

    expect(result.map((r) => r.show.id)).toEqual([1, 2]);
  });

  it("defaults to a limit of 2 when none is passed", () => {
    const s1 = show(1, "Show 1");
    const s2 = show(2, "Show 2");
    const s3 = show(3, "Show 3");
    const episodes = [
      ep(s1, 101, 1, 1, "2026-07-10"),
      ep(s2, 201, 1, 1, "2026-07-11"),
      ep(s3, 301, 1, 1, "2026-07-12"),
    ];
    const dayGroups = groupUpcomingByDay(episodes, TODAY, 90);

    const result = selectNextReleases(dayGroups, TODAY);

    expect(result).toHaveLength(2);
  });

  it("supports a higher `limit` — e.g. the `upcoming_only` Home state's cap of ~5 for its 'Bientôt' block (no hero/backlog to share the screen with)", () => {
    const shows = Array.from({ length: 6 }, (_, i) => show(i + 1, `Show ${i + 1}`));
    const episodes = shows.map((s, i) => ep(s, 100 * (i + 1), 1, 1, `2026-07-${10 + i}`));
    const dayGroups = groupUpcomingByDay(episodes, TODAY, 90);

    const result = selectNextReleases(dayGroups, TODAY, { limit: 5 });

    expect(result).toHaveLength(5);
    expect(result.map((r) => r.show.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it("returns results in strict chronological order, earliest day first", () => {
    const later = show(1, "Later Show");
    const sooner = show(2, "Sooner Show");
    // Inserted out of chronological order on purpose — the function must
    // sort by date, not by input/show-id order.
    const episodes = [ep(later, 101, 1, 1, "2026-08-01"), ep(sooner, 201, 1, 1, "2026-07-10")];
    const dayGroups = groupUpcomingByDay(episodes, TODAY, 90);

    const result = selectNextReleases(dayGroups, TODAY, { limit: 2 });

    expect(result.map((r) => r.show.id)).toEqual([2, 1]);
  });

  it("excludes show ids passed via `excludeShowIds` — e.g. the Home hero's own show", () => {
    const heroShow = show(1, "Hero Show");
    const otherShow = show(2, "Other Show");
    const episodes = [
      ep(heroShow, 101, 1, 1, "2026-07-10"),
      ep(otherShow, 201, 1, 1, "2026-07-11"),
    ];
    const dayGroups = groupUpcomingByDay(episodes, TODAY, 90);

    const result = selectNextReleases(dayGroups, TODAY, { excludeShowIds: new Set([1]) });

    expect(result.map((r) => r.show.id)).toEqual([2]);
  });

  it("returns an empty array when dayGroups is empty (ready_only state — nothing to show)", () => {
    const result = selectNextReleases([], TODAY);

    expect(result).toEqual([]);
  });

  it("computes daysUntil relative to `today`, matching formatCountdownLabel's expectations", () => {
    const s = show(1);
    const episodes = [ep(s, 101, 1, 1, "2026-07-12")]; // TODAY + 4 days
    const dayGroups = groupUpcomingByDay(episodes, TODAY, 90);

    const result = selectNextReleases(dayGroups, TODAY);

    expect(result[0].daysUntil).toBe(4);
    expect(result[0].date).toBe("2026-07-12");
  });

  it("for a same-day 'drop' entry (2+ episodes of the same show/season), picks the earliest episode in season/episode order", () => {
    const s = show(1);
    const episodes = [
      ep(s, 202, 1, 2, "2026-07-10"),
      ep(s, 201, 1, 1, "2026-07-10"), // same day, earlier episode number — must win
    ];
    const dayGroups = groupUpcomingByDay(episodes, TODAY, 90);

    const result = selectNextReleases(dayGroups, TODAY);

    expect(result).toHaveLength(1);
    expect(result[0].episode.id).toBe(201);
  });
});

describe("getTodayInTimeZone", () => {
  it("returns the naive UTC calendar date for an instant well within the Paris day (winter, CET/+1)", () => {
    expect(getTodayInTimeZone(new Date("2026-01-15T10:00:00.000Z"), "Europe/Paris")).toBe(
      "2026-01-15",
    );
  });

  it("rolls over to the next day ~1h before naive UTC would (winter, CET/+1 — the exact bug this fixes)", () => {
    // 23:30 UTC on Jan 15th is already 00:30 CET on Jan 16th in Paris — a
    // plain `toISOString().slice(0, 10)` would wrongly still say "15".
    expect(getTodayInTimeZone(new Date("2026-01-15T23:30:00.000Z"), "Europe/Paris")).toBe(
      "2026-01-16",
    );
  });

  it("returns the naive UTC calendar date for an instant well within the Paris day (summer, CEST/+2)", () => {
    expect(getTodayInTimeZone(new Date("2026-07-15T10:00:00.000Z"), "Europe/Paris")).toBe(
      "2026-07-15",
    );
  });

  it("rolls over to the next day ~2h before naive UTC would (summer, CEST/+2 — DST offset, not just a fixed +1)", () => {
    // 22:30 UTC on Jul 15th is already 00:30 CEST on Jul 16th in Paris.
    expect(getTodayInTimeZone(new Date("2026-07-15T22:30:00.000Z"), "Europe/Paris")).toBe(
      "2026-07-16",
    );
  });
});

describe("selectTodayRelease", () => {
  it("returns null when nothing airs exactly today among followed shows", () => {
    const s = show(1);
    const episodes = [ep(s, 101, 1, 1, "2026-07-07"), ep(s, 102, 1, 2, "2026-07-09")];
    const statusByShowId = new Map<number, ActiveStatus>([[1, "en_cours"]]);

    const result = selectTodayRelease(episodes, new Set(), statusByShowId, new Map(), TODAY);

    expect(result).toBeNull();
  });

  it("ignores an already-watched episode airing today", () => {
    const s = show(1);
    const episodes = [ep(s, 101, 1, 1, TODAY)];
    const statusByShowId = new Map<number, ActiveStatus>([[1, "en_cours"]]);

    const result = selectTodayRelease(episodes, new Set([101]), statusByShowId, new Map(), TODAY);

    expect(result).toBeNull();
  });

  it("ignores a show with no known status (not followed a_voir/en_cours)", () => {
    const s = show(1);
    const episodes = [ep(s, 101, 1, 1, TODAY)];

    const result = selectTodayRelease(episodes, new Set(), new Map(), new Map(), TODAY);

    expect(result).toBeNull();
  });

  it("excludes shows via `excludeShowIds` — e.g. the Home hero's own show", () => {
    const heroShow = show(1, "Hero Show");
    const otherShow = show(2, "Other Show");
    const episodes = [ep(heroShow, 101, 1, 1, TODAY), ep(otherShow, 201, 1, 1, TODAY)];
    const statusByShowId = new Map<number, ActiveStatus>([
      [1, "en_cours"],
      [2, "en_cours"],
    ]);

    const result = selectTodayRelease(episodes, new Set(), statusByShowId, new Map(), TODAY, {
      excludeShowIds: new Set([1]),
    });

    expect(result?.show.id).toBe(2);
  });

  it("dedupes a same-day double episode drop, deterministically picking the earliest episode number", () => {
    const s = show(1);
    const episodes = [ep(s, 102, 1, 2, TODAY), ep(s, 101, 1, 1, TODAY)];
    const statusByShowId = new Map<number, ActiveStatus>([[1, "en_cours"]]);

    const result = selectTodayRelease(episodes, new Set(), statusByShowId, new Map(), TODAY);

    expect(result?.episode.id).toBe(101);
  });

  it("ranks a caught-up en_cours show ahead of an a_voir show with a heavier backlog — X-Men (en_cours, backlog 0) before House of the Dragon (a_voir, S3 never started, backlog 3+)", () => {
    const xMen = show(1, "X-Men");
    const houseOfTheDragon = show(2, "House of the Dragon");
    const episodes = [
      // X-Men: only today's episode — no prior backlog.
      ep(xMen, 101, 2, 6, TODAY),
      // House of the Dragon: a 3-episode backlog before today, plus today's own.
      ep(houseOfTheDragon, 201, 3, 1, "2026-07-01"),
      ep(houseOfTheDragon, 202, 3, 2, "2026-07-03"),
      ep(houseOfTheDragon, 203, 3, 3, "2026-07-05"),
      ep(houseOfTheDragon, 204, 3, 4, TODAY),
    ];
    const statusByShowId = new Map<number, ActiveStatus>([
      [1, "en_cours"],
      [2, "a_voir"],
    ]);

    const result = selectTodayRelease(episodes, new Set(), statusByShowId, new Map(), TODAY);

    expect(result?.show.id).toBe(1);
    expect(result?.episode.id).toBe(101);
  });

  it("within the same backlog bucket, ranks the more recently watched show first", () => {
    const staleShow = show(1, "Stale");
    const freshShow = show(2, "Fresh");
    const episodes = [ep(staleShow, 101, 1, 1, TODAY), ep(freshShow, 201, 1, 1, TODAY)];
    const statusByShowId = new Map<number, ActiveStatus>([
      [1, "en_cours"],
      [2, "en_cours"],
    ]);
    const lastWatchedAtByShowId = new Map([
      [1, "2026-06-01T00:00:00.000Z"],
      [2, "2026-07-07T00:00:00.000Z"], // watched yesterday — more recent
    ]);

    const result = selectTodayRelease(
      episodes,
      new Set(),
      statusByShowId,
      lastWatchedAtByShowId,
      TODAY,
    );

    expect(result?.show.id).toBe(2);
  });

  it("within the same bucket and no recency signal for either, ranks en_cours ahead of a_voir, then by title", () => {
    const aVoirShow = show(2, "A — À voir show");
    const enCoursShow = show(1, "B — En cours show");
    const episodes = [ep(aVoirShow, 201, 1, 1, TODAY), ep(enCoursShow, 101, 1, 1, TODAY)];
    const statusByShowId = new Map<number, ActiveStatus>([
      [1, "en_cours"],
      [2, "a_voir"],
    ]);

    const result = selectTodayRelease(episodes, new Set(), statusByShowId, new Map(), TODAY);

    // en_cours wins despite a title that would otherwise sort it second.
    expect(result?.show.id).toBe(1);
  });
});

describe("selectTodayRelease + selectHero — mutual exclusion with Reprendre/À commencer", () => {
  it("a show spotlighted in `todayRelease` also legitimately appears in `selectHero`'s `reprendre` — filtering `reprendre` by `todayRelease.show.id` (as index.tsx's queryFn does, mirroring the hero's own exclusion) removes the duplicate", () => {
    const heroShow = show(1, "Hero Show");
    const todayShow = show(2, "Today Show");
    const episodes = [
      // Hero: ready episode not today, most recently watched — wins the hero slot.
      ep(heroShow, 101, 1, 1, "2026-07-01"),
      // Today Show: en_cours, only a ready episode airing exactly TODAY — its
      // last watch is older than the hero's (so it loses the hero race) but
      // still recent enough (< LIST_STALE_DAYS) to land in the ACTIVE
      // `reprendre` list rather than `reprendreDormant`.
      ep(todayShow, 201, 1, 1, TODAY),
    ];
    const statusByShowId = new Map<number, ActiveStatus>([
      [1, "en_cours"],
      [2, "en_cours"],
    ]);
    const lastWatchedAtByShowId = new Map([
      [1, "2026-07-07T00:00:00.000Z"], // hero: watched yesterday
      [2, "2026-06-20T00:00:00.000Z"], // today show: 18 days ago — active, not dormant
    ]);
    const watchedEpisodeIds = new Set<number>();

    const ready = buildReadyItems(episodes, watchedEpisodeIds, statusByShowId, TODAY);
    const { hero, reprendre } = selectHero(ready, TODAY, lastWatchedAtByShowId);
    expect(hero?.show.id).toBe(1);

    // Before the fix: `todayShow` is a genuine en_cours show with a ready
    // backlog, just not the hero — it legitimately appears in `reprendre`.
    expect(reprendre.some((item) => item.show.id === 2)).toBe(true);

    const todayRelease = selectTodayRelease(
      episodes,
      watchedEpisodeIds,
      statusByShowId,
      lastWatchedAtByShowId,
      TODAY,
      { excludeShowIds: hero ? new Set([hero.show.id]) : undefined },
    );
    expect(todayRelease?.show.id).toBe(2);

    // The fix: filter `reprendre` (and, by the same logic, `nouveau`) by
    // `todayRelease`'s own show id BEFORE returning `HomeData` — same
    // pattern already applied to the hero's own show via `selectHero`'s
    // built-in exclusion.
    const reprendreAfterToday = todayRelease
      ? reprendre.filter((item) => item.show.id !== todayRelease.show.id)
      : reprendre;
    expect(reprendreAfterToday.some((item) => item.show.id === 2)).toBe(false);
  });
});

describe("selectPremiereSoon", () => {
  it("returns null when there are no eligible premieres at all", () => {
    const s = show(1);
    const activeEpisodes = [ep(s, 101, 1, 1, "2026-07-01")]; // in the past, not a premiere candidate
    const statusByShowId = new Map<number, ActiveStatus>([[1, "en_cours"]]);
    const lastWatchedAtByShowId = new Map([[1, "2026-07-01T00:00:00.000Z"]]);

    const result = selectPremiereSoon(
      activeEpisodes,
      [],
      new Set(),
      statusByShowId,
      lastWatchedAtByShowId,
      TODAY,
    );

    expect(result).toBeNull();
  });

  it("excludes a never-started a_voir show's premiere (no `lastWatchedAtByShowId` entry)", () => {
    const s = show(1);
    const activeEpisodes = [ep(s, 201, 2, 1, "2026-08-01")]; // future season premiere
    const statusByShowId = new Map<number, ActiveStatus>([[1, "a_voir"]]);

    const result = selectPremiereSoon(
      activeEpisodes,
      [],
      new Set(),
      statusByShowId,
      new Map(), // no lastWatchedAtByShowId entry at all — never started
      TODAY,
    );

    expect(result).toBeNull();
  });

  it("includes an a_voir show's premiere once it's been started (`lastWatchedAtByShowId` has an entry)", () => {
    const s = show(1);
    const activeEpisodes = [ep(s, 201, 2, 1, "2026-08-01")];
    const statusByShowId = new Map<number, ActiveStatus>([[1, "a_voir"]]);
    const lastWatchedAtByShowId = new Map([[1, "2026-07-01T00:00:00.000Z"]]);

    const result = selectPremiereSoon(
      activeEpisodes,
      [],
      new Set(),
      statusByShowId,
      lastWatchedAtByShowId,
      TODAY,
    );

    expect(result?.show.id).toBe(1);
    expect(result?.episode.id).toBe(201);
  });

  it("includes a `termine` show's premiere unconditionally — no `showStatusByShowId`/`lastWatchedAtByShowId` entry needed, `priorBacklogCount` assumed 0", () => {
    const s = show(1, "Finished Show");
    const termineEpisodes = [ep(s, 401, 4, 1, "2026-09-01")];

    const result = selectPremiereSoon(
      [], // activeEpisodes — empty, this show is termine, never in the a_voir/en_cours fetch
      termineEpisodes,
      new Set(),
      new Map(), // no showStatusByShowId entry — termine is never in it
      new Map(), // no lastWatchedAtByShowId entry — termine is never in the recency query either
      TODAY,
    );

    expect(result?.show.id).toBe(1);
    expect(result?.episode.id).toBe(401);
  });

  it("ignores non-premiere episodes (`episode_number !== 1`) and non-future ones (`air_date <= today`)", () => {
    const s = show(1);
    const activeEpisodes = [
      ep(s, 101, 2, 2, "2026-08-01"), // future, but not episode 1 — not a premiere
      ep(s, 102, 3, 1, TODAY), // episode 1, but not strictly future
    ];
    const statusByShowId = new Map<number, ActiveStatus>([[1, "en_cours"]]);
    const lastWatchedAtByShowId = new Map([[1, "2026-07-01T00:00:00.000Z"]]);

    const result = selectPremiereSoon(
      activeEpisodes,
      [],
      new Set(),
      statusByShowId,
      lastWatchedAtByShowId,
      TODAY,
    );

    expect(result).toBeNull();
  });

  it("excludes shows via `excludeShowIds` — e.g. the Home hero's own show", () => {
    const heroShow = show(1, "Hero Show");
    const otherShow = show(2, "Other Show");
    const activeEpisodes = [
      ep(heroShow, 101, 2, 1, "2026-08-01"),
      ep(otherShow, 201, 2, 1, "2026-08-01"),
    ];
    const statusByShowId = new Map<number, ActiveStatus>([
      [1, "en_cours"],
      [2, "en_cours"],
    ]);
    const lastWatchedAtByShowId = new Map([
      [1, "2026-07-01T00:00:00.000Z"],
      [2, "2026-07-01T00:00:00.000Z"],
    ]);

    const result = selectPremiereSoon(
      activeEpisodes,
      [],
      new Set(),
      statusByShowId,
      lastWatchedAtByShowId,
      TODAY,
      { excludeShowIds: new Set([1]) },
    );

    expect(result?.show.id).toBe(2);
  });

  it("computes `daysUntil`/`date` from the premiere episode's own air_date", () => {
    const s = show(1);
    const activeEpisodes = [ep(s, 201, 2, 1, "2026-07-15")]; // TODAY + 7 days
    const statusByShowId = new Map<number, ActiveStatus>([[1, "en_cours"]]);
    const lastWatchedAtByShowId = new Map([[1, "2026-07-01T00:00:00.000Z"]]);

    const result = selectPremiereSoon(
      activeEpisodes,
      [],
      new Set(),
      statusByShowId,
      lastWatchedAtByShowId,
      TODAY,
    );

    expect(result?.date).toBe("2026-07-15");
    expect(result?.daysUntil).toBe(7);
  });

  it("a show at an up-to-date backlog bucket (0) always wins over one that's still behind on its current season (bucket >= 1) — tier 1 (bucket) is checked first and dominates tiers 2/3 (status/recency) regardless of who's ahead on those", () => {
    const termineShow = show(1, "Termine Show");
    const enCoursShow = show(2, "En Cours Show — behind on current season");
    const termineEpisodes = [ep(termineShow, 401, 4, 1, "2026-08-15")];
    const activeEpisodes = [
      // 3 unwatched, already-aired episodes before TODAY — backlog bucket 2 (3+).
      ep(enCoursShow, 201, 3, 1, "2026-06-01"),
      ep(enCoursShow, 202, 3, 2, "2026-06-08"),
      ep(enCoursShow, 203, 3, 3, "2026-06-15"),
      ep(enCoursShow, 204, 4, 1, "2026-08-15"), // its own season 4 premiere
    ];
    const statusByShowId = new Map<number, ActiveStatus>([[2, "en_cours"]]);
    // Even a VERY recent watch, AND a status (en_cours) that would normally
    // rank ahead of termine, can't compensate for the worse backlog bucket
    // (tier 1 is checked first, unconditionally, before status or recency).
    const lastWatchedAtByShowId = new Map([[2, "2026-07-07T00:00:00.000Z"]]);

    const result = selectPremiereSoon(
      activeEpisodes,
      termineEpisodes,
      new Set(),
      statusByShowId,
      lastWatchedAtByShowId,
      TODAY,
    );

    expect(result?.show.id).toBe(1); // termine (bucket 0) beats en_cours (bucket 2)
  });

  it("a show at bucket 0 wins over a bucket >= 1 competitor even when the LATTER's status would otherwise rank higher — e.g. an a_voir show that's caught up beats an en_cours show that's fallen behind", () => {
    const aVoirShow = show(1, "A Voir Show — caught up, ready for its premiere");
    const enCoursShow = show(2, "En Cours Show — behind on current season");
    const activeEpisodes = [
      ep(aVoirShow, 101, 2, 1, "2026-08-15"), // bucket 0 — no backlog at all
      ep(enCoursShow, 201, 3, 1, "2026-06-01"),
      ep(enCoursShow, 202, 3, 2, "2026-06-08"),
      ep(enCoursShow, 203, 3, 3, "2026-06-15"),
      ep(enCoursShow, 204, 4, 1, "2026-08-15"), // bucket 2 (3+)
    ];
    const statusByShowId = new Map<number, ActiveStatus>([
      [1, "a_voir"],
      [2, "en_cours"],
    ]);
    const lastWatchedAtByShowId = new Map([
      [1, "2026-07-01T00:00:00.000Z"],
      [2, "2026-07-07T00:00:00.000Z"],
    ]);

    const result = selectPremiereSoon(
      activeEpisodes,
      [],
      new Set(),
      statusByShowId,
      lastWatchedAtByShowId,
      TODAY,
    );

    expect(result?.show.id).toBe(1); // bucket 0 wins despite a_voir normally ranking below en_cours
  });

  it("at an EQUAL backlog bucket (0), `termine` wins over `en_cours` and `a_voir` via the status tier — status is checked BEFORE recency for premieres (unlike 'Sort aujourd'hui')", () => {
    const termineShow = show(1, "Termine Show");
    const enCoursShow = show(2, "En Cours Show");
    const aVoirShow = show(3, "A Voir Show");
    const termineEpisodes = [ep(termineShow, 401, 2, 1, "2026-08-15")];
    const activeEpisodes = [
      ep(enCoursShow, 201, 2, 1, "2026-08-15"),
      ep(aVoirShow, 301, 2, 1, "2026-08-15"),
    ];
    const statusByShowId = new Map<number, ActiveStatus>([
      [2, "en_cours"],
      [3, "a_voir"],
    ]);
    // Both eligible competitors have a REAL, very recent recency signal —
    // under the OLD (Lot-1-shared) tier order this would have made one of
    // them win before the status tier was ever reached (the behavior pinned
    // and flagged as a caveat in the previous revision). With status
    // promoted ahead of recency, termine wins regardless.
    const lastWatchedAtByShowId = new Map([
      [2, "2026-07-07T00:00:00.000Z"],
      [3, "2026-07-07T00:00:00.000Z"],
    ]);

    const result = selectPremiereSoon(
      activeEpisodes,
      termineEpisodes,
      new Set(),
      statusByShowId,
      lastWatchedAtByShowId,
      TODAY,
    );

    expect(result?.show.id).toBe(1); // termine wins
  });

  it("at equal bucket AND equal status, `en_cours` beats `a_voir` via the status tier (termine absent from this pairing)", () => {
    const enCoursShow = show(1, "En Cours Show");
    const aVoirShow = show(2, "A Voir Show");
    const activeEpisodes = [
      ep(enCoursShow, 101, 2, 1, "2026-08-15"),
      ep(aVoirShow, 201, 2, 1, "2026-08-15"),
    ];
    const statusByShowId = new Map<number, ActiveStatus>([
      [1, "en_cours"],
      [2, "a_voir"],
    ]);
    const lastWatchedAtByShowId = new Map([
      [1, "2026-07-01T00:00:00.000Z"], // older watch than show 2's
      [2, "2026-07-07T00:00:00.000Z"], // more recent — would win under recency-first ordering
    ]);

    const result = selectPremiereSoon(
      activeEpisodes,
      [],
      new Set(),
      statusByShowId,
      lastWatchedAtByShowId,
      TODAY,
    );

    // en_cours wins on STATUS despite a_voir having the more recent watch —
    // recency never gets a chance to override status here.
    expect(result?.show.id).toBe(1);
  });

  it("recency only breaks ties AFTER bucket and status are both tied — e.g. two en_cours candidates, the more recently watched one wins", () => {
    const staleShow = show(1, "Stale En Cours Show");
    const freshShow = show(2, "Fresh En Cours Show");
    const activeEpisodes = [
      ep(staleShow, 101, 2, 1, "2026-08-15"),
      ep(freshShow, 201, 2, 1, "2026-08-15"),
    ];
    const statusByShowId = new Map<number, ActiveStatus>([
      [1, "en_cours"],
      [2, "en_cours"],
    ]);
    const lastWatchedAtByShowId = new Map([
      [1, "2026-06-01T00:00:00.000Z"],
      [2, "2026-07-07T00:00:00.000Z"], // watched more recently
    ]);

    const result = selectPremiereSoon(
      activeEpisodes,
      [],
      new Set(),
      statusByShowId,
      lastWatchedAtByShowId,
      TODAY,
    );

    expect(result?.show.id).toBe(2);
  });
});
