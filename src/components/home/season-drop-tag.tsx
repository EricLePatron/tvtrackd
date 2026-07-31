import type { SeasonDrop } from "@/lib/schedule";

/**
 * Étiquette "drop de saison" partagée par le hero (`HeroTicket`, index.tsx) et
 * la carte "Sort aujourd'hui"/"Bientôt" (`NextReleaseHeroCard`) — un show dont
 * plusieurs épisodes d'une même saison sortent le même jour
 * (`computeSeasonDrop`, schedule.ts). Deux formulations :
 * - `wholeSeason` (confirmé contre le compte officiel TMDb) → "Saison complète"
 * - sinon → "N épisodes" (toujours exact : N épisodes ont bien droppé)
 *
 * Registre volontairement NEUTRE (revue design) : `bg-surface-elevated` (le
 * `--bg-surface-raised` du module compteur signature) + `border-border` +
 * texte phosphore, en IBM Plex Mono uppercase — PAS de cyan ni d'ambre. Les
 * deux accents du design system restent réservés à leur sémantique documentée
 * (ambre = urgence/CTA, cyan = vu/stats) ; un drop est une info de
 * *disponibilité*, une 3e catégorie qu'on ne peut pas exprimer en cyan sans
 * empiéter sur "vu". Le fond opaque `bg-surface-elevated` garantit la
 * lisibilité au-dessus du backdrop sans `backdrop-blur`.
 */
export function SeasonDropTag({ drop }: { drop: SeasonDrop }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-surface-elevated px-2 py-0.5 font-counter text-[10px] font-semibold uppercase tracking-widest text-foreground">
      {drop.wholeSeason ? "Saison complète" : `${drop.count} épisodes`}
    </span>
  );
}
