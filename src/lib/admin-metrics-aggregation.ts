// Pure, framework/network-free aggregation helpers for the admin dashboard
// (src/routes/_authenticated/admin.tsx via admin-metrics.functions.ts).
// Kept separate from admin-metrics.functions.ts (which does the Supabase
// I/O) so this logic is unit-testable without mocking Supabase — see
// admin-metrics-aggregation.test.ts.

export type SignupDay = { date: string; count: number };
export type SignupHour = { hourIso: string; count: number };
export type TopShow = { title: string; followers: number };

// ─── Signups bucketing ───────────────────────────────────────────────────

/**
 * Buckets a list of ISO creation timestamps into `days` consecutive UTC
 * calendar days starting at `sinceIso` (a UTC-midnight timestamp,
 * YYYY-MM-DDT00:00:00.000Z).
 */
export function bucketSignupsByDay(
  createdAtList: string[],
  sinceIso: string,
  days: number,
): SignupDay[] {
  const since = new Date(sinceIso);
  const dayMap = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setUTCDate(d.getUTCDate() + i);
    dayMap.set(d.toISOString().slice(0, 10), 0);
  }
  for (const createdAt of createdAtList) {
    const day = createdAt.slice(0, 10);
    if (dayMap.has(day)) dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
  }
  return Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

/**
 * Buckets a list of ISO creation timestamps into consecutive UTC hours over
 * a FIXED window [startIso, endIso) — deliberately NOT a rolling "last N
 * hours" window. Used for the TV Time closure (15/07/2026) monitoring
 * sparkline: the window is fixed on the migration week so the closure-date
 * marker is visible in the chart from the moment this ships (J-3), not only
 * once "now" happens to fall within 72h of it.
 */
export function bucketSignupsByHour(
  createdAtList: string[],
  startIso: string,
  endIso: string,
): SignupHour[] {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const hours = Math.round((end.getTime() - start.getTime()) / 3_600_000);
  const hourMap = new Map<string, number>();
  for (let i = 0; i < hours; i++) {
    const h = new Date(start.getTime() + i * 3_600_000);
    hourMap.set(h.toISOString(), 0);
  }
  for (const createdAt of createdAtList) {
    const d = new Date(createdAt);
    if (d < start || d >= end) continue;
    const bucketStart = new Date(d);
    bucketStart.setUTCMinutes(0, 0, 0);
    const key = bucketStart.toISOString();
    if (hourMap.has(key)) hourMap.set(key, (hourMap.get(key) ?? 0) + 1);
  }
  return Array.from(hourMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hourIso, count]) => ({ hourIso, count }));
}

/**
 * Index of `markerIso` (rounded down to the hour) within a
 * `bucketSignupsByHour` result, or null if it falls outside the bucketed
 * range.
 */
export function findHourMarkerIndex(hours: SignupHour[], markerIso: string): number | null {
  const marker = new Date(markerIso);
  marker.setUTCMinutes(0, 0, 0);
  const markerKey = marker.toISOString();
  const idx = hours.findIndex((h) => h.hourIso === markerKey);
  return idx === -1 ? null : idx;
}

// ─── Import runs aggregation ─────────────────────────────────────────────

export type ImportRunRaw = {
  source: string;
  imported_episodes: number;
  followed_shows: number;
  unmatched_count: number;
  total_groups: number | null;
  created_at: string;
};

export type ImportRunsBySourceDay = { date: string; source: string; runs: number };

export type ImportStats = {
  bySourceDay: ImportRunsBySourceDay[];
  totalRuns: number;
  failedRuns: number;
  failureRate: number;
  avgImportedEpisodes: number;
  avgFollowedShows: number;
  matchRate: number | null;
  runsWithMatchData: number;
};

function isFailedRun(run: ImportRunRaw): boolean {
  return run.imported_episodes === 0 && run.followed_shows === 0;
}

/**
 * Aggregates raw `import_runs` rows into the metrics shown in the "Imports"
 * dashboard section.
 *
 * - `avgImportedEpisodes` / `avgFollowedShows` are computed on SUCCESSFUL
 *   runs only (failures excluded) — a run that matched nothing shouldn't
 *   drag down "average history volume recovered" for runs that did work.
 * - `matchRate` is a WEIGHTED aggregate — sum(matched) / sum(total_groups)
 *   across runs where `total_groups` is known and usable — rather than an
 *   average of per-run rates, so a run with 500 groups isn't diluted to the
 *   same weight as a run with 2 groups. Two cases are excluded from the
 *   denominator, not treated as 0/0:
 *     - `total_groups === null` (run created before that column existed —
 *       non calculable rétroactivement)
 *     - `total_groups === 0` (a run with literally nothing to match has no
 *       matching signal to contribute, positive or negative)
 *   `runsWithMatchData` exposes how many runs fed the rate so the UI can be
 *   transparent about partial historical coverage.
 */
export function computeImportStats(runs: ImportRunRaw[]): ImportStats {
  const totalRuns = runs.length;
  const failedRuns = runs.filter(isFailedRun).length;
  const failureRate = totalRuns === 0 ? 0 : failedRuns / totalRuns;

  const successfulRuns = runs.filter((r) => !isFailedRun(r));
  const avgImportedEpisodes =
    successfulRuns.length === 0
      ? 0
      : successfulRuns.reduce((sum, r) => sum + r.imported_episodes, 0) / successfulRuns.length;
  const avgFollowedShows =
    successfulRuns.length === 0
      ? 0
      : successfulRuns.reduce((sum, r) => sum + r.followed_shows, 0) / successfulRuns.length;

  const runsWithMatchData = runs.filter(
    (r): r is ImportRunRaw & { total_groups: number } =>
      r.total_groups !== null && r.total_groups > 0,
  );
  let matchRate: number | null = null;
  if (runsWithMatchData.length > 0) {
    const totalGroupsSum = runsWithMatchData.reduce((sum, r) => sum + r.total_groups, 0);
    const matchedSum = runsWithMatchData.reduce(
      (sum, r) => sum + (r.total_groups - r.unmatched_count),
      0,
    );
    matchRate = totalGroupsSum === 0 ? null : matchedSum / totalGroupsSum;
  }

  const bySourceMap = new Map<string, number>();
  for (const run of runs) {
    const day = run.created_at.slice(0, 10);
    const source = run.source || "inconnu";
    const key = `${day}|${source}`;
    bySourceMap.set(key, (bySourceMap.get(key) ?? 0) + 1);
  }
  const bySourceDay: ImportRunsBySourceDay[] = Array.from(bySourceMap.entries())
    .map(([key, count]) => {
      const [date, source] = key.split("|");
      return { date, source, runs: count };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.source.localeCompare(b.source));

  return {
    bySourceDay,
    totalRuns,
    failedRuns,
    failureRate,
    avgImportedEpisodes,
    avgFollowedShows,
    matchRate,
    runsWithMatchData: runsWithMatchData.length,
  };
}

// ─── user_shows split by status (a_voir / en_cours) ──────────────────────

export type UserShowStatusRow = { show_id: number; status: string; title: string };

export type SplitShowsByStatus = {
  activeShowsAVoir: number;
  activeShowsEnCours: number;
  topShowsAVoir: TopShow[];
  topShowsEnCours: TopShow[];
};

const ACTIVE_STATUSES = ["a_voir", "en_cours"] as const;

/**
 * Splits `user_shows` rows (already filtered to a_voir/en_cours upstream —
 * this function still ignores any other status defensively) into per-status
 * counts and top-10 rankings. Row-count semantics match the previous
 * `activeShows` KPI exactly (count of user_shows entries, not distinct
 * shows) — only the split by status is new.
 */
export function splitShowsByStatus(rows: UserShowStatusRow[]): SplitShowsByStatus {
  const counts = new Map<string, { title: string; count: number }>();
  let activeShowsAVoir = 0;
  let activeShowsEnCours = 0;

  for (const row of rows) {
    if (!(ACTIVE_STATUSES as readonly string[]).includes(row.status)) continue;
    if (row.status === "a_voir") activeShowsAVoir += 1;
    else activeShowsEnCours += 1;

    const key = `${row.status}|${row.show_id}`;
    const prev = counts.get(key) ?? { title: row.title, count: 0 };
    counts.set(key, { title: prev.title, count: prev.count + 1 });
  }

  function topN(status: string): TopShow[] {
    return Array.from(counts.entries())
      .filter(([key]) => key.startsWith(`${status}|`))
      .map(([, v]) => ({ title: v.title, followers: v.count }))
      .sort((a, b) => b.followers - a.followers)
      .slice(0, 10);
  }

  return {
    activeShowsAVoir,
    activeShowsEnCours,
    topShowsAVoir: topN("a_voir"),
    topShowsEnCours: topN("en_cours"),
  };
}
