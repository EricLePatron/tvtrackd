import { describe, expect, it } from "vitest";
import { buildFlatRows } from "./calendar-timeline-rows";
import type { ShowLite, TimelineDayGroup, TimelineEpisode } from "@/lib/schedule";

/**
 * These tests cover `buildFlatRows` only — the pure, React-free logic that
 * turns `TimelineDayGroup[]` into the flat row list the virtualizer renders
 * (day-header / episode / empty-today). They do NOT and cannot exercise the
 * virtualizer itself (scroll-anchoring to "today", `scrollToIndex`, absence
 * of visual overlap between rows while scrolling) — `@tanstack/react-virtual`
 * isn't installable in this sandbox (private npm registry blocked by network
 * policy). That part still needs a manual pass in an environment with full
 * network access.
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
  it("marks every episode row isToday: true for a group where isToday is true", () => {
    const s = show(1);
    const g = group({
      date: "2026-07-08",
      isToday: true,
      isPastOrToday: true,
      episodes: [ep(s, 101, 1, 1, "2026-07-08"), ep(s, 102, 1, 2, "2026-07-08")],
    });

    const rows = buildFlatRows([g]);
    const episodeRows = rows.filter((r) => r.kind === "episode");

    expect(episodeRows).toHaveLength(2);
    expect(episodeRows.every((r) => r.isToday === true)).toBe(true);
  });

  it("marks every episode row isToday: false for a group where isToday is false", () => {
    const s = show(1);
    const g = group({
      date: "2026-07-09",
      isToday: false,
      isPastOrToday: false,
      episodes: [ep(s, 201, 1, 1, "2026-07-09")],
    });

    const rows = buildFlatRows([g]);
    const episodeRows = rows.filter((r) => r.kind === "episode");

    expect(episodeRows).toHaveLength(1);
    expect(episodeRows[0]).toMatchObject({ isToday: false });
  });

  it("emits an empty-today row (no episode row) for an empty isToday group", () => {
    const g = group({ date: "2026-07-08", isToday: true, isPastOrToday: true, episodes: [] });

    const rows = buildFlatRows([g]);

    expect(rows.filter((r) => r.kind === "episode")).toHaveLength(0);
    expect(rows.filter((r) => r.kind === "empty-today")).toHaveLength(1);
  });

  it("still emits an empty-today row for an empty, non-today group (buildFlatRows has no isToday guard of its own)", () => {
    // buildFlatRows' branch on `group.episodes.length === 0` is not itself
    // conditioned on `isToday` — the code comment above that branch documents
    // an *external* guarantee (buildTimelineDayGroups never emits an empty
    // group other than "today", covered by its own tests in
    // schedule.test.ts), not a check performed here. This test documents
    // buildFlatRows' actual, real behaviour in isolation: given an empty
    // non-today group directly, it still produces an "empty-today" row.
    const g = group({ date: "2026-07-10", isToday: false, isPastOrToday: false, episodes: [] });

    const rows = buildFlatRows([g]);

    expect(rows.filter((r) => r.kind === "episode")).toHaveLength(0);
    expect(rows.filter((r) => r.kind === "empty-today")).toHaveLength(1);
  });

  it("emits a day-header row first, with the group's date and isToday", () => {
    const s = show(1);
    const g = group({
      date: "2026-07-12",
      isToday: false,
      isPastOrToday: false,
      episodes: [ep(s, 301, 1, 1, "2026-07-12")],
    });

    const rows = buildFlatRows([g]);

    expect(rows[0]).toMatchObject({ kind: "day-header", date: "2026-07-12", isToday: false });
  });

  it("propagates saturated (isPastOrToday) independently of isToday", () => {
    const s = show(1);
    const g = group({
      date: "2026-07-05",
      isToday: false,
      isPastOrToday: true,
      episodes: [ep(s, 401, 1, 1, "2026-07-05")],
    });

    const rows = buildFlatRows([g]);
    const episodeRow = rows.find((r) => r.kind === "episode");

    expect(episodeRow).toMatchObject({ saturated: true, isToday: false });
  });

  it("preserves group order: all rows of group 1 precede all rows of group 2", () => {
    const s = show(1);
    const g1 = group({
      date: "2026-07-06",
      isToday: false,
      isPastOrToday: true,
      episodes: [ep(s, 501, 1, 1, "2026-07-06")],
    });
    const g2 = group({
      date: "2026-07-07",
      isToday: false,
      isPastOrToday: true,
      episodes: [ep(s, 502, 1, 2, "2026-07-07")],
    });

    const rows = buildFlatRows([g1, g2]);
    const g1EndIndex = rows.findIndex((r) => r.kind === "episode" && r.episode.id === 501);
    const g2StartIndex = rows.findIndex((r) => r.kind === "day-header" && r.date === "2026-07-07");

    expect(g1EndIndex).toBeGreaterThanOrEqual(0);
    expect(g2StartIndex).toBeGreaterThan(g1EndIndex);
  });
});
