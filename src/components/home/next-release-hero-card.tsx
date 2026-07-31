import { Link } from "@tanstack/react-router";
import type { NextReleaseItem } from "@/lib/schedule";
import { formatCountdownLabel, isGenericEpisodeTitle } from "@/lib/schedule";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

/**
 * Grand format "prochaine sortie" — SEUL format du bloc "Bientôt" (design
 * review : limité à 1 item, plus de rangs compacts en dessous depuis que
 * `selectNextReleases` est appelé avec `limit: 1`, voir `HomeScreen`'s
 * queryFn — l'ancien format compact `NextReleaseCard` a été retiré). Partagé
 * entre l'état `normal` (sous le hero/backlog, cf. `HomeContent` index.tsx)
 * et l'état `upcoming_only` (où ce bloc devient le contenu principal de
 * l'écran, il n'y a pas de hero/backlog du tout dans cet état).
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
 * Bloc texte en 3 lignes empilées (revue lisibilité) — plus de partage de
 * largeur ni avec le badge (déplacé en overlay, voir plus bas) ni entre S/E
 * et le titre d'épisode (ex-ligne unique `items-baseline` façon `HeroTicket`,
 * abandonnée ici pour laisser chaque ligne respirer sur toute la largeur) :
 * 1. Titre de la série (`font-display`), ligne dominante, pleine largeur.
 * 2. S/E seul (phosphore `text-foreground`, jamais ambre — même traitement
 *    que le hero, cf. index.tsx `HeroTicket`), sur sa propre ligne.
 * 3. Titre d'épisode (`text-sm text-muted-foreground`), UNIQUEMENT quand
 *    `!isGenericEpisodeTitle(...)` — un titre placeholder TMDb ("Épisode N")
 *    ou `null` n'affiche aucune ligne de remplissage plutôt qu'un "—" vide de
 *    sens.
 *
 * `variant` ("soon" par défaut) sélectionne le gabarit "Bientôt" existant
 * (pill cyan contour, `formatCountdownLabel`, filet neutre `border-border`).
 * `variant="today"` bascule sur le traitement "événement" de "Sort
 * aujourd'hui" (revue design) : filet plus épais et teinté ambre
 * (`border-[1.5px] border-primary/45`), badge PLEIN ambre "Aujourd'hui" (sans
 * dot, sans wording countdown) à la même place que le pill cyan. Le corps de
 * la carte (backdrop, titre, S/E + titre d'épisode) est strictement partagé
 * entre les deux variantes — seuls le filet et le badge de fin de ligne
 * changent.
 */
export function NextReleaseHeroCard({
  item,
  variant = "soon",
}: {
  item: NextReleaseItem;
  variant?: "soon" | "today";
}) {
  const { show, episode, daysUntil } = item;
  const backdropUrl = episode.still_path ?? show.backdrop_path ?? show.poster_path;
  const showEpisodeTitle = !isGenericEpisodeTitle(episode.title, episode.episode_number);

  return (
    <Link
      to="/show/$mediaType/$tmdbId"
      params={{ mediaType: show.media_type, tmdbId: String(show.tmdb_id) }}
      className={`relative block aspect-[16/7] overflow-hidden rounded-2xl bg-card ${
        variant === "today" ? "border-[1.5px] border-primary/45" : "border border-border"
      }`}
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

      {/* Badge/pill de statut — overlay, hors du flux du bloc texte (revue
          lisibilité) : plus de partage de largeur avec le titre de la série,
          s'appuie sur le dégradé `from-background/60` ci-dessus pour rester
          lisible sur l'image. `backdrop-blur-sm` ici est fonctionnel (lisser
          le contraste sur une image variable), pas un effet glassmorphism
          décoratif — cf. CLAUDE.md. */}
      {variant === "today" ? (
        <span className="absolute right-3 top-3 z-10 rounded-md bg-primary px-3 py-1 font-counter text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground backdrop-blur-sm">
          Aujourd'hui
        </span>
      ) : (
        <span className="absolute right-3 top-3 z-10 rounded-full border border-cyan-accent/30 bg-cyan-accent/10 px-3 py-1 font-counter text-xs tabular-nums text-cyan-accent backdrop-blur-sm">
          {formatCountdownLabel(daysUntil)}
        </span>
      )}

      <div className="relative flex h-full flex-col justify-end p-4">
        <div className="min-w-0 space-y-1">
          <h3 className="font-display text-lg leading-tight text-foreground line-clamp-1">
            {show.title}
          </h3>
          <div className="font-counter text-base font-semibold tracking-wide text-foreground tabular-nums">
            S{pad(episode.season_number)} · E{pad(episode.episode_number)}
          </div>
          {showEpisodeTitle && (
            <div className="truncate text-sm text-muted-foreground">{episode.title}</div>
          )}
        </div>
      </div>
    </Link>
  );
}
