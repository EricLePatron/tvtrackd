import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { markWatchedOnMutate, markWatchedOnSettled } from "./use-mark-watched";
import {
  deriveHomeView,
  seasonCountKey,
  type ActiveStatus,
  type HomeData,
  type ScheduleEpisode,
  type ShowLite,
} from "@/lib/schedule";

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

  it("[scenario A/B + point 10 + Direction A] rolling back A's failed mutation never erases B's still in-flight optimism (B takes over the hero slot by recency while still in flight), and tapping an a_voir show reclassifies it en_cours", () => {
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
      reprendreProgressByShowId: new Map(),
      nouveau: [],
      readyCount: 0,
      ...ZONE_B,
      raw: {
        episodes,
        showStatusByShowId,
        lastWatchedAtByShowId,
        watchedEpisodeIds: new Set(),
        heroSeasonEpisodeCount: 2, // A's season 1 total (101 + 102)
        reprendreSeasonEpisodeCounts: new Map(),
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
    // [Direction A] A's own optimism reverts fully (whole backlog ready
    // again), but B is STILL in flight and keeps getting bumped to a real
    // `now()` timestamp on every recompute (recomputeFromBatch) — under the
    // recency-based selectHero rule, that now() outranks A's real (but
    // non-"now") watched_at, so B takes over the hero slot and A is demoted
    // into "reprendre". This is intentional (see selectHero's "ASSUMED
    // CONSEQUENCE" doc comment in schedule.ts), not a bug: as far as the
    // optimistic UI can tell at this instant, B was watched more recently
    // than A.
    expect(cur.hero?.show.id).toBe(2);
    expect(cur.hero?.nextEpisode.id).toBe(202);
    // heroSeasonEpisodeCount was fetched for A's season — reset to null now
    // that the hero rotated to a different show/season.
    expect(cur.heroProgress).toBeNull();
    // A demotes into "reprendre" (whole backlog ready again) rather than vanishing.
    expect(cur.reprendre.map((i) => i.show.id)).toEqual([1]);
    expect(cur.reprendre[0]?.nextEpisode.id).toBe(101);
    // *** The critical assertion: B's in-flight optimism SURVIVES A's rollback. ***
    expect(cur.raw.showStatusByShowId.get(2)).toBe("en_cours");
    expect(cur.nouveau).toEqual([]);
    expect(cur.dayGroups).toBe(ZONE_B.dayGroups);
    expect(cur.upcomingCount).toBe(ZONE_B.upcomingCount);
    expect(cur.nextReleases).toBe(ZONE_B.nextReleases);

    // --- B's mutation eventually succeeds — settled via markWatchedOnSettled(..., "success") ---
    markWatchedOnSettled(qc, USER_ID, 201, "success");

    // No cache rewrite on success — still showing B's optimistic state,
    // untouched by the success bookkeeping itself.
    cur = qc.getQueryData<HomeData>(homeKey)!;
    expect(cur.hero?.show.id).toBe(2);
    expect(cur.hero?.nextEpisode.id).toBe(202);
    expect(cur.reprendre.map((i) => i.show.id)).toEqual([1]);
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
      reprendreProgressByShowId: new Map(),
      nouveau: [],
      readyCount: 0,
      ...ZONE_B,
      raw: {
        episodes,
        showStatusByShowId,
        lastWatchedAtByShowId: new Map(),
        watchedEpisodeIds: new Set(),
        heroSeasonEpisodeCount: 1, // fetched for heroShow's season 1
        reprendreSeasonEpisodeCounts: new Map(),
      },
    };
    seedHomeData(qc, USER_ID, initial);

    markWatchedOnMutate(qc, USER_ID, { episodeId: 101, showId: 1 });

    const cur = qc.getQueryData<HomeData>(homeKey)!;
    expect(cur.hero?.show.id).toBe(2); // rotated — show 1 has no ready episode left
    expect(cur.heroProgress).toBeNull();
    expect(cur.raw.heroSeasonEpisodeCount).toBeNull();
  });

  it("[Direction A] tapping the CURRENT hero's own episode keeps it as hero, even with a fresher-backlog en_cours competitor present", () => {
    const qc = new QueryClient();
    const heroShow = show(1, "Hero Show"); // two ready episodes — backlog remains after one tap
    const competitor = show(2, "Ancient Backlog Competitor"); // much older backlog, watched less recently

    const episodes = [
      ep(heroShow, 101, 1, 1, "2026-01-01"),
      ep(heroShow, 102, 1, 2, "2026-01-08"),
      ep(competitor, 201, 1, 1, "2020-01-01"),
    ];
    const showStatusByShowId = new Map<number, ActiveStatus>([
      [1, "en_cours"],
      [2, "en_cours"],
    ]);
    const lastWatchedAtByShowId = new Map([
      [1, "2026-07-05T00:00:00.000Z"], // ~3j — most recently watched, wins hero
      [2, "2026-06-01T00:00:00.000Z"], // fresh, but watched less recently
    ]);

    const raw = {
      episodes,
      showStatusByShowId,
      lastWatchedAtByShowId,
      watchedEpisodeIds: new Set<number>(),
      heroSeasonEpisodeCount: 2,
      reprendreSeasonEpisodeCounts: new Map<string, number>(),
    };
    // Seeded via the real `deriveHomeView` pipeline (not hand-typed
    // hero/reprendre placeholders) so the "before" sanity check below
    // exercises the actual selectHero ranking, not an assumption of it.
    const initial: HomeData = {
      today: TODAY,
      followedActiveCount: 2,
      ...deriveHomeView(raw, TODAY),
      ...ZONE_B,
      raw,
    };
    seedHomeData(qc, USER_ID, initial);

    let cur = qc.getQueryData<HomeData>(homeKey)!;
    expect(cur.hero?.show.id).toBe(1);

    // --- Tap the hero's OWN next episode (101) ---
    markWatchedOnMutate(qc, USER_ID, { episodeId: 101, showId: 1 });

    cur = qc.getQueryData<HomeData>(homeKey)!;
    // The tap bumps show 1's own lastWatchedAt to "now" too — it stays the
    // most recently watched show, so it never paradoxically rotates away to
    // the competitor, even though the competitor is ALSO en_cours and fresh.
    expect(cur.hero?.show.id).toBe(1);
    expect(cur.hero?.nextEpisode.id).toBe(102); // advanced in place, same show/season
    expect(cur.heroProgress).toEqual({ watched: 1, total: 2 }); // heroSeasonEpisodeCount reused — same show/season as before
  });

  // Étage 2.2 (progression saison sur "Reprendre") — exerce
  // `reprendreProgressByShowId` à travers le même chemin optimiste que
  // `heroProgress` ci-dessus, sur le modèle du test de rotation du hero.
  it("[Direction A] tapping a 'Reprendre' row's episode promotes it to hero by recency, demoting the previous hero — season-count reliability resets exactly like any other hero rotation", () => {
    const qc = new QueryClient();
    const heroShow = show(1, "Hero Show"); // most recently watched — legitimately hero before the tap
    const reprendreShow = show(2, "Reprendre Show"); // fresh, but watched less recently — starts in reprendre

    // Reprendre show: season 1 has 10 episodes, 5 already watched — nextEpisode
    // is #6 (id 206). `reprendreSeasonEpisodeCounts` has the matching official
    // count (10), so the tally is reliable from the start.
    const reprendreSeason1 = Array.from({ length: 10 }, (_, i) =>
      ep(reprendreShow, 200 + i + 1, 1, i + 1, `2026-01-${String(i + 1).padStart(2, "0")}`),
    );
    const episodes = [ep(heroShow, 101, 1, 1, "2025-12-01"), ...reprendreSeason1];

    const showStatusByShowId = new Map<number, ActiveStatus>([
      [1, "en_cours"],
      [2, "en_cours"],
    ]);
    const lastWatchedAtByShowId = new Map([
      [1, "2026-07-07T00:00:00.000Z"], // ~1j — most recently watched, wins hero before any tap
      [2, "2026-07-01T00:00:00.000Z"], // ~7j — fresh, but watched less recently than show 1
    ]);
    const watchedEpisodeIds = new Set([201, 202, 203, 204, 205]); // 5/10 — nextEpisode = 206

    const raw = {
      episodes,
      showStatusByShowId,
      lastWatchedAtByShowId,
      watchedEpisodeIds,
      heroSeasonEpisodeCount: 1,
      reprendreSeasonEpisodeCounts: new Map([[seasonCountKey(2, 1), 10]]),
    };
    const initial: HomeData = {
      today: TODAY,
      followedActiveCount: 2,
      ...deriveHomeView(raw, TODAY),
      ...ZONE_B,
      raw,
    };
    seedHomeData(qc, USER_ID, initial);

    // --- Sanity check on the seeded state (before any tap) ---
    let cur = qc.getQueryData<HomeData>(homeKey)!;
    expect(cur.hero?.show.id).toBe(1); // Hero Show: watched most recently
    expect(cur.reprendre.map((i) => i.show.id)).toEqual([2]);
    expect(cur.reprendreProgressByShowId.get(2)).toEqual({ watched: 5, total: 10 });

    // --- Tap the Reprendre row's own next episode (206) ---
    const patched = markWatchedOnMutate(qc, USER_ID, { episodeId: 206, showId: 2 });
    expect(patched).toBe(true);

    cur = qc.getQueryData<HomeData>(homeKey)!;
    // [Direction A] tapping ANY en_cours show's episode bumps its
    // lastWatchedAt to "now" (recomputeFromBatch) — under the recency-based
    // selectHero rule, this makes Reprendre Show the most recently watched
    // en_cours show, so it is promoted to hero IMMEDIATELY, even though its
    // own episode tap has nothing to do with the previous hero. This is the
    // intended behavior ("hero = what I'm watching right now"), not a bug —
    // see selectHero's "ASSUMED CONSEQUENCE" doc comment in schedule.ts.
    expect(cur.hero?.show.id).toBe(2);
    expect(cur.hero?.nextEpisode.id).toBe(207); // advanced past the just-watched 206
    // heroSeasonEpisodeCount was fetched for the OLD hero's season (show 1)
    // — reset to null on rotation exactly like any other hero rotation, so
    // heroProgress is unknown until the next server refetch, never a stale
    // or wrong fraction.
    expect(cur.heroProgress).toBeNull();
    // The previous hero demotes into "reprendre" rather than vanishing.
    expect(cur.reprendre.map((i) => i.show.id)).toEqual([1]);
    expect(cur.reprendre[0]?.nextEpisode.id).toBe(101);
    // Show 1's season was never in `reprendreSeasonEpisodeCounts` (only
    // show 2's season 1 was ever fetched, matching what the initial render
    // actually needed) — no fraction shown for it either, same fail-safe
    // behavior as before.
    expect(cur.reprendreProgressByShowId.has(1)).toBe(false);

    // --- Rollback: the mutation fails ---
    markWatchedOnSettled(qc, USER_ID, 206, "error");

    cur = qc.getQueryData<HomeData>(homeKey)!;
    // Episode 206 reverts to unwatched, and show 2's lastWatchedAt is no
    // longer bumped (206 drained from inFlight) — back to its original,
    // less-recent timestamp, so Hero Show (show 1) reclaims the hero slot.
    expect(cur.hero?.show.id).toBe(1);
    expect(cur.reprendre.map((i) => i.show.id)).toEqual([2]);
    expect(cur.reprendreProgressByShowId.get(2)).toEqual({ watched: 5, total: 10 }); // reverted exactly
    expect(cur.reprendre[0]?.nextEpisode.id).toBe(206);
  });

  it("[Reprendre progress + Direction A] the fraction disappears cleanly (never a wrong one) once the newly-promoted hero's nextEpisode rolls into a season with no official count yet", () => {
    const qc = new QueryClient();
    const heroShow = show(1, "Hero Show");
    const reprendreShow = show(2, "Reprendre Show");

    // Reprendre show: season 1 has only 2 episodes (1 watched, 1 remaining —
    // the finale), plus a lone season 2 episode already aired. Marking the
    // finale rolls `nextEpisode` straight into season 2, a season
    // `reprendreSeasonEpisodeCounts` was never fetched for (only season 1 was,
    // matching what the initial render actually needed).
    const episodes = [
      ep(heroShow, 101, 1, 1, "2025-12-01"),
      ep(reprendreShow, 201, 1, 1, "2026-01-01"),
      ep(reprendreShow, 202, 1, 2, "2026-01-08"), // the finale — about to be tapped
      ep(reprendreShow, 301, 2, 1, "2026-02-01"), // already aired, unwatched
    ];
    const showStatusByShowId = new Map<number, ActiveStatus>([
      [1, "en_cours"],
      [2, "en_cours"],
    ]);
    const lastWatchedAtByShowId = new Map([
      [1, "2026-07-07T00:00:00.000Z"], // most recently watched — hero before the tap
      [2, "2026-07-01T00:00:00.000Z"], // fresh, but watched less recently — starts in reprendre
    ]);
    const watchedEpisodeIds = new Set([201]); // season 1: 1/2 watched — nextEpisode = 202 (finale)

    const raw = {
      episodes,
      showStatusByShowId,
      lastWatchedAtByShowId,
      watchedEpisodeIds,
      heroSeasonEpisodeCount: 1,
      reprendreSeasonEpisodeCounts: new Map([[seasonCountKey(2, 1), 2]]), // season 1 only
    };
    const initial: HomeData = {
      today: TODAY,
      followedActiveCount: 2,
      ...deriveHomeView(raw, TODAY),
      ...ZONE_B,
      raw,
    };
    seedHomeData(qc, USER_ID, initial);

    // --- Sanity check: reliable fraction on season 1 before the tap ---
    let cur = qc.getQueryData<HomeData>(homeKey)!;
    expect(cur.hero?.show.id).toBe(1);
    expect(cur.reprendre[0]?.nextEpisode.id).toBe(202);
    expect(cur.reprendreProgressByShowId.get(2)).toEqual({ watched: 1, total: 2 });

    // --- Tap the season finale (202) — nextEpisode rolls to season 2 (301) ---
    markWatchedOnMutate(qc, USER_ID, { episodeId: 202, showId: 2 });

    cur = qc.getQueryData<HomeData>(homeKey)!;
    // [Direction A]: the tap promotes Reprendre Show to hero (same
    // mechanism as the test above) — its rolled-over episode (301, season 2)
    // is now the HERO's own next episode, not a "Reprendre" row's.
    expect(cur.hero?.show.id).toBe(2);
    expect(cur.hero?.nextEpisode.id).toBe(301); // rolled over to season 2
    // Season 2's official episode count was never fetched (only season 1
    // was) — no fraction shown, never a falsely-reassuring wrong one. Same
    // "unreliable tally omitted" guarantee as before, just surfacing via
    // `heroProgress` now that the row got promoted, instead of via
    // `reprendreProgressByShowId`.
    expect(cur.heroProgress).toBeNull();
    // The previous hero (show 1) demotes into "reprendre" — its own season
    // was never fetched either, so it also shows no fraction.
    expect(cur.reprendre.map((i) => i.show.id)).toEqual([1]);
    expect(cur.reprendreProgressByShowId.has(1)).toBe(false);
    expect(cur.reprendreProgressByShowId.has(2)).toBe(false); // show 2 is hero now, not in reprendre at all
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
      reprendreProgressByShowId: new Map(),
      nouveau: [],
      readyCount: 0,
      ...ZONE_B,
      raw: {
        episodes: [ep(showA, 101, 1, 1, "2026-01-01"), ep(showA, 102, 1, 2, "2026-01-08")],
        showStatusByShowId: new Map<number, ActiveStatus>([[1, "en_cours"]]),
        lastWatchedAtByShowId: new Map(),
        watchedEpisodeIds: new Set(),
        heroSeasonEpisodeCount: 2,
        reprendreSeasonEpisodeCounts: new Map(),
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
        reprendreSeasonEpisodeCounts: new Map(),
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
      reprendreProgressByShowId: new Map(),
      nouveau: [],
      readyCount: 0,
      ...ZONE_B,
      raw: {
        episodes: [ep(s, episodeId, 1, 1, "2026-01-01")],
        showStatusByShowId: new Map<number, ActiveStatus>([[s.id, "en_cours"]]),
        lastWatchedAtByShowId: new Map(),
        watchedEpisodeIds: new Set(),
        heroSeasonEpisodeCount: 1,
        reprendreSeasonEpisodeCounts: new Map(),
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
