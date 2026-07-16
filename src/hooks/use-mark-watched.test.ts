import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { markWatchedOnError, markWatchedOnMutate, markWatchedOnSuccess } from "./use-mark-watched";
import type { ActiveStatus, HomeData, ScheduleEpisode, ShowLite } from "@/lib/schedule";

/**
 * Exercises `markWatchedOnMutate`/`markWatchedOnError`/`markWatchedOnSuccess`
 * directly against a plain `new QueryClient()` — no React rendering needed,
 * these are exported specifically to be testable this way (see their doc
 * comments in `use-mark-watched.ts`).
 */

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
const USER_ID = "user-1";
const homeKey = ["home-schedule", USER_ID] as const;

// Sentinel Zone B values — distinct object identities so a passthrough vs. a
// (buggy) recompute-from-scratch can be told apart via `toBe` (identity), not
// just `toEqual` (deep value).
const ZONE_B = {
  dayGroups: [{ date: "2099-01-01", entries: [] }],
  upcomingCount: 42,
  countdown: null,
};

function seedHomeData(qc: QueryClient, data: HomeData) {
  qc.setQueryData(homeKey, data);
}

describe("markWatchedOnMutate / markWatchedOnError / markWatchedOnSuccess", () => {
  it('no-ops when ["home-schedule", userId] isn\'t cached at all (calendar-only session)', () => {
    const qc = new QueryClient();

    const patched = markWatchedOnMutate(qc, USER_ID, { episodeId: 999, showId: 1 });

    expect(patched).toBe(false);
    expect(qc.getQueryData(homeKey)).toBeUndefined();

    // onError/onSuccess must also be safe no-ops with no prior batch state.
    expect(() => markWatchedOnError(qc, USER_ID, 999)).not.toThrow();
    expect(() => markWatchedOnSuccess(qc, USER_ID, 999)).not.toThrow();
    expect(qc.getQueryData(homeKey)).toBeUndefined();
  });

  it("[scenario A/B + point 10] rolling back A's failed mutation never erases B's still in-flight optimism, and tapping an a_voir show reclassifies it en_cours", () => {
    const qc = new QueryClient();
    const a = show(1, "Hero Show"); // en_cours from the start
    const b = show(2, "Nouveau Show"); // a_voir from the start — point 10 target

    const episodes = [
      ep(a, 101, 1, 1, "2026-01-01"),
      ep(a, 102, 1, 2, "2026-01-08"),
      ep(b, 201, 1, 1, "2026-02-01"),
      ep(b, 202, 1, 2, "2026-02-08"),
    ];
    const showStatusByShowId = new Map<number, ActiveStatus>([
      [1, "en_cours"],
      [2, "a_voir"],
    ]);
    const lastWatchedAtByShowId = new Map([[1, "2026-07-01T00:00:00.000Z"]]); // A watched recently; B never watched

    const initial: HomeData = {
      today: TODAY,
      followedActiveCount: 2,
      hero: null, // irrelevant here — components only ever read from the cache after these calls
      heroProgress: null,
      reprendre: [],
      nouveau: [],
      readyCount: 0,
      ...ZONE_B,
      raw: {
        episodes,
        showStatusByShowId,
        lastWatchedAtByShowId,
        watchedEpisodeIds: new Set(),
        heroSeasonEpisodeCount: 2, // A's season 1 total (101 + 102)
      },
    };
    seedHomeData(qc, initial);

    // --- Sanity check on the seeded state (before any tap) ---
    let cur = qc.getQueryData<HomeData>(homeKey)!;
    expect(cur.raw.showStatusByShowId.get(2)).toBe("a_voir");

    // --- Tap A (episode 101) ---
    const patchedA = markWatchedOnMutate(qc, USER_ID, { episodeId: 101, showId: 1 });
    expect(patchedA).toBe(true);

    cur = qc.getQueryData<HomeData>(homeKey)!;
    expect(cur.hero?.show.id).toBe(1);
    expect(cur.hero?.nextEpisode.id).toBe(102); // advanced in place
    expect(cur.heroProgress).toEqual({ watched: 1, total: 2 }); // heroSeasonEpisodeCount reused
    expect(cur.nouveau.map((i) => i.show.id)).toEqual([2]); // B untouched so far
    expect(cur.reprendre).toEqual([]);
    expect(cur.dayGroups).toBe(ZONE_B.dayGroups); // Zone B untouched (identity)
    expect(cur.upcomingCount).toBe(ZONE_B.upcomingCount);

    // --- Tap B (episode 201) while A is still in flight ---
    const patchedB = markWatchedOnMutate(qc, USER_ID, { episodeId: 201, showId: 2 });
    expect(patchedB).toBe(true);

    cur = qc.getQueryData<HomeData>(homeKey)!;
    // A's optimism is untouched by B's tap.
    expect(cur.hero?.show.id).toBe(1);
    expect(cur.hero?.nextEpisode.id).toBe(102);
    expect(cur.heroProgress).toEqual({ watched: 1, total: 2 });
    // Point 10: B (a_voir) is reclassified en_cours the moment it has an
    // in-flight tap, with backlog remaining (202) — moves out of "nouveau"
    // into "reprendre".
    expect(cur.raw.showStatusByShowId.get(2)).toBe("en_cours");
    expect(cur.nouveau).toEqual([]);
    expect(cur.reprendre.map((i) => i.show.id)).toEqual([2]);
    expect(cur.reprendre[0]?.nextEpisode.id).toBe(202);
    expect(cur.dayGroups).toBe(ZONE_B.dayGroups);
    expect(cur.upcomingCount).toBe(ZONE_B.upcomingCount);

    // --- A's mutation fails (network error) ---
    markWatchedOnError(qc, USER_ID, 101);

    cur = qc.getQueryData<HomeData>(homeKey)!;
    // A reverts fully (back to pointing at 101, original heroProgress).
    expect(cur.hero?.show.id).toBe(1);
    expect(cur.hero?.nextEpisode.id).toBe(101);
    expect(cur.heroProgress).toEqual({ watched: 0, total: 2 });
    // *** The critical assertion: B's in-flight optimism SURVIVES A's rollback. ***
    expect(cur.raw.showStatusByShowId.get(2)).toBe("en_cours");
    expect(cur.nouveau).toEqual([]);
    expect(cur.reprendre.map((i) => i.show.id)).toEqual([2]);
    expect(cur.reprendre[0]?.nextEpisode.id).toBe(202);
    expect(cur.dayGroups).toBe(ZONE_B.dayGroups);
    expect(cur.upcomingCount).toBe(ZONE_B.upcomingCount);

    // --- B's mutation eventually succeeds ---
    markWatchedOnSuccess(qc, USER_ID, 201);

    // No cache rewrite on success — still showing B's optimistic state,
    // untouched by the success bookkeeping itself.
    cur = qc.getQueryData<HomeData>(homeKey)!;
    expect(cur.reprendre.map((i) => i.show.id)).toEqual([2]);
    expect(cur.hero?.nextEpisode.id).toBe(101);
  });

  it("resets heroSeasonEpisodeCount to null once the hero rotates to a different show/season", () => {
    const qc = new QueryClient();
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

    const initial: HomeData = {
      today: TODAY,
      followedActiveCount: 2,
      hero: null,
      heroProgress: null,
      reprendre: [],
      nouveau: [],
      readyCount: 0,
      ...ZONE_B,
      raw: {
        episodes,
        showStatusByShowId,
        lastWatchedAtByShowId: new Map(),
        watchedEpisodeIds: new Set(),
        heroSeasonEpisodeCount: 1, // fetched for heroShow's season 1
      },
    };
    seedHomeData(qc, initial);

    markWatchedOnMutate(qc, USER_ID, { episodeId: 101, showId: 1 });

    const cur = qc.getQueryData<HomeData>(homeKey)!;
    expect(cur.hero?.show.id).toBe(2); // rotated — show 1 has no ready episode left
    expect(cur.heroProgress).toBeNull();
    expect(cur.raw.heroSeasonEpisodeCount).toBeNull();
  });
});
