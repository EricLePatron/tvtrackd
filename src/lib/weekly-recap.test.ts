import { describe, expect, it } from "vitest";

import {
  computeWeeklyRecap,
  startOfWeek,
  weekRangeLabel,
  type RecapRow,
} from "./weekly-recap";

// Mercredi 28 octobre 2026, 15:00 (heure locale du runner).
const NOW = new Date(2026, 9, 28, 15, 0, 0);

const row = (over: Partial<RecapRow> & { at: Date }): RecapRow => ({
  watched_at: over.at.toISOString(),
  watched_at_approximate: false,
  show_id: 1,
  title: "Série A",
  poster_path: "https://img/a.jpg",
  ...over,
});

describe("startOfWeek", () => {
  it("renvoie le lundi 00:00 local", () => {
    const s = startOfWeek(NOW);
    expect([s.getFullYear(), s.getMonth(), s.getDate(), s.getHours()]).toEqual([2026, 9, 26, 0]);
  });
  it("le dimanche appartient à la semaine qui finit", () => {
    const s = startOfWeek(new Date(2026, 10, 1, 23, 59));
    expect(s.getDate()).toBe(26);
  });
});

describe("computeWeeklyRecap", () => {
  it("compte les épisodes de lundi à dimanche, bornes incluses/exclues", () => {
    const rows = [
      row({ at: new Date(2026, 9, 26, 0, 0, 0) }), // lundi 00:00 : inclus
      row({ at: new Date(2026, 9, 25, 23, 59, 59) }), // dimanche précédent : exclu
      row({ at: new Date(2026, 10, 1, 23, 59, 59) }), // dimanche 23:59 : inclus
      row({ at: new Date(2026, 10, 2, 0, 0, 0) }), // lundi suivant : exclu
    ];
    expect(computeWeeklyRecap(rows, NOW).episodes).toBe(2);
  });

  it("exclut les dates approximatives (import)", () => {
    const rows = [
      row({ at: new Date(2026, 9, 27, 10), watched_at_approximate: true }),
      row({ at: new Date(2026, 9, 27, 11) }),
    ];
    expect(computeWeeklyRecap(rows, NOW).episodes).toBe(1);
  });

  it("classe les séries par épisodes vus décroissants", () => {
    const rows = [
      row({ at: new Date(2026, 9, 26, 20), show_id: 1, title: "A" }),
      row({ at: new Date(2026, 9, 27, 20), show_id: 2, title: "B" }),
      row({ at: new Date(2026, 9, 27, 21), show_id: 2, title: "B" }),
      row({ at: new Date(2026, 9, 27, 22), show_id: 2, title: "B" }),
    ];
    const r = computeWeeklyRecap(rows, NOW);
    expect(r.episodes).toBe(4);
    expect(r.showsCount).toBe(2);
    expect(r.topShows.map((s) => [s.showId, s.count])).toEqual([
      [2, 3],
      [1, 1],
    ]);
  });

  it("semaine vide", () => {
    const r = computeWeeklyRecap([], NOW);
    expect(r.episodes).toBe(0);
    expect(r.topShows).toEqual([]);
    expect(r.rangeLabel).toBe("26 OCT. → 1 NOV.");
  });
});

describe("weekRangeLabel", () => {
  it("même mois", () => {
    expect(weekRangeLabel(new Date(2026, 9, 19), new Date(2026, 9, 25))).toBe("19 → 25 OCT.");
  });
  it("chevauchement de deux mois", () => {
    expect(weekRangeLabel(new Date(2026, 9, 26), new Date(2026, 10, 1))).toBe("26 OCT. → 1 NOV.");
  });
});
