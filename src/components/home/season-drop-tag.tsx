import type { SeasonDrop } from "@/lib/schedule";

/**
 * Étiquette "drop de saison" de la carte "Sort aujourd'hui"/"Bientôt"
 * (`NextReleaseHeroCard`) — un show dont plusieurs épisodes d'une même saison
 * sortent le même jour (`computeSeasonDrop`/`selectNextReleases`, schedule.ts).
 * PAS sur le hero : celui-ci garde son compteur signature watched/total (le
 * décompte d'épisodes), l'indication de fournée reste propre aux deux cartes
 * de sorties. Deux formulations :
 * - `wholeSeason` (confirmé contre le compte officiel TMDb) → "Saison complète"
 * - sinon → "N épisodes" (toujours exact : N épisodes ont bien droppé)
 *
 * Pastille PLEINE phosphore (`bg-foreground` = le `--text-primary` blanc chaud
 * "effet phosphore", texte `text-background` void) — un aplat clair sur fond
 * sombre pour qu'elle RESSORTE nettement (revue utilisateur : l'ancien
 * traitement neutre `bg-surface-elevated`, gris sur gris, se fondait dans la
 * carte). Reste NEUTRE vis-à-vis des deux accents du design system (ambre =
 * urgence/CTA, cyan = vu/stats) : un drop est une info de *disponibilité*,
 * distincte de "vu" — le phosphore, couleur signature du texte, l'exprime sans
 * détourner un accent. Aplat opaque + `shadow` : lisible et détaché au-dessus
 * du backdrop sans `backdrop-blur`.
 */
export function SeasonDropTag({ drop }: { drop: SeasonDrop }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-foreground px-2.5 py-1 font-counter text-[11px] font-bold uppercase tracking-wider text-background shadow-sm shadow-black/30">
      {drop.wholeSeason ? "Saison complète" : `${drop.count} épisodes`}
    </span>
  );
}
