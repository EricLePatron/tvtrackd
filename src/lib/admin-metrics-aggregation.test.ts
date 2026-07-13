import { describe, expect, it } from "vitest";
import {
  bucketSignupsByDay,
  bucketSignupsByHour,
  computeImportStats,
  findHourMarkerIndex,
  splitShowsByStatus,
  type ImportRunRaw,
  type UserShowStatusRow,
} from "./admin-metrics-aggregation";

describe("bucketSignupsByDay", () => {
  it("buckets timestamps into the right calendar day and zero-fills the rest", () => {
    const result = bucketSignupsByDay(
      ["2026-07-10T08:00:00.000Z", "2026-07-10T23:59:00.000Z", "2026-07-11T00:00:01.000Z"],
      "2026-07-10T00:00:00.000Z",
      3,
    );
    expect(result).toEqual([
      { date: "2026-07-10", count: 2 },
      { date: "2026-07-11", count: 1 },
      { date: "2026-07-12", count: 0 },
    ]);
  });

  it("ignores timestamps outside the requested range", () => {
    const result = bucketSignupsByDay(
      ["2026-06-01T00:00:00.000Z", "2026-08-01T00:00:00.000Z"],
      "2026-07-10T00:00:00.000Z",
      2,
    );
    expect(result.reduce((sum, d) => sum + d.count, 0)).toBe(0);
  });
});

describe("bucketSignupsByHour", () => {
  const start = "2026-07-10T00:00:00.000Z";
  const end = "2026-07-17T00:00:00.000Z"; // fixed 168h migration-week window

  it("buckets timestamps into the right UTC hour", () => {
    const result = bucketSignupsByHour(
      ["2026-07-15T14:22:00.000Z", "2026-07-15T14:59:59.000Z", "2026-07-15T15:00:00.000Z"],
      start,
      end,
    );
    const bucket14 = result.find((h) => h.hourIso === "2026-07-15T14:00:00.000Z");
    const bucket15 = result.find((h) => h.hourIso === "2026-07-15T15:00:00.000Z");
    expect(bucket14?.count).toBe(2);
    expect(bucket15?.count).toBe(1);
  });

  it("produces exactly (end - start) hourly buckets, all zero-filled by default", () => {
    const result = bucketSignupsByHour([], start, end);
    expect(result).toHaveLength(168);
    expect(result.every((h) => h.count === 0)).toBe(true);
    expect(result[0].hourIso).toBe(start);
  });

  it("counts a timestamp landing on 15/07 even though 'now' (12/07, J-3) is outside a rolling 72h window of it", () => {
    // "now" would be 2026-07-12 per the task context (J-3) — a rolling 72h
    // window anchored on "now" would exclude 15/07 entirely (it's in the
    // future relative to "now"). The fixed window must still count a
    // signup landing on 15/07 regardless of when the function is called.
    const result = bucketSignupsByHour(["2026-07-15T09:00:00.000Z"], start, end);
    const bucket = result.find((h) => h.hourIso === "2026-07-15T09:00:00.000Z");
    expect(bucket?.count).toBe(1);
  });

  it("excludes timestamps strictly outside [start, end)", () => {
    const result = bucketSignupsByHour(
      ["2026-07-09T23:59:59.000Z", "2026-07-17T00:00:00.000Z", "2026-07-20T00:00:00.000Z"],
      start,
      end,
    );
    expect(result.reduce((sum, h) => sum + h.count, 0)).toBe(0);
  });
});

describe("findHourMarkerIndex", () => {
  it("finds the bucket index matching the marker timestamp", () => {
    const hours = bucketSignupsByHour([], "2026-07-10T00:00:00.000Z", "2026-07-17T00:00:00.000Z");
    // 15/07 00:00 is exactly 120h after 10/07 00:00
    expect(findHourMarkerIndex(hours, "2026-07-15T00:00:00.000Z")).toBe(120);
  });

  it("returns null when the marker falls outside the bucketed range", () => {
    const hours = bucketSignupsByHour([], "2026-07-10T00:00:00.000Z", "2026-07-17T00:00:00.000Z");
    expect(findHourMarkerIndex(hours, "2026-08-01T00:00:00.000Z")).toBeNull();
  });
});

describe("computeImportStats", () => {
  function run(overrides: Partial<ImportRunRaw>): ImportRunRaw {
    return {
      source: "granular",
      imported_episodes: 0,
      followed_shows: 0,
      unmatched_count: 0,
      total_groups: null,
      created_at: "2026-07-12T10:00:00.000Z",
      ...overrides,
    };
  }

  it("treats a run with 0 imported episodes AND 0 followed shows as a failure", () => {
    const stats = computeImportStats([
      run({ imported_episodes: 0, followed_shows: 0 }),
      run({ imported_episodes: 5, followed_shows: 1 }),
    ]);
    expect(stats.totalRuns).toBe(2);
    expect(stats.failedRuns).toBe(1);
    expect(stats.failureRate).toBe(0.5);
  });

  it("computes averages on successful runs only, excluding failures", () => {
    const stats = computeImportStats([
      run({ imported_episodes: 0, followed_shows: 0 }), // failure, must not drag the average down
      run({ imported_episodes: 100, followed_shows: 10 }),
      run({ imported_episodes: 50, followed_shows: 4 }),
    ]);
    expect(stats.avgImportedEpisodes).toBe(75);
    expect(stats.avgFollowedShows).toBe(7);
  });

  it("returns 0 averages (not NaN) when there are no successful runs", () => {
    const stats = computeImportStats([run({ imported_episodes: 0, followed_shows: 0 })]);
    expect(stats.avgImportedEpisodes).toBe(0);
    expect(stats.avgFollowedShows).toBe(0);
  });

  it("computes matchRate as a weighted sum/sum, not an average of per-run rates", () => {
    const stats = computeImportStats([
      run({ imported_episodes: 2, followed_shows: 1, total_groups: 2, unmatched_count: 0 }), // 2/2
      run({ imported_episodes: 500, followed_shows: 50, total_groups: 500, unmatched_count: 250 }), // 250/500
    ]);
    // Weighted: (2 + 250) / (2 + 500) = 252/502, NOT the naive average of
    // per-run rates (1.0 + 0.5) / 2 = 0.75.
    expect(stats.matchRate).toBeCloseTo(252 / 502, 10);
    expect(stats.runsWithMatchData).toBe(2);
  });

  it("excludes runs with total_groups = null from matchRate, not as 0/0", () => {
    const stats = computeImportStats([
      run({ total_groups: null, unmatched_count: 3, imported_episodes: 1, followed_shows: 1 }),
      run({ total_groups: 10, unmatched_count: 2, imported_episodes: 8, followed_shows: 1 }),
    ]);
    expect(stats.matchRate).toBeCloseTo(8 / 10, 10);
    expect(stats.runsWithMatchData).toBe(1);
  });

  it("returns matchRate null when no run has usable total_groups data", () => {
    const stats = computeImportStats([run({ total_groups: null })]);
    expect(stats.matchRate).toBeNull();
    expect(stats.runsWithMatchData).toBe(0);
  });

  it("excludes runs with total_groups = 0 from matchRate, same as null (not 0/0)", () => {
    const stats = computeImportStats([
      run({ total_groups: 0, unmatched_count: 0, imported_episodes: 0, followed_shows: 0 }),
      run({ total_groups: 10, unmatched_count: 2, imported_episodes: 8, followed_shows: 1 }),
    ]);
    expect(stats.matchRate).toBeCloseTo(8 / 10, 10);
    expect(stats.runsWithMatchData).toBe(1);
  });

  it("groups run counts by day and source, defaulting empty source to 'inconnu'", () => {
    const stats = computeImportStats([
      run({ source: "granular", created_at: "2026-07-12T08:00:00.000Z" }),
      run({ source: "granular", created_at: "2026-07-12T20:00:00.000Z" }),
      run({ source: "betaseries", created_at: "2026-07-12T09:00:00.000Z" }),
      run({ source: "", created_at: "2026-07-13T09:00:00.000Z" }),
    ]);
    expect(stats.bySourceDay).toEqual([
      { date: "2026-07-12", source: "betaseries", runs: 1 },
      { date: "2026-07-12", source: "granular", runs: 2 },
      { date: "2026-07-13", source: "inconnu", runs: 1 },
    ]);
  });
});

describe("splitShowsByStatus", () => {
  function row(showId: number, status: string, title: string): UserShowStatusRow {
    return { show_id: showId, status, title };
  }

  it("counts rows per status and ignores statuses outside a_voir/en_cours", () => {
    const result = splitShowsByStatus([
      row(1, "a_voir", "Show A"),
      row(2, "en_cours", "Show B"),
      row(3, "termine", "Show C"),
      row(4, "archive", "Show D"),
    ]);
    expect(result.activeShowsAVoir).toBe(1);
    expect(result.activeShowsEnCours).toBe(1);
  });

  it("ranks top shows per status by follower count, capped at 10", () => {
    const rows: UserShowStatusRow[] = [];
    for (let i = 0; i < 3; i++) rows.push(row(1, "en_cours", "Popular"));
    rows.push(row(2, "en_cours", "Less popular"));
    rows.push(row(3, "a_voir", "Only a_voir show"));

    const result = splitShowsByStatus(rows);
    expect(result.topShowsEnCours[0]).toEqual({ title: "Popular", followers: 3 });
    expect(result.topShowsEnCours[1]).toEqual({ title: "Less popular", followers: 1 });
    expect(result.topShowsAVoir).toEqual([{ title: "Only a_voir show", followers: 1 }]);
  });
});
