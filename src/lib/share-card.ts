/**
 * Génération client-side de la "carte de partage" pour un épisode vu ou une
 * saison vue, au format story (1080×1920, Instagram / X).
 *
 * Rendu 100 % canvas — pas de dépendance html2canvas : la carte est simple
 * (fond `--bg-void`, visuel de l'épisode, compteur Plex Mono, bloc de marque)
 * et le canvas évite tout risque de rendu approximatif des polices/filtres
 * CSS. Le visuel est récupéré via `fetch` + blob plutôt qu'en posant
 * `crossOrigin` sur une balise Image : ça évite l'échec silencieux quand le
 * navigateur a déjà l'image en cache sans en-tête CORS. En cas d'échec on
 * retombe sur une carte sans visuel.
 */

const BG = "#0B0E14";
const SURFACE = "#1E2530";
const AMBER = "#FF8A3D";
const CYAN = "#4DD9C4";
const TEXT = "#F2EDE4";
const MUTED = "#8B92A3";

export type ShareFormat = "story";

export type ShareCardInput = {
  /** Titre de la série / du film. */
  title: string;
  /** Ligne compteur, ex. "S02E06" ou "SAISON 02". */
  counter: string;
  /** Sous-titre : titre d'épisode, ou "12 épisodes". */
  subtitle?: string | null;
  /** URL absolue du visuel principal (still d'épisode ou affiche TMDb). */
  posterUrl?: string | null;
  /** Libellé d'état, ex. "ÉPISODE VU" / "SAISON TERMINÉE". */
  badge: string;
  /** Format de sortie (story uniquement). */
  format?: ShareFormat;
};

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  // 1) chemin privilégié : fetch CORS -> blob -> object URL (jamais "tainted")
  try {
    const res = await fetch(url, { mode: "cors", cache: "reload" });
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

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const ratio = Math.max(w / img.width, h / img.height);
  const dw = img.width * ratio;
  const dh = img.height * ratio;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
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

function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  size: number,
  min: number,
) {
  let s = size;
  while (s > min) {
    ctx.font = `700 ${s}px Archivo, Inter, system-ui, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
    s -= 3;
  }
  ctx.font = `700 ${s}px Archivo, Inter, system-ui, sans-serif`;
  return s;
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

function measureTracked(ctx: CanvasRenderingContext2D, text: string, spacing: number) {
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + spacing;
  return Math.max(0, w - spacing);
}

export async function buildShareCard(input: ShareCardInput): Promise<Blob> {
  // Les polices web doivent être prêtes avant le rendu canvas, sinon le
  // navigateur retombe silencieusement sur une police système.
  if (typeof document !== "undefined" && document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      /* best effort */
    }
  }

  const W = 1080;
  const H = 1920;
  const PAD = 80;
  const maxW = W - PAD * 2;

  // Zones réservées par l'UI Instagram (avatar/nom en haut, barre
  // « Dites quelque chose » + actions en bas) : tout le contenu utile de la
  // carte vit entre ces deux bornes.
  const SAFE_TOP = 300;
  const SAFE_BOTTOM = H - 430;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible");

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  const media = input.posterUrl ? await loadImage(input.posterUrl) : null;

  // ── Toile de fond : le visuel flouté, très sombre, occupe tout l'écran ──
  if (media) {
    ctx.save();
    ctx.filter = "blur(70px) saturate(150%)";
    ctx.globalAlpha = 0.6;
    drawCover(ctx, media, -80, -80, W + 160, H + 160);
    ctx.restore();
    ctx.fillStyle = "rgba(11,14,20,0.78)";
    ctx.fillRect(0, 0, W, H);
  }

  // ── Carte centrale ─────────────────────────────────────────────────────
  const frameW = maxW;
  const frameX = PAD;
  const ratio = media ? media.width / media.height : 16 / 9;
  const frameH = Math.round(Math.min(Math.max(frameW / ratio, 520), 900));

  // Hauteur du bloc texte pour centrer l'ensemble dans la zone sûre.
  const badgeH = 60;
  const titleBlockH = 200;
  const ctaH = 132;
  const cardH = 118 /* header marque */ + frameH + 46 + badgeH + 30 + titleBlockH + ctaH;
  let y = Math.max(SAFE_TOP, Math.round((SAFE_TOP + SAFE_BOTTOM - cardH) / 2));

  // ── En-tête de marque ──────────────────────────────────────────────────
  ctx.textBaseline = "middle";
  ctx.fillStyle = AMBER;
  roundRect(ctx, PAD, y, 14, 46, 5);
  ctx.fill();
  ctx.font = "700 44px Archivo, Inter, system-ui, sans-serif";
  ctx.fillStyle = TEXT;
  const brandW = drawTracked(ctx, "TVTRACKD", PAD + 34, y + 24, 3);
  ctx.font = "500 24px 'IBM Plex Mono', ui-monospace, monospace";
  ctx.fillStyle = MUTED;
  ctx.fillText("SUIVI DE SÉRIES", PAD + 34 + brandW + 24, y + 26);
  y += 118;

  // ── Visuel principal ───────────────────────────────────────────────────
  ctx.save();
  roundRect(ctx, frameX, y, frameW, frameH, 30);
  ctx.clip();
  ctx.fillStyle = SURFACE;
  ctx.fillRect(frameX, y, frameW, frameH);
  if (media) drawCover(ctx, media, frameX, y, frameW, frameH);
  // Dégradé bas pour asseoir le visuel sur le bloc texte
  const grad = ctx.createLinearGradient(0, y + frameH - 220, 0, y + frameH);
  grad.addColorStop(0, "rgba(11,14,20,0)");
  grad.addColorStop(1, "rgba(11,14,20,0.85)");
  ctx.fillStyle = grad;
  ctx.fillRect(frameX, y + frameH - 220, frameW, 220);
  ctx.restore();
  ctx.strokeStyle = "rgba(242,237,228,0.12)";
  ctx.lineWidth = 2;
  roundRect(ctx, frameX, y, frameW, frameH, 30);
  ctx.stroke();
  y += frameH + 46;

  // ── Badge état + compteur ──────────────────────────────────────────────
  ctx.textBaseline = "middle";
  ctx.font = "600 28px 'IBM Plex Mono', ui-monospace, monospace";
  const badge = input.badge.toUpperCase();
  const badgeW = ctx.measureText(badge).width + 46;
  ctx.fillStyle = "rgba(77,217,196,0.16)";
  roundRect(ctx, PAD, y, badgeW, badgeH, 12);
  ctx.fill();
  ctx.fillStyle = CYAN;
  ctx.fillText(badge, PAD + 23, y + badgeH / 2 + 1);

  const counter = input.counter.toUpperCase();
  ctx.font = "700 42px 'IBM Plex Mono', ui-monospace, monospace";
  const counterW = ctx.measureText(counter).width + 46;
  ctx.fillStyle = SURFACE;
  roundRect(ctx, PAD + badgeW + 16, y, counterW, badgeH, 12);
  ctx.fill();
  ctx.fillStyle = AMBER;
  ctx.fillText(counter, PAD + badgeW + 16 + 23, y + badgeH / 2 + 2);
  y += badgeH + 30;

  // ── Titre + sous-titre ─────────────────────────────────────────────────
  ctx.textBaseline = "top";
  const titleSize = fitFont(ctx, input.title, maxW, 78, 40);
  ctx.fillStyle = TEXT;
  ctx.fillText(ellipsize(ctx, input.title, maxW), PAD, y);
  y += titleSize + 16;

  if (input.subtitle) {
    ctx.font = "400 34px Inter, system-ui, sans-serif";
    ctx.fillStyle = MUTED;
    ctx.fillText(ellipsize(ctx, input.subtitle, maxW), PAD, y);
    y += 46;
  }

  // ── CTA : la promesse produit, en bas de la carte (dans la zone sûre) ──
  const ctaY = Math.min(y + 34, SAFE_BOTTOM - 118);
  ctx.fillStyle = AMBER;
  roundRect(ctx, PAD, ctaY, maxW, 118, 22);
  ctx.fill();

  ctx.textBaseline = "middle";
  ctx.font = "700 46px Archivo, Inter, system-ui, sans-serif";
  ctx.fillStyle = BG;
  const ctaBrandW = measureTracked(ctx, "TVTRACKD.COM", 2);
  ctx.font = "500 24px 'IBM Plex Mono', ui-monospace, monospace";
  const ctaSubW = ctx.measureText("SUIVEZ VOS SÉRIES, SANS RIEN OUBLIER").width;
  const ctaX = PAD + Math.max(36, (maxW - Math.max(ctaBrandW, ctaSubW)) / 2);

  ctx.font = "700 46px Archivo, Inter, system-ui, sans-serif";
  drawTracked(ctx, "TVTRACKD.COM", ctaX, ctaY + 44, 2);
  ctx.font = "500 24px 'IBM Plex Mono', ui-monospace, monospace";
  ctx.fillStyle = "rgba(11,14,20,0.75)";
  ctx.fillText("SUIVEZ VOS SÉRIES, SANS RIEN OUBLIER", ctaX, ctaY + 84);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Export de l'image impossible"))),
      "image/png",
    );
  });
}

