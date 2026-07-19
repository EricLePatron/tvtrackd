/**
 * Pure sort logic for the library grid, extracted from `library.tsx` so it can
 * be unit-tested in isolation (cf. `library-sort.test.ts`) rather than living
 * inline in a route component with no test surface. Kept intentionally free of
 * React/Supabase types — it operates on the minimal shape it actually needs.
 */

export type LibrarySortKey = "activite" | "progression" | "titre" | "ajout" | "sortie";

export type SortableRow = {
  created_at: string;
  show: {
    id: number;
    title: string;
    first_air_date: string | null;
  };
};

export type LibrarySortContext = {
  lastWatchedAtByShowId: ReadonlyMap<number, string>;
  /**
   * Series-wide unwatched backlog per show. Only populated for the "En cours"
   * tab (the only one that fetches per-episode progress) — on every other tab
   * "progression" degrades to alphabetical rather than firing a second, more
   * expensive query just to support one sort option outside its home tab.
   */
  seriesRemainingByShowId?: ReadonlyMap<number, number>;
};

export function compareLibraryRows(
  a: SortableRow,
  b: SortableRow,
  sortKey: LibrarySortKey,
  ctx: LibrarySortContext,
): number {
  const showA = a.show;
  const showB = b.show;

  switch (sortKey) {
    case "titre":
      return showA.title.localeCompare(showB.title);

    case "ajout":
      // ISO timestamps sort correctly lexicographically — desc (most recently added first).
      return b.created_at.localeCompare(a.created_at);

    case "sortie": {
      const da = showA.first_air_date;
      const db = showB.first_air_date;
      if (!da && !db) return showA.title.localeCompare(showB.title);
      if (!da) return 1; // unknown release date sinks to the bottom
      if (!db) return -1;
      return db.localeCompare(da); // desc — most recently released first
    }

    case "progression": {
      const ra = ctx.seriesRemainingByShowId?.get(showA.id);
      const rb = ctx.seriesRemainingByShowId?.get(showB.id);
      if (ra === undefined && rb === undefined) return showA.title.localeCompare(showB.title);
      if (ra === undefined) return 1;
      if (rb === undefined) return -1;
      return ra - rb; // ascending — fewest episodes left first
    }

    case "activite":
    default: {
      const la = ctx.lastWatchedAtByShowId.get(showA.id);
      const lb = ctx.lastWatchedAtByShowId.get(showB.id);
      // Never watched — falls back to recently added, same tie-break as "ajout".
      if (!la && !lb) return b.created_at.localeCompare(a.created_at);
      if (!la) return 1;
      if (!lb) return -1;
      return new Date(lb).getTime() - new Date(la).getTime(); // desc — most recently watched first
    }
  }
}
