// Heuristique de durée de visionnage, partagée entre `/profile` (stats
// globales du compte) et la fiche série (mémoire "≈ X h" par série, cf.
// refonte fiche série). Aucune donnée de durée réelle (`runtime`/
// `episode_run_time` TMDb) n'est stockée en base — cf. CLAUDE.md, TMDb reste
// la seule source et cette estimation reste explicitement approximative
// ("≈") dans tous les libellés qui l'utilisent.
export const AVG_EPISODE_MIN = 42;

export function estimateWatchMinutes(episodesWatched: number): number {
  return episodesWatched * AVG_EPISODE_MIN;
}

/**
 * Libellé compact "≈ X h" (arrondi à l'heure) pour un nombre d'épisodes vus.
 * Sous 1h de visionnage (0 épisode ou 1 seul épisode court), retombe sur
 * "< 1 h" plutôt que d'afficher "≈ 0 h", qui lirait comme "rien regardé".
 */
export function formatApproxHours(episodesWatched: number): string {
  const minutes = estimateWatchMinutes(episodesWatched);
  const hours = Math.round(minutes / 60);
  return hours < 1 ? "< 1 h" : `≈ ${hours} h`;
}
