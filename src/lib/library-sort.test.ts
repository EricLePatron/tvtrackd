import { describe, expect, it } from "vitest";
import { compareLibraryRows, type LibrarySortKey, type SortableRow } from "./library-sort";

function row(
  id: number,
  title: string,
  created_at: string,
  first_air_date: string | null = null,
): SortableRow {
  return { created_at, show: { id, title, first_air_date } };
}

/** Sort helper mirroring library.tsx's usage (`[...rows].sort(compare)`). */
function sortIds(
  rows: SortableRow[],
  sortKey: LibrarySortKey,
  ctx: Parameters<typeof compareLibraryRows>[3],
): number[] {
  return [...rows].sort((a, b) => compareLibraryRows(a, b, sortKey, ctx)).map((r) => r.show.id);
}

const NO_CTX = { lastWatchedAtByShowId: new Map<number, string>() };

describe("compareLibraryRows", () => {
  it("titre: alphabetical, locale-aware", () => {
    const rows = [
      row(1, "Élite", "2026-01-01"),
      row(2, "Andor", "2026-01-01"),
      row(3, "Zoo", "2026-01-01"),
    ];
    expect(sortIds(rows, "titre", NO_CTX)).toEqual([2, 1, 3]);
  });

  it("ajout: most recently added first", () => {
    const rows = [
      row(1, "A", "2026-01-01T00:00:00Z"),
      row(2, "B", "2026-03-01T00:00:00Z"),
      row(3, "C", "2026-02-01T00:00:00Z"),
    ];
    expect(sortIds(rows, "ajout", NO_CTX)).toEqual([2, 3, 1]);
  });

  it("sortie: most recently released first, unknown dates sink and tie-break by title", () => {
    const rows = [
      row(1, "Old", "2026-01-01", "2015-05-01"),
      row(2, "New", "2026-01-01", "2024-09-01"),
      row(3, "Zulu", "2026-01-01", null),
      row(4, "Alpha", "2026-01-01", null),
    ];
    // known desc by air date first, then the two null-date rows alpha-sorted.
    expect(sortIds(rows, "sortie", NO_CTX)).toEqual([2, 1, 4, 3]);
  });

  it("progression: fewest episodes left first; missing entries sink; alpha tie-break when none known", () => {
    const seriesRemainingByShowId = new Map([
      [1, 12],
      [2, 3],
    ]);
    const ctx = { lastWatchedAtByShowId: new Map<number, string>(), seriesRemainingByShowId };
    const rows = [
      row(1, "Twelve", "2026-01-01"),
      row(2, "Three", "2026-01-01"),
      row(3, "Unknown", "2026-01-01"),
    ];
    // 2 (3 left) < 1 (12 left) < 3 (no data → sinks to bottom)
    expect(sortIds(rows, "progression", ctx)).toEqual([2, 1, 3]);
  });

  it("progression: with no context map at all, degrades to alphabetical", () => {
    const rows = [
      row(3, "Gamma", "2026-01-01"),
      row(1, "Alpha", "2026-01-01"),
      row(2, "Beta", "2026-01-01"),
    ];
    expect(sortIds(rows, "progression", NO_CTX)).toEqual([1, 2, 3]);
  });

  it("activite: most recently watched first; never-watched sink and tie-break by created_at desc", () => {
    const lastWatchedAtByShowId = new Map([
      [1, "2026-05-01T00:00:00Z"],
      [2, "2026-05-10T00:00:00Z"],
    ]);
    const ctx = { lastWatchedAtByShowId };
    const rows = [
      row(1, "Watched older", "2026-01-01T00:00:00Z"),
      row(2, "Watched newer", "2026-01-01T00:00:00Z"),
      row(3, "Never A", "2026-02-01T00:00:00Z"),
      row(4, "Never B", "2026-03-01T00:00:00Z"),
    ];
    // watched (newer→older), then never-watched by created_at desc (4 before 3).
    expect(sortIds(rows, "activite", ctx)).toEqual([2, 1, 4, 3]);
  });
});
