/**
 * Génération client-side de la "carte de partage" pour un épisode vu ou une
 * saison vue, en deux formats : `post` (1080×1350, feed Instagram) et
 * `story` (1080×1920, story Instagram / Reels).
 *
 * Rendu 100 % canvas — pas de dépendance html2canvas : la carte est simple
 * (fond `--bg-void`, affiche TMDb, compteur Plex Mono) et le canvas évite
 * tout risque de rendu approximatif des polices/filtres CSS. L'affiche est
 * récupérée via `fetch` + blob plutôt qu'en posant `crossOrigin` sur une
 * balise Image : ça évite l'échec silencieux quand le navigateur a déjà
 * l'image en cache sans en-tête CORS (c'est ce qui produisait une carte
 * vide). En cas d'échec on retombe sur une carte sans affiche.
 */

const BG = "#0B0E14";
const SURFACE = "#1E2530";
const AMBER = "#FF8A3D";
const CYAN = "#4DD9C4";
const TEXT = "#F2EDE4";
const MUTED = "#8B92A3";

export type ShareFormat = "post" | "story";

export type ShareCardInput = {
  /** Titre de la série / du film. */
  title: string;
  /** Ligne compteur, ex. "S02E06" ou "SAISON 02". */
  counter: string;
  /** Sous-titre : titre d'épisode, ou "12 épisodes". */
  subtitle?: string | null;
  /** URL absolue de l'affiche (TMDb). */
  posterUrl?: string | null;
  /** Libellé d'état, ex. "ÉPISODE VU" / "SAISON TERMINÉE". */
  badge: string;
  /** Format de sortie (défaut : post 4:5). */
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

  const format: ShareFormat = input.format ?? "post";
  const W = 1080;
  const H = format === "story" ? 1920 : 1350;
  // Marge basse réservée au bloc texte (badge + compteur + titre + signature)
  const TEXT_BLOCK = 430;
  const PAD = 88;
  const imageH = H - TEXT_BLOCK;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible");

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Affiche : plein cadre en haut, fondue vers le fond
  const poster = input.posterUrl ? await loadImage(input.posterUrl) : null;
  ctx.fillStyle = SURFACE;
  ctx.fillRect(0, 0, W, imageH);
  if (poster) drawCover(ctx, poster, 0, 0, W, imageH);

  const gradTop = Math.max(0, imageH - 420);
  const grad = ctx.createLinearGradient(0, gradTop, 0, imageH);
  grad.addColorStop(0, "rgba(11,14,20,0)");
  grad.addColorStop(0.7, "rgba(11,14,20,0.88)");
  grad.addColorStop(1, BG);
  ctx.fillStyle = grad;
  ctx.fillRect(0, gradTop, W, imageH - gradTop);

  // ── Bloc texte, empilé sans chevauchement possible ────────────────────
  let y = imageH + 26;

  // Badge état
  ctx.textBaseline = "middle";
  ctx.font = "600 26px 'IBM Plex Mono', ui-monospace, monospace";
  const badge = input.badge.toUpperCase();
  const badgeH = 56;
  const badgeW = ctx.measureText(badge).width + 44;
  ctx.fillStyle = "rgba(77,217,196,0.14)";
  roundRect(ctx, PAD, y, badgeW, badgeH, 12);
  ctx.fill();
  ctx.fillStyle = CYAN;
  ctx.fillText(badge, PAD + 22, y + badgeH / 2 + 1);
  y += badgeH + 22;

  // Compteur (module VHS)
  const counter = input.counter.toUpperCase();
  ctx.font = "700 46px 'IBM Plex Mono', ui-monospace, monospace";
  const counterH = 84;
  const counterW = ctx.measureText(counter).width + 52;
  ctx.fillStyle = SURFACE;
  roundRect(ctx, PAD, y, counterW, counterH, 14);
  ctx.fill();
  ctx.fillStyle = AMBER;
  ctx.fillText(counter, PAD + 26, y + counterH / 2 + 2);
  y += counterH + 34;

  // Titre
  ctx.textBaseline = "top";
  const maxW = W - PAD * 2;
  const titleSize = fitFont(ctx, input.title, maxW, 66, 34);
  ctx.fillStyle = TEXT;
  ctx.fillText(ellipsize(ctx, input.title, maxW), PAD, y);
  y += titleSize + 16;

  // Sous-titre
  if (input.subtitle) {
    ctx.font = "400 32px Inter, system-ui, sans-serif";
    ctx.fillStyle = MUTED;
    ctx.fillText(ellipsize(ctx, input.subtitle, maxW), PAD, y);
  }

  // Signature produit, ancrée en bas
  ctx.textBaseline = "alphabetic";
  ctx.font = "600 26px 'IBM Plex Mono', ui-monospace, monospace";
  ctx.fillStyle = MUTED;
  ctx.fillText("TVTRACKD.COM", PAD, H - 56);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Export de l'image impossible"))),
      "image/png",
    );
  });
}
