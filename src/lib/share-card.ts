/**
 * Génération client-side de la "carte de partage" (1080×1350, format
 * portrait Instagram) pour un épisode vu ou une saison vue.
 *
 * Rendu 100 % canvas — pas de dépendance html2canvas : la carte est simple
 * (fond `--bg-void`, affiche TMDb, compteur Plex Mono) et le canvas évite
 * tout risque de rendu approximatif des polices/filtres CSS. Les images
 * TMDb sont servies avec `access-control-allow-origin: *`, donc le canvas
 * n'est pas "tainted" et `toBlob` fonctionne ; en cas d'échec de chargement
 * on retombe sur une carte sans affiche plutôt que d'échouer.
 */

const W = 1080;
const H = 1350;

const BG = "#0B0E14";
const SURFACE = "#1E2530";
const AMBER = "#FF8A3D";
const CYAN = "#4DD9C4";
const TEXT = "#F2EDE4";
const MUTED = "#8B92A3";

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
};

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
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
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
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

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, size: number) {
  let s = size;
  while (s > 28) {
    ctx.font = `700 ${s}px Archivo, Inter, system-ui, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
    s -= 4;
  }
  return s;
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

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible");

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Affiche (bloc haut, coins arrondis)
  const px = 120;
  const py = 96;
  const pw = W - px * 2;
  const ph = 1260;
  const poster = input.posterUrl ? await loadImage(input.posterUrl) : null;

  ctx.save();
  roundRect(ctx, px, py, pw, Math.round(pw * 1.5), 28);
  ctx.clip();
  ctx.fillStyle = SURFACE;
  ctx.fillRect(px, py, pw, Math.round(pw * 1.5));
  if (poster) drawCover(ctx, poster, px, py, pw, Math.round(pw * 1.5));
  ctx.restore();
  void ph;

  // Dégradé de fond bas pour poser le texte
  const gradTop = py + Math.round(pw * 1.5) - 240;
  const grad = ctx.createLinearGradient(0, gradTop, 0, H);
  grad.addColorStop(0, "rgba(11,14,20,0)");
  grad.addColorStop(0.55, "rgba(11,14,20,0.92)");
  grad.addColorStop(1, BG);
  ctx.fillStyle = grad;
  ctx.fillRect(0, gradTop, W, H - gradTop);

  // Badge état
  ctx.font = "600 26px 'IBM Plex Mono', ui-monospace, monospace";
  const badge = input.badge.toUpperCase();
  const badgeW = ctx.measureText(badge).width + 44;
  const badgeY = H - 330;
  ctx.fillStyle = "rgba(77,217,196,0.14)";
  roundRect(ctx, px, badgeY, badgeW, 56, 12);
  ctx.fill();
  ctx.fillStyle = CYAN;
  ctx.textBaseline = "middle";
  ctx.fillText(badge, px + 22, badgeY + 30);

  // Compteur (module VHS)
  const counter = input.counter.toUpperCase();
  ctx.font = "700 44px 'IBM Plex Mono', ui-monospace, monospace";
  const counterW = ctx.measureText(counter).width + 48;
  const counterY = badgeY + 76;
  ctx.fillStyle = SURFACE;
  roundRect(ctx, px, counterY, counterW, 78, 14);
  ctx.fill();
  ctx.fillStyle = AMBER;
  ctx.fillText(counter, px + 24, counterY + 40);

  // Titre
  ctx.textBaseline = "alphabetic";
  const titleSize = fitText(ctx, input.title, pw, 68);
  ctx.font = `700 ${titleSize}px Archivo, Inter, system-ui, sans-serif`;
  ctx.fillStyle = TEXT;
  ctx.fillText(input.title, px, counterY + 78 + 76);

  // Sous-titre
  if (input.subtitle) {
    ctx.font = "400 32px Inter, system-ui, sans-serif";
    ctx.fillStyle = MUTED;
    let sub = input.subtitle;
    while (ctx.measureText(sub).width > pw && sub.length > 4) sub = sub.slice(0, -2);
    if (sub !== input.subtitle) sub = `${sub}…`;
    ctx.fillText(sub, px, counterY + 78 + 128);
  }

  // Signature produit
  ctx.font = "600 26px 'IBM Plex Mono', ui-monospace, monospace";
  ctx.fillStyle = MUTED;
  ctx.fillText("TVTRACKD.COM", px, H - 70);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Export de l'image impossible"))),
      "image/png",
    );
  });
}
