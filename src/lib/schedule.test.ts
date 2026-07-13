import { describe, expect, it } from "vitest";
import {
  buildLibraryProgress,
  formatReadyLabel,
  getDayLabelParts,
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
