/**
 * Central place for the product name while it's still pending legal
 * trademark validation (TMview/INPI) — see CLAUDE.md. Only new code should
 * reference this constant; existing hardcoded "tvtrackd" strings
 * (root route meta, /auth) are a separate, deliberately out-of-scope
 * cleanup for the day the name is settled.
 */
export const APP_NAME = "tvtrackd";

/**
 * Canonical site origin (no trailing slash), used for canonical links, OG
 * `url`, JSON-LD `@id`/`url`, and sitemap entries. Domain is NOT settled yet
 * (see CLAUDE.md — `.fr` favored but pending trademark check) : this is a
 * single point of truth so swapping the final domain later is a one-line
 * change (or an env var), not a multi-file find/replace. Reads
 * `VITE_SITE_URL` client-side (Vite build-time replacement) / `SITE_URL`
 * server-side (SSR), same fallback pattern as
 * `integrations/supabase/client.ts`. The `https://tvtrackd.com` fallback is
 * a placeholder, not a final decision.
 */
export const SITE_URL: string = (
  import.meta.env.VITE_SITE_URL ||
  process.env.SITE_URL ||
  "https://tvtrackd.com"
).replace(/\/$/, "");

/**
 * Deep link de partage vers une fiche : URL absolue et canonique
 * (`/show/:mediaType/:tmdbId`) sur le domaine de production, quel que soit
 * l'environnement d'où le partage est déclenché (preview inclus). Un lien
 * collé dans un sticker Instagram doit ouvrir la bonne fiche sur le site
 * public, jamais une URL de preview inaccessible aux visiteurs.
 * `source` ajoute un `utm_source` pour l'attribution ; les query params sont
 * ignorés par le routing et n'altèrent pas la balise canonique de la page.
 */
export function showShareUrl(
  mediaType: string,
  tmdbId: string | number,
  source?: string,
): string {
  const base = `${SITE_URL}/show/${mediaType}/${tmdbId}`;
  if (!source) return base;
  return `${base}?utm_source=${encodeURIComponent(source)}&utm_medium=social&utm_campaign=share_watch`;
}
