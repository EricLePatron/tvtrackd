import { describe, expect, it } from "vitest";
import { buildFlatRows, getTemporalBarClass } from "./calendar-timeline-rows";
import type { ShowLite, TimelineDayGroup, TimelineEpisode } from "@/lib/schedule";

/**
 * These tests cover `buildFlatRows` only — the pure, React-free logic that
 * turns `TimelineDayGroup[]` into the flat, one-row-per-DAY list the
 * virtualizer renders (`day` / `empty-today`). They do NOT and cannot
 * exercise the virtualizer itself (scroll-anchoring to "today",
 * `scrollToIndex`, absence of visual overlap between rows while scrolling),
 * nor `DayRail`'s own rendering (covered by `day-rail.tsx` being reused
 * as-is, unmodified, from the Home screen) — `@tanstack/react-virtual`
 * isn't installable in this sandbox (private npm registry blocked by
 * network policy). That part still needs a manual pass in an environment
 * with full network access.
 */

const show = (id: number, title = `Show ${id}`): ShowLite => ({
  id,
  tmdb_id: id,
  media_type: "tv",
  title,
  poster_path: null,
});

function ep(
  showRef: ShowLite,
  id: number,
  season_number: number,
  episode_number: number,
  air_date: string | null,
  watched = false,
): TimelineEpisode {
  return {
    id,
    season_number,
    episode_number,
    title: `S${season_number}E${episode_number}`,
    air_date,
    show: showRef,
    watched,
  };
}

function group(overrides: Partial<TimelineDayGroup> & { date: string }): TimelineDayGroup {
  return {
    isToday: false,
    isPastOrToday: false,
    episodes: [],
    ...overrides,
  };
}

describe("buildFlatRows", () => {
  it("emits a single 'day' row (not one per episode) for a populated group", () => {
    const s = show(1);
    const g = group({
      date: "2026-07-08",
      isToday: true,
      isPastOrToday: true,
      episodes: [ep(s, 101, 1, 1, "2026-07-08"), ep(s, 102, 1, 2, "2026-07-08")],
    });

    const rows = buildFlatRows([g]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "day", date: "2026-07-08" });
  });

  it("maps every episode of the day into a 'single' UpcomingEntry, never a 'drop'", () => {
    const s = show(1);
    const g = group({
      date: "2026-07-08",
      episodes: [ep(s, 101, 1, 1, "2026-07-08"), ep(s, 102, 1, 2, "2026-07-08")],
    });

    const rows = buildFlatRows([g]);
    const row = rows[0];
    if (row.kind !== "day") throw new Error("expected a 'day' row");

    expect(row.entries).toHaveLength(2);
    expect(row.entries.every((e) => e.type === "single")).toBe(true);
    expect(row.entries.map((e) => (e.type === "single" ? e.episode.id : null))).toEqual([101, 102]);
  });

  it("propagates each episode's `watched` flag onto its UpcomingSingleEntry", () => {
    const s = show(1);
    const g = group({
      date: "2026-07-05",
      isPastOrToday: true,
      episodes: [ep(s, 201, 1, 1, "2026-07-05", true), ep(s, 202, 1, 2, "2026-07-05", false)],
    });

    const rows = buildFlatRows([g]);
    const row = rows[0];
    if (row.kind !== "day") throw new Error("expected a 'day' row");

    expect(row.entries[0]).toMatchObject({ watched: true });
    expect(row.entries[1]).toMatchObject({ watched: false });
  });

  it("sets `isToday` and `saturated` from the group's `isToday`/`isPastOrToday`", () => {
    const s = show(1);
    const gToday = group({
      date: "2026-07-08",
      isToday: true,
      isPastOrToday: true,
      episodes: [ep(s, 301, 1, 1, "2026-07-08")],
    });
    const gFuture = group({
      date: "2026-07-09",
      isToday: false,
      isPastOrToday: false,
      episodes: [ep(s, 302, 1, 2, "2026-07-09")],
    });

    const [rowToday, rowFuture] = buildFlatRows([gToday, gFuture]);

    expect(rowToday).toMatchObject({ isToday: true, saturated: true });
    expect(rowFuture).toMatchObject({ isToday: false, saturated: false });
  });

  it("emits an 'empty-today' row (no 'day' row) for an empty group", () => {
    const g = group({ date: "2026-07-08", isToday: true, isPastOrToday: true, episodes: [] });

    const rows = buildFlatRows([g]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "empty-today", date: "2026-07-08" });
  });

  it("still emits an 'empty-today' row for an empty, non-today group (buildFlatRows has no isToday guard of its own)", () => {
    // buildFlatRows' branch on `group.episodes.length === 0` is not itself
    // conditioned on `isToday` — the code comment above that branch documents
    // an *external* guarantee (buildTimelineDayGroups never emits an empty
    // group other than "today", covered by its own tests in
    // schedule.test.ts), not a check performed here. This test documents
    // buildFlatRows' actual, real behaviour in isolation: given an empty
    // non-today group directly, it still produces an "empty-today" row.
    const g = group({ date: "2026-07-10", isToday: false, isPastOrToday: false, episodes: [] });

    const rows = buildFlatRows([g]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "empty-today", date: "2026-07-10" });
  });

  it("preserves group order: the row for group 1 precedes the row for group 2", () => {
    const s = show(1);
    const g1 = group({
      date: "2026-07-06",
      isPastOrToday: true,
      episodes: [ep(s, 501, 1, 1, "2026-07-06")],
    });
    const g2 = group({
      date: "2026-07-07",
      isPastOrToday: true,
      episodes: [ep(s, 502, 1, 2, "2026-07-07")],
    });

    const rows = buildFlatRows([g1, g2]);

    expect(rows.map((r) => r.date)).toEqual(["2026-07-06", "2026-07-07"]);
  });
});

describe("getTemporalBarClass", () => {
  const TODAY = "2026-07-08";

  it("returns the thicker, full-strength primary bar for today", () => {
    expect(getTemporalBarClass(TODAY, TODAY)).toBe("w-[5px] bg-primary");
  });

  it("returns a cyan-accent bar (WCAG-compliant /70 opacity) for a past date", () => {
    expect(getTemporalBarClass("2026-07-06", TODAY)).toBe("w-[3px] bg-cyan-accent/70");
  });

  it("returns a neutral border-colored bar for a future date", () => {
    expect(getTemporalBarClass("2026-07-09", TODAY)).toBe("w-[3px] bg-border");
  });
});
