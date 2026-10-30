/**
 * Mise en page des cartes de partage — module pur (aucune dépendance canvas).
 *
 * Principe (cf. docs/design/share-cards.md §3.1) : toutes les hauteurs de
 * texte sont connues d'avance, le pied de carte est ancré en bas de la zone
 * de contenu, et le visuel principal se voit attribuer la hauteur RÉSIDUELLE
 * (borné par un min). Aucune boîte n'est jamais « remontée » après coup : si
 * la pile ne tient pas, c'est le visuel qui cède de la place.
 */

export type ShareFormat = "story" | "post";

export type FormatSpec = {
  width: number;
  height: number;
  /** Début de la zone de contenu (zone sûre / recadrage). */
  top: number;
  /** Fin de la zone de contenu. */
  bottom: number;
};

export const SHARE_FORMATS: Record<ShareFormat, FormatSpec> = {
  // Contenu dans l'intersection zone sûre Instagram ∩ recadrage 4:5.
  story: { width: 1080, height: 1920, top: 300, bottom: 1490 },
  post: { width: 1080, height: 1350, top: 72, bottom: 1278 },
};

export const SHARE_PAD = 72;
export const SHARE_CONTENT_W = 1080 - SHARE_PAD * 2; // 936

export const FOOTER_H = 58;
/** Espace minimal entre le dernier bloc et le pied. */
const FOOTER_GAP = 40;
/** Écart maximal ajouté entre deux blocs quand il reste de la place. */
const MAX_EXTRA_GAP = 40;

export type LayoutBox = { id: string; x: number; y: number; w: number; h: number };

export type ShareLayout = {
  format: ShareFormat;
  spec: FormatSpec;
  boxes: LayoutBox[];
};

type StackItem = {
  id: string;
  w: number;
  h: number;
  /** Écart nominal sous le bloc. */
  gap: number;
  x?: number;
  /** Hauteur minimale si le bloc doit céder de la place (visuel). */
  minH?: number;
  /** Ratio largeur/hauteur à conserver quand le bloc rétrécit. */
  aspect?: number;
};

/** Hauteur d'une ligne de texte à partir de la taille de police. */
export function lineHeight(size: number, factor = 1.15) {
  return Math.round(size * factor);
}

function stack(format: ShareFormat, items: StackItem[]): ShareLayout {
  const spec = SHARE_FORMATS[format];
  const footerY = spec.bottom - FOOTER_H;
  const available = footerY - FOOTER_GAP - spec.top;

  const sized = items.map((it) => ({ ...it }));
  const total = () => sized.reduce((s, it, i) => s + it.h + (i < sized.length - 1 ? it.gap : 0), 0);

  // 1) Débordement : les blocs flexibles cèdent la hauteur manquante.
  let overflow = total() - available;
  if (overflow > 0) {
    for (const it of sized) {
      if (overflow <= 0) break;
      if (it.minH == null) continue;
      const give = Math.min(overflow, it.h - it.minH);
      if (give <= 0) continue;
      it.h -= give;
      if (it.aspect) it.w = Math.round(it.h * it.aspect);
      overflow -= give;
    }
  }

  // 2) Reste de place : on aère les intervalles (plafonné), jamais le pied.
  const free = Math.max(0, available - total());
  const gaps = Math.max(1, sized.length - 1);
  const extra = Math.min(MAX_EXTRA_GAP, Math.floor(free / gaps));

  const boxes: LayoutBox[] = [];
  let y = spec.top;
  sized.forEach((it, i) => {
    boxes.push({ id: it.id, x: it.x ?? SHARE_PAD, y, w: it.w, h: it.h });
    y += it.h + (i < sized.length - 1 ? it.gap + extra : 0);
  });
  boxes.push({
    id: "footer",
    x: SHARE_PAD,
    y: footerY,
    w: SHARE_CONTENT_W,
    h: FOOTER_H,
  });
  return { format, spec, boxes };
}

const EYEBROW_H = 34;

/** Carte « épisode vu » : still 16:9 936×527, code, titre série, titre épisode. */
export function layoutEpisode(
  format: ShareFormat,
  opts: { titleSize: number; hasEpisodeTitle: boolean },
): ShareLayout {
  const items: StackItem[] = [
    { id: "eyebrow", w: SHARE_CONTENT_W, h: EYEBROW_H, gap: 34 },
    {
      id: "media",
      w: SHARE_CONTENT_W,
      h: 527,
      gap: 48,
      minH: 360,
      aspect: 936 / 527,
    },
    { id: "code", w: SHARE_CONTENT_W, h: lineHeight(64), gap: 12 },
    {
      id: "title",
      w: SHARE_CONTENT_W,
      h: lineHeight(opts.titleSize),
      gap: opts.hasEpisodeTitle ? 12 : 0,
    },
  ];
  if (opts.hasEpisodeTitle) {
    items.push({ id: "subtitle", w: SHARE_CONTENT_W, h: lineHeight(44), gap: 0 });
  }
  return stack(format, items);
}

/** Carte « saison bouclée » : affiche 2:3 entière 480×720, code, titre série. */
export function layoutSeason(format: ShareFormat, opts: { titleSize: number }): ShareLayout {
  return stack(format, [
    { id: "eyebrow", w: SHARE_CONTENT_W, h: EYEBROW_H, gap: 34 },
    { id: "media", w: 480, h: 720, gap: 48, minH: 440, aspect: 480 / 720 },
    { id: "code", w: SHARE_CONTENT_W, h: lineHeight(64), gap: 12 },
    { id: "title", w: SHARE_CONTENT_W, h: lineHeight(opts.titleSize), gap: 0 },
  ]);
}

export const WEEK_POSTER_W = 216;
export const WEEK_POSTER_H = 324;
export const WEEK_POSTER_GUTTER = 24;
export const WEEK_MAX_POSTERS = 4;

/** Carte « ma semaine » : grand nombre, label, jusqu'à 4 affiches 216×324. */
export function layoutWeek(format: ShareFormat, opts: { posterCount: number }): ShareLayout {
  const items: StackItem[] = [
    { id: "eyebrow", w: SHARE_CONTENT_W, h: EYEBROW_H, gap: 56 },
    { id: "number", w: SHARE_CONTENT_W, h: Math.round(240 * 0.82), gap: 12 },
    {
      id: "label",
      w: SHARE_CONTENT_W,
      h: lineHeight(32),
      gap: opts.posterCount > 0 ? 80 : 0,
    },
  ];
  const n = Math.min(opts.posterCount, WEEK_MAX_POSTERS);
  if (n > 0) {
    const rowW = n * WEEK_POSTER_W + (n - 1) * WEEK_POSTER_GUTTER;
    items.push({
      id: "posters",
      w: rowW,
      h: WEEK_POSTER_H,
      gap: 0,
      minH: 240,
      aspect: rowW / WEEK_POSTER_H,
    });
  }
  const layout = stack(format, items);
  // Les affiches sont rendues par `posterRects` à partir de la boîte `posters`.
  return layout;
}

/** Rectangles individuels des affiches dans la boîte `posters`. */
export function posterRects(box: LayoutBox, count: number): LayoutBox[] {
  const n = Math.min(count, WEEK_MAX_POSTERS);
  if (n === 0) return [];
  const scale = box.h / WEEK_POSTER_H;
  const w = Math.round(WEEK_POSTER_W * scale);
  const gutter = Math.round(WEEK_POSTER_GUTTER * scale);
  return Array.from({ length: n }, (_, i) => ({
    id: `poster-${i}`,
    x: box.x + i * (w + gutter),
    y: box.y,
    w,
    h: box.h,
  }));
}

export function boxById(layout: ShareLayout, id: string): LayoutBox | undefined {
  return layout.boxes.find((b) => b.id === id);
}
