import { describe, expect, it } from "vitest";

import {
  SHARE_FORMATS,
  boxById,
  layoutEpisode,
  layoutSeason,
  layoutWeek,
  posterRects,
  type ShareFormat,
  type ShareLayout,
} from "./share-layout";

const FORMATS: ShareFormat[] = ["story", "post"];
const TITLE_SIZES = [84, 66, 48]; // titre court → très long (fit jusqu'au min)

function intersects(a: { x: number; y: number; w: number; h: number }, b: typeof a) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function expectSound(layout: ShareLayout) {
  const { spec, boxes } = layout;
  for (const b of boxes) {
    expect(b.y, `${b.id} haut`).toBeGreaterThanOrEqual(spec.top);
    expect(b.y + b.h, `${b.id} bas`).toBeLessThanOrEqual(spec.bottom);
    expect(b.x, `${b.id} gauche`).toBeGreaterThanOrEqual(0);
    expect(b.x + b.w, `${b.id} droite`).toBeLessThanOrEqual(spec.width);
  }
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      expect(intersects(boxes[i], boxes[j]), `${boxes[i].id} x ${boxes[j].id}`).toBe(false);
    }
  }
  // Le pied est ancré en bas de la zone de contenu.
  const footer = boxById(layout, "footer")!;
  expect(footer.y + footer.h).toBe(spec.bottom);
}

describe("share-layout", () => {
  for (const format of FORMATS) {
    for (const titleSize of TITLE_SIZES) {
      it(`épisode ${format} titre ${titleSize}px : sans chevauchement, dans la zone sûre`, () => {
        for (const hasEpisodeTitle of [true, false]) {
          expectSound(layoutEpisode(format, { titleSize, hasEpisodeTitle }));
        }
      });

      it(`saison ${format} titre ${titleSize}px : sans chevauchement, dans la zone sûre`, () => {
        const layout = layoutSeason(format, { titleSize });
        expectSound(layout);
        // L'affiche reste entière (ratio 2:3 conservé).
        const m = boxById(layout, "media")!;
        expect(Math.abs(m.w / m.h - 2 / 3)).toBeLessThan(0.01);
      });
    }

    for (const posterCount of [0, 1, 2, 3, 4, 7]) {
      it(`semaine ${format} avec ${posterCount} affiche(s) : sans chevauchement`, () => {
        const layout = layoutWeek(format, { posterCount });
        expectSound(layout);
        const box = boxById(layout, "posters");
        const rects = box ? posterRects(box, posterCount) : [];
        expect(rects.length).toBe(Math.min(posterCount, 4));
        for (let i = 0; i < rects.length; i++) {
          expect(rects[i].x + rects[i].w).toBeLessThanOrEqual(1080 - 72);
          for (let j = i + 1; j < rects.length; j++) {
            expect(intersects(rects[i], rects[j])).toBe(false);
          }
        }
      });
    }
  }

  it("épisode story : still 936×527 à taille nominale", () => {
    const m = boxById(layoutEpisode("story", { titleSize: 84, hasEpisodeTitle: true }), "media")!;
    expect([m.w, m.h]).toEqual([936, 527]);
  });

  it("semaine : 4 affiches 216×324, gouttière 24, remplissent 936 px", () => {
    const layout = layoutWeek("story", { posterCount: 4 });
    const rects = posterRects(boxById(layout, "posters")!, 4);
    expect([rects[0].w, rects[0].h]).toEqual([216, 324]);
    expect(rects[1].x - (rects[0].x + rects[0].w)).toBe(24);
    expect(rects[3].x + rects[3].w).toBe(72 + 936);
  });

  it("la zone de contenu story est y 300 → 1490", () => {
    expect(SHARE_FORMATS.story.top).toBe(300);
    expect(SHARE_FORMATS.story.bottom).toBe(1490);
  });
});
