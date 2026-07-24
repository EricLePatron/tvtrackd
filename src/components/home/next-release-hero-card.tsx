import { Link } from "@tanstack/react-router";
import type { NextReleaseItem } from "@/lib/schedule";
import { formatCountdownLabel } from "@/lib/schedule";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

/**
 * Grand format "prochaine sortie" — rang #1 du bloc "Bientôt" partagé entre
 * l'état `normal` (sous le hero/backlog, cf. `HomeContent` index.tsx) et
 * l'état `upcoming_only` (où ce bloc devient le contenu principal de
 * l'écran, il n'y a pas de hero/backlog du tout dans cet état). Rangs #2+
 * du même bloc utilisent le format compact `NextReleaseCard`.
 *
 * Remplace l'ancien `AwaitedHeroCard` (Lovable, `upcoming_only` uniquement,
 * `aspect-[16/10]` identique au `HeroTicket`) — différenciation de forme
 * volontaire (item 9 de la revue design) :
 * - `aspect-[16/7]`, plus court que le `aspect-[16/10]` du hero — jamais la
 *   même silhouette, pour qu'un coup d'œil suffise à distinguer "à voir
 *   maintenant" (hero) de "bientôt" (cette carte).
 * - Cyan partout (jamais l'ambre du hero, réservé à son urgence "à voir
 *   maintenant" — `formatReadyLabel`'s eyebrow).
 * - Un seul pill "N j" (`formatCountdownLabel`, jamais de digit isolé façon
 *   compteur mécanique — ce indicateur-là reste réservé à la progression
 *   watched/total du hero, cf. CLAUDE.md).
 * - Pas de check : rien n'est encore sorti, il n'y a rien à marquer vu.
 * - Toute la carte est un `Link` — pas de bouton séparé.
 *
 * Pas d'eyebrow interne (contrairement au hero, qui porte "Ce soir"/"Prêt ·
 * Nj") : l'en-tête de section "Bientôt" rendue par l'appelant juste
 * au-dessus porte déjà ce rôle ; en dupliquer un ici serait redondant.
 *
 * S/E mis en avant (phosphore `text-foreground`, jamais ambre — même
 * traitement que le hero, cf. index.tsx `HeroTicket`), le titre de la série
 * au-dessus reste la ligne dominante (`font-display`).
 */
export function NextReleaseHeroCard({ item }: { item: NextReleaseItem }) {
  const { show, episode, daysUntil } = item;
  const backdropUrl = episode.still_path ?? show.backdrop_path ?? show.poster_path;

  return (
    <Link
      to="/show/$mediaType/$tmdbId"
      params={{ mediaType: show.media_type, tmdbId: String(show.tmdb_id) }}
      className="relative block aspect-[16/7] overflow-hidden rounded-2xl border border-border bg-card"
    >
      {backdropUrl && (
        <div aria-hidden className="absolute inset-0">
          <img
            src={backdropUrl}
            alt=""
            width={1280}
            height={560}
            fetchPriority="high"
            decoding="async"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/30" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 to-transparent" />
        </div>
      )}

      <div className="relative flex h-full flex-col justify-end p-4">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <h3 className="font-display text-lg leading-tight text-foreground line-clamp-1">
              {show.title}
            </h3>
            <p className="font-counter text-sm font-semibold tracking-wide text-foreground">
              S{pad(episode.season_number)} E{pad(episode.episode_number)}
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-cyan-accent/30 bg-cyan-accent/10 px-3 py-1 font-counter text-xs tabular-nums text-cyan-accent">
            {formatCountdownLabel(daysUntil)}
          </span>
        </div>
      </div>
    </Link>
  );
}
