/**
 * Génération client-side des cartes de partage (canvas) : épisode vu, saison
 * bouclée, « ma semaine ». Formats Story 1080×1920 et Publication 1080×1350.
 *
 * Cartes épurées : fond `--bg-void` plat, aucun dégradé, aucun filtre canvas
 * (`ctx.filter` n'existe pas sur Safari/iOS). Toutes les positions viennent du
 * module pur `share-layout.ts` (testé) ; ce fichier ne fait que dessiner.
 *
 * Les visuels sont récupérés via `fetch` + blob (jamais « tainted ») avec un
 * repli sur une balise Image CORS anonyme ; en cas d'échec la carte est rendue
 * sans visuel (aplat `--bg-surface-raised`).
 */

import { APP_NAME } from "@/lib/app-config";
import {
  SHARE_FORMATS,
  SHARE_CONTENT_W,
  boxById,
  layoutEpisode,
  layoutSeason,
  layoutWeek,
  posterRects,
  type LayoutBox,
  type ShareFormat,
} from "@/lib/share-layout";

export type { ShareFormat } from "@/lib/share-layout";

const BG = "#0B0E14";
const SURFACE = "#1E2530";
const AMBER = "#FF8A3D";
const CYAN = "#4DD9C4";
const TEXT = "#F2EDE4";
const MUTED = "#8B92A3";

const DISPLAY = "Archivo, Inter, system-ui, sans-serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const BODY = "Inter, system-ui, sans-serif";

export type ShareCardInput =
  | {
      kind: "episode";
      /** Titre de la série. */
      seriesTitle: string;
      /** Titre de l'épisode (facultatif). */
      episodeTitle?: string | null;
      season: number;
      episode: number;
      /** Still de l'épisode (TMDb, 16:9). */
      imageUrl?: string | null;
      /** Repli si pas de still : backdrop de la série. */
      fallbackImageUrl?: string | null;
    }
  | {
      kind: "season";
      seriesTitle: string;
      season: number;
      /** Affiche de la saison, repli affiche de la série. */
      posterUrl?: string | null;
    }
  | {
      kind: "week";
      /** Ex. « 20 → 26 OCT. » */
      rangeLabel: string;
      /** Épisodes vus sur la semaine. */
      episodes: number;
      /** Affiches des séries les plus vues (4 max utilisées). */
      posterUrls: string[];
    };

export type ShareCardOptions = { format?: ShareFormat };

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Les polices web doivent être réellement chargées avant le rendu canvas :
 * `document.fonts.ready` ne charge pas une graisse jamais utilisée à l'écran.
 */
export async function ensureShareFonts(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  const sample = "ÉÈÀÇ·→0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.";
  try {
    await Promise.all([
      document.fonts.load("700 84px Archivo", sample),
      document.fonts.load("700 34px Archivo", sample),
      document.fonts.load("500 26px 'IBM Plex Mono'", sample),
      document.fonts.load("600 64px 'IBM Plex Mono'", sample),
      document.fonts.load("600 240px 'IBM Plex Mono'", sample),
      document.fonts.load("400 44px Inter", sample),
    ]);
    await document.fonts.ready;
  } catch {
    /* best effort : repli sur la police système */
  }
}

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  // 1) chemin privilégié : fetch CORS -> blob -> object URL (jamais "tainted")
  try {
    const res = await fetch(url, { mode: "cors" });
    if (res.ok) {
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const img = await new Promise<HTMLImageElement | null>((resolve) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => resolve(null);
        el.src = objectUrl;
      });
      URL.revokeObjectURL(objectUrl);
      if (img) return img;
    }
  } catch {
    /* on tente le fallback ci-dessous */
  }
  // 2) fallback : balise Image en CORS anonyme
  return await new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function loadFirst(urls: Array<string | null | undefined>) {
  for (const u of urls) {
    if (!u) continue;
    const img = await loadImage(u);
    if (img) return img;
  }
  return null;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Image remplissant la boîte (rognage centré), coins arrondis, filet. */
function drawVisual(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  box: LayoutBox,
  radius: number,
) {
  ctx.save();
  roundRect(ctx, box.x, box.y, box.w, box.h, radius);
  ctx.clip();
  ctx.fillStyle = SURFACE;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  if (img) {
    const ratio = Math.max(box.w / img.width, box.h / img.height);
    const dw = img.width * ratio;
    const dh = img.height * ratio;
    ctx.drawImage(img, box.x + (box.w - dw) / 2, box.y + (box.h - dh) / 2, dw, dh);
  }
  ctx.restore();
  ctx.strokeStyle = "rgba(242,237,228,0.10)";
  ctx.lineWidth = 2;
  roundRect(ctx, box.x, box.y, box.w, box.h, radius);
  ctx.stroke();
}

function fitDisplay(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  let size = 84;
  const min = 48;
  while (size > min) {
    ctx.font = `700 ${size}px ${DISPLAY}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 3;
  }
  ctx.font = `700 ${size}px ${DISPLAY}`;
  return size;
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 2 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

function drawTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
) {
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
  return cx - spacing - x;
}

/** Mesure le titre (taille ajustée) avant le layout, qui ne dépend que de la taille. */
function measureTitle(ctx: CanvasRenderingContext2D, title: string) {
  const size = fitDisplay(ctx, title, SHARE_CONTENT_W);
  return { size, text: ellipsize(ctx, title, SHARE_CONTENT_W) };
}

function drawEyebrow(ctx: CanvasRenderingContext2D, box: LayoutBox, text: string, color: string) {
  ctx.textBaseline = "alphabetic";
  ctx.font = `500 26px ${MONO}`;
  ctx.fillStyle = color;
  drawTracked(ctx, text.toUpperCase(), box.x, box.y + 26, 26 * 0.22);
}

function drawFooter(ctx: CanvasRenderingContext2D, box: LayoutBox) {
  ctx.fillStyle = AMBER;
  roundRect(ctx, box.x, box.y + 9, 10, 40, 5);
  ctx.fill();
  ctx.textBaseline = "alphabetic";
  ctx.font = `700 34px ${DISPLAY}`;
  ctx.fillStyle = TEXT;
  drawTracked(ctx, APP_NAME.toUpperCase(), box.x + 34, box.y + 40, 34 * 0.12);
}

function drawText(
  ctx: CanvasRenderingContext2D,
  box: LayoutBox,
  text: string,
  font: string,
  color: string,
  size: number,
) {
  ctx.textBaseline = "alphabetic";
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.fillText(ellipsize(ctx, text, box.w), box.x, box.y + Math.round(size * 0.9));
}

export async function buildShareCard(
  input: ShareCardInput,
  options: ShareCardOptions = {},
): Promise<Blob> {
  const format: ShareFormat = options.format ?? "story";
  const spec = SHARE_FORMATS[format];

  await ensureShareFonts();

  const canvas = document.createElement("canvas");
  canvas.width = spec.width;
  canvas.height = spec.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible");

  // Fond plat, opaque (export JPEG).
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, spec.width, spec.height);

  if (input.kind === "episode") {
    const media = await loadFirst([input.imageUrl, input.fallbackImageUrl]);
    const title = measureTitle(ctx, input.seriesTitle);
    const hasEp = !!input.episodeTitle?.trim();
    const layout = layoutEpisode(format, { titleSize: title.size, hasEpisodeTitle: hasEp });
    drawEyebrow(ctx, boxById(layout, "eyebrow")!, "Épisode vu", CYAN);
    drawVisual(ctx, media, boxById(layout, "media")!, 32);
    drawText(
      ctx,
      boxById(layout, "code")!,
      `S${pad2(input.season)} E${pad2(input.episode)}`,
      `600 64px ${MONO}`,
      AMBER,
      64,
    );
    ctx.font = `700 ${title.size}px ${DISPLAY}`;
    drawText(
      ctx,
      boxById(layout, "title")!,
      title.text,
      `700 ${title.size}px ${DISPLAY}`,
      TEXT,
      title.size,
    );
    if (hasEp) {
      drawText(
        ctx,
        boxById(layout, "subtitle")!,
        input.episodeTitle!,
        `400 44px ${BODY}`,
        MUTED,
        44,
      );
    }
    drawFooter(ctx, boxById(layout, "footer")!);
  } else if (input.kind === "season") {
    const media = await loadFirst([input.posterUrl]);
    const title = measureTitle(ctx, input.seriesTitle);
    const layout = layoutSeason(format, { titleSize: title.size });
    drawEyebrow(ctx, boxById(layout, "eyebrow")!, "Saison bouclée", CYAN);
    drawVisual(ctx, media, boxById(layout, "media")!, 28);
    drawText(
      ctx,
      boxById(layout, "code")!,
      `S${pad2(input.season)}`,
      `600 64px ${MONO}`,
      AMBER,
      64,
    );
    drawText(
      ctx,
      boxById(layout, "title")!,
      title.text,
      `700 ${title.size}px ${DISPLAY}`,
      TEXT,
      title.size,
    );
    drawFooter(ctx, boxById(layout, "footer")!);
  } else {
    const urls = input.posterUrls.slice(0, 4);
    const images = await Promise.all(urls.map((u) => loadImage(u)));
    const layout = layoutWeek(format, { posterCount: urls.length });
    drawEyebrow(ctx, boxById(layout, "eyebrow")!, `Ma semaine · ${input.rangeLabel}`, MUTED);

    const num = boxById(layout, "number")!;
    ctx.textBaseline = "alphabetic";
    ctx.font = `600 240px ${MONO}`;
    ctx.fillStyle = CYAN;
    ctx.fillText(String(input.episodes), num.x, num.y + 178);

    const label = boxById(layout, "label")!;
    ctx.font = `500 32px ${MONO}`;
    ctx.fillStyle = MUTED;
    drawTracked(ctx, "ÉPISODES VUS", label.x, label.y + 30, 32 * 0.22);

    const posters = boxById(layout, "posters");
    if (posters) {
      posterRects(posters, urls.length).forEach((rect, i) => drawVisual(ctx, images[i], rect, 20));
    }
    drawFooter(ctx, boxById(layout, "footer")!);
  }

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Export de l'image impossible"))),
      "image/jpeg",
      0.9,
    );
  });
}
