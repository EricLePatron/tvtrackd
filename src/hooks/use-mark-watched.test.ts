import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { markWatchedOnMutate, markWatchedOnSettled } from "./use-mark-watched";
import type { ActiveStatus, HomeData, ScheduleEpisode, ShowLite } from "@/lib/schedule";

/**
 * Exercises `markWatchedOnMutate`/`markWatchedOnSettled` directly against a
 * plain `new QueryClient()` — no React rendering needed, these are exported
 * specifically to be testable this way (see their doc comments in
 * `use-mark-watched.ts`). Both take `userId` as a plain, explicit parameter —
 * never a reactive `user` read from `useAuth()` — which is the whole point
 * of the fix in this lot (see the "course logout" test below).
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
// just `toEqual` (deep value). `nextReleases` (the "Bientôt" block data) is
// derived from `dayGroups` exactly like `upcomingCount` — never from the
// watched set — so it must survive a mark-watched mutation unchanged too,
// same as the rest of Zone B. (`countdown` was retired from `HomeData`
// entirely — the old `nextCountdown`/`NothingNowCountdownTicket` pair has
// been replaced by `selectNextReleases`/`nextReleases`, the same data this
// sentinel already covers.)
const ZONE_B = {
  dayGroups: [{ date: "2099-01-01", entries: [] }],
  upcomingCount: 42,
  nextReleases: [
    {
      show: show(999, "Sentinel Next Release"),
      episode: ep(show(999), 9001, 1, 1, "2099-01-01"),
      date: "2099-01-01",
      daysUntil: 1000,
    },
  ],
};

function seedHomeData(qc: QueryClient, userId: string, data: HomeData) {
  qc.setQueryData(["home-schedule", userId], data);
}

describe("markWatchedOnMutate / markWatchedOnSettled", () => {
  it('no-ops when ["home-schedule", userId] isn\'t cached at all (calendar-only session)', () => {
    const qc = new QueryClient();

    const patched = markWatchedOnMutate(qc, USER_ID, { episodeId: 999, showId: 1 });

    expect(patched).toBe(false);
    expect(qc.getQueryData(homeKey)).toBeUndefined();

    // onSettled (both outcomes) must also be safe no-ops with no prior batch state.
    expect(() => markWatchedOnSettled(qc, USER_ID, 999, "error")).not.toThrow();
    expect(() => markWatchedOnSettled(qc, USER_ID, 999, "success")).not.toThrow();
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
    seedHomeData(qc, USER_ID, initial);

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
    expect(cur.nextReleases).toBe(ZONE_B.nextReleases);

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
    expect(cur.nextReleases).toBe(ZONE_B.nextReleases);

    // --- A's mutation fails (network error) — settled via markWatchedOnSettled(..., "error") ---
    markWatchedOnSettled(qc, USER_ID, 101, "error");

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
    expect(cur.nextReleases).toBe(ZONE_B.nextReleases);

    // --- B's mutation eventually succeeds — settled via markWatchedOnSettled(..., "success") ---
    markWatchedOnSettled(qc, USER_ID, 201, "success");

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
    seedHomeData(qc, USER_ID, initial);

    markWatchedOnMutate(qc, USER_ID, { episodeId: 101, showId: 1 });

    const cur = qc.getQueryData<HomeData>(homeKey)!;
    expect(cur.hero?.show.id).toBe(2); // rotated — show 1 has no ready episode left
    expect(cur.heroProgress).toBeNull();
    expect(cur.raw.heroSeasonEpisodeCount).toBeNull();
  });

  // TODO: la régression réelle corrigée dans ce lot (relecture RÉACTIVE de
  // `user` depuis `useAuth()` dans les callbacks `onError`/`onSuccess` du
  // hook, plutôt que le `userId` figé au `onMutate`) vit dans le câblage React
  // de `useMarkWatched` lui-même, pas dans `markWatchedOnSettled`. La couvrir
  // vraiment demanderait un `renderHook(useMarkWatched)` + un mock de
  // `useAuth` simulant un `user` qui devient `null` en plein vol d'une
  // mutation — non ajouté ici : `@testing-library/react` n'est pas
  // installable dans ce sandbox (registre npm privé bloqué, cf. les autres
  // limitations déjà documentées dans ce fichier/repo). À faire dans un
  // environnement CI avec accès npm.
  it("[markWatchedOnSettled] always drains inFlight regardless of the outcome, so a later mutate recaptures a fresh base", () => {
    // NE reproduit PAS le bug de câblage du hook (voir le TODO ci-dessus) —
    // cet appel direct à `markWatchedOnSettled(qc, USER_ID, ...)` avec un
    // `USER_ID` constant ne passe jamais par `onMutate`/`onError`/`onSettled`
    // de `useMarkWatched`, l'endroit où vivait la relecture réactive de
    // `user`. Ce test aurait donc été vert même sur le code buggé de
    // `b1d3764` : c'est un test de non-régression de `markWatchedOnSettled`
    // EN ISOLATION (elle draine bien `inFlight` quel que soit `outcome`, ce
    // qui permet à `markWatchedOnMutate` de recapturer une base fraîche),
    // pas un test de la correction du bug de closure elle-même.
    const qc = new QueryClient();
    const showA = show(1, "Show A");
    const v1: HomeData = {
      today: TODAY,
      followedActiveCount: 1,
      hero: null,
      heroProgress: null,
      reprendre: [],
      nouveau: [],
      readyCount: 0,
      ...ZONE_B,
      raw: {
        episodes: [ep(showA, 101, 1, 1, "2026-01-01"), ep(showA, 102, 1, 2, "2026-01-08")],
        showStatusByShowId: new Map<number, ActiveStatus>([[1, "en_cours"]]),
        lastWatchedAtByShowId: new Map(),
        watchedEpisodeIds: new Set(),
        heroSeasonEpisodeCount: 2,
      },
    };
    seedHomeData(qc, USER_ID, v1);

    markWatchedOnMutate(qc, USER_ID, { episodeId: 101, showId: 1 });
    let cur = qc.getQueryData<HomeData>(homeKey)!;
    expect(cur.hero?.nextEpisode.id).toBe(102);

    // The mutation settles (success) — the hook always calls this with the
    // FROZEN ctx.userId, never a possibly-null "live" user.
    markWatchedOnSettled(qc, USER_ID, 101, "success");

    // A legitimate server refetch lands in the meantime (triggered by the
    // real onSettled's invalidateQueries): server confirms 101 watched AND
    // reveals a brand-new episode (103) the client never knew about before.
    // hero/heroProgress/etc. would normally be filled in by the real queryFn
    // via deriveHomeView — irrelevant to this test, only `raw` matters (it's
    // what `markWatchedOnMutate` reads to recapture `base`).
    const v2: HomeData = {
      ...v1,
      hero: null,
      heroProgress: null,
      raw: {
        episodes: [
          ep(showA, 101, 1, 1, "2026-01-01"),
          ep(showA, 102, 1, 2, "2026-01-08"),
          ep(showA, 103, 1, 3, "2026-01-15"),
        ],
        showStatusByShowId: new Map<number, ActiveStatus>([[1, "en_cours"]]),
        lastWatchedAtByShowId: new Map([[1, "2026-07-08T00:00:00.000Z"]]),
        watchedEpisodeIds: new Set([101]),
        heroSeasonEpisodeCount: 3, // official count grew server-side
      },
    };
    seedHomeData(qc, USER_ID, v2);

    // If the batch had been left stuck (bug), `inFlight` would still contain
    // the stale `101` entry and this call would reuse the OLD `base` (v1) —
    // episode 103 (unknown to v1) could never appear, and the total would
    // stay wrongly capped at 2. With the fix, the batch fully drained above,
    // so this recaptures `base` fresh from v2.
    markWatchedOnMutate(qc, USER_ID, { episodeId: 102, showId: 1 });

    cur = qc.getQueryData<HomeData>(homeKey)!;
    expect(cur.hero?.nextEpisode.id).toBe(103); // only reachable if `base` was refreshed to v2
    expect(cur.heroProgress).toEqual({ watched: 2, total: 3 });
  });

  it("[multi-userId isolation] a tap for user A never writes into user B's HomeData/batch on the same QueryClient", () => {
    const qc = new QueryClient();
    const userA = "user-a";
    const userB = "user-b";
    const showA = show(1, "Show A");
    const showB = show(2, "Show B");

    const dataFor = (s: ShowLite, episodeId: number): HomeData => ({
      today: TODAY,
      followedActiveCount: 1,
      hero: null,
      heroProgress: null,
      reprendre: [],
      nouveau: [],
      readyCount: 0,
      ...ZONE_B,
      raw: {
        episodes: [ep(s, episodeId, 1, 1, "2026-01-01")],
        showStatusByShowId: new Map<number, ActiveStatus>([[s.id, "en_cours"]]),
        lastWatchedAtByShowId: new Map(),
        watchedEpisodeIds: new Set(),
        heroSeasonEpisodeCount: 1,
      },
    });

    const initialA = dataFor(showA, 101);
    const initialB = dataFor(showB, 201);
    seedHomeData(qc, userA, initialA);
    seedHomeData(qc, userB, initialB);

    markWatchedOnMutate(qc, userA, { episodeId: 101, showId: 1 });

    // User A's own cache entry is patched...
    const curA = qc.getQueryData<HomeData>(["home-schedule", userA])!;
    expect(curA.raw.watchedEpisodeIds.has(101)).toBe(true);

    // ...but user B's entry is entirely untouched — same object identity as
    // what was seeded, not just deep-equal.
    const curB = qc.getQueryData<HomeData>(["home-schedule", userB]);
    expect(curB).toBe(initialB);
    expect(curB!.raw.watchedEpisodeIds.has(201)).toBe(false);

    // Settling user A's mutation must not affect user B's (nonexistent)
    // batch — a settle call for an episode B never touched is a safe no-op.
    expect(() => markWatchedOnSettled(qc, userB, 201, "error")).not.toThrow();
    const curBAfter = qc.getQueryData<HomeData>(["home-schedule", userB]);
    expect(curBAfter).toBe(initialB);
  });
});
