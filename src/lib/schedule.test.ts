import { describe, expect, it } from "vitest";
import {
  buildLastWatchedAtByShow,
  buildLibraryProgress,
  buildReadyItems,
  computeSeasonTally,
  deriveHomeView,
  formatCountdownLabel,
  formatReadyLabel,
  getDayLabelParts,
  HERO_STALE_DAYS,
  isSeasonTallyReliable,
  selectHero,
  type ActiveStatus,
  type HomeRawInputs,
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
    expect(formatReadyLabel({ isLate: true, lateDays: 1 })).toBe("En retard · 1j");
    expect(formatReadyLabel({ isLate: true, lateDays: 6 })).toBe("En retard · 6j");
  });

  it("switches to a week count at the 7j boundary", () => {
    expect(formatReadyLabel({ isLate: true, lateDays: 7 })).toBe("En retard · 1 sem");
  });

  it("floors to whole weeks within the 7-29j range", () => {
    expect(formatReadyLabel({ isLate: true, lateDays: 13 })).toBe("En retard · 1 sem");
    expect(formatReadyLabel({ isLate: true, lateDays: 14 })).toBe("En retard · 2 sem");
    expect(formatReadyLabel({ isLate: true, lateDays: 29 })).toBe("En retard · 4 sem");
  });

  it("returns null (no label at all) at the 30j boundary and beyond", () => {
    expect(formatReadyLabel({ isLate: true, lateDays: 30 })).toBeNull();
    expect(formatReadyLabel({ isLate: true, lateDays: 90 })).toBeNull();
  });
});

describe("formatCountdownLabel", () => {
  // Lot 2 (unification du vocabulaire countdown Home/fiche série) — extrait
  // à l'identique du ternaire de `NextEpisodeCard` (show.$mediaType.$tmdbId.tsx),
  // consommé aussi par `NothingNowCountdownTicket` (empty-states.tsx).
  it('returns "aujourd\'hui" for 0 days', () => {
    expect(formatCountdownLabel(0)).toBe("aujourd'hui");
  });

  it('returns "demain" for 1 day', () => {
    expect(formatCountdownLabel(1)).toBe("demain");
  });

  it('returns "dans Nj" (abbreviated "j", never "jours") for 2+ days', () => {
    expect(formatCountdownLabel(2)).toBe("dans 2 j");
    expect(formatCountdownLabel(10)).toBe("dans 10 j");
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

  it("never returns Zone B fields ('Programme à venir') at all — structurally cannot touch dayGroups/upcomingCount/countdown", () => {
    // `deriveHomeView` doesn't even accept episodes/watched data scoped to
    // the future, nor does it return anything for that part of `HomeData` —
    // `useMarkWatched`'s onMutate spreads `{ ...prevHome, ...view }`, so
    // `dayGroups`/`upcomingCount`/`countdown` are guaranteed to survive
    // unchanged from the previous `HomeData` snapshot. This test pins the
    // exact key set `deriveHomeView` returns, so a future change can't
    // silently start returning (and therefore overwriting) those fields.
    const s = show(1);
    const result = deriveHomeView(raw({ episodes: [ep(s, 101, 1, 1, "2026-01-01")] }), TODAY);

    expect(Object.keys(result).sort()).toEqual(
      ["hero", "heroProgress", "nouveau", "readyCount", "reprendre"].sort(),
    );
  });
});
