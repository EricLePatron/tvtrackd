import { Link } from "@tanstack/react-router";
import type { NextReleaseItem } from "@/lib/schedule";
import { formatCountdownLabel } from "@/lib/schedule";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

/**
 * Compact "prochaine sortie" teaser — rangs #2+ du bloc "Bientôt" partagé
 * (rang #1 = `NextReleaseHeroCard`, grand format). Rendu dans la `normal`
 * state (backlog ready AND a scheduled future episode both present — see
 * `HomeContent`, index.tsx) et dans la `upcoming_only` state (où le bloc
 * "Bientôt" est le contenu principal de l'écran). A compact single row, and
 * navigable. In `normal`, always represents a DIFFERENT show than the hero —
 * the caller excludes the hero's own show id from the candidates fed to
 * `selectNextReleases` (see index.tsx's queryFn) — so tapping it always
 * leads somewhere new, never back to the hero's own fiche.
 *
 * Layout (aligné sur la maquette, revue design — remplace l'ancienne mise en
 * page "gros countdown à gauche + chevron à droite, sans poster") :
 * vignette poster à gauche (même gabarit `h-14 w-10` que `ReadyListItem`,
 * pour une cohérence visuelle entre les deux rangées compactes de la Home)
 * → titre + S/E au centre (`flex-1`) → pill cyan "N j" à droite, SEUL
 * porteur du compte à rebours désormais. Plus de gros texte de countdown à
 * gauche, plus de chevron `›` — toute la carte reste un `Link` cliquable,
 * l'affordance de navigation n'a jamais dépendu du chevron.
 *
 * Cyan, not amber (design review correction) — this card is pure
 * anticipation ("à venir"), not urgency: cyan is this app's "à venir /
 * info" color everywhere else it's used (`NextReleaseHeroCard`'s own pill,
 * the "prochains épisodes" pill in `UpcomingSchedule` on the fiche série),
 * while amber is reserved for the hero's own "à voir maintenant" urgency
 * signal (`formatReadyLabel`'s eyebrow) — this card must never be confused
 * with that.
 *
 * Deliberately reuses `formatCountdownLabel` (the same "aujourd'hui"/
 * "demain"/"Nj" wording already used by `NextReleaseHeroCard`, same pill
 * shape too — `rounded-full`, cyan) for the urgency label, rather than
 * inventing a second countdown vocabulary WITHIN the Home screen. NOT
 * shared with the fiche série, though: `UpcomingSchedule`
 * (`show.$mediaType.$tmdbId.tsx`) has its own independent local
 * `formatCountdown`, which always shows "Dans 2j"/"Demain"/"Aujourd'hui" —
 * deliberately fuller/capitalized phrasing for that card, vs. this compact
 * pill's "2 j". Only ONE date vocabulary is shown on THIS card by design
 * (UX decision) — the secondary line stays a plain `SxxExx` code, never a
 * repeated calendar date (`formatUpcomingDayLabel`, used elsewhere by
 * `DayRail`'s day headers) alongside the countdown label.
 *
 * S/E mis en avant (phosphore `text-foreground`, jamais ambre/muted) — même
 * traitement que le hero et `NextReleaseHeroCard`, à une échelle plus
 * compacte cohérente avec le reste de cette rangée.
 *
 * The countdown label is rendered fully STATIC — no bump/tween/glow, unlike
 * `HeroTicket`'s watched/total counter — by design: the CLAUDE.md "compteur
 * mécanique façon bande VHS" is the app's one reserved animated-counter
 * signature, scoped to watch progression only. A second, independently
 * animated number here would compete with it.
 *
 * `today` is unused now that the secondary line no longer shows a calendar
 * date — kept in the prop type (the destructure below simply omits it,
 * matching this repo's convention of not fighting unused-var linting via
 * `void`/`_` tricks; see `noUnusedParameters`/`noUnusedLocals: false` in
 * tsconfig.json) so call sites (index.tsx) don't need touching for this
 * UX-only tweak.
 */
export function NextReleaseCard({ item }: { item: NextReleaseItem; today: string }) {
  const { show, episode, daysUntil } = item;

  return (
    <Link
      to="/show/$mediaType/$tmdbId"
      params={{ mediaType: show.media_type, tmdbId: String(show.tmdb_id) }}
      className="flex items-center gap-3 rounded-lg border border-cyan-accent/30 bg-cyan-accent/10 px-3 py-2.5 transition-colors hover:bg-cyan-accent/15"
    >
      <div className="h-14 w-10 shrink-0 overflow-hidden rounded-md border border-border bg-surface-elevated">
        {show.poster_path && (
          <img
            src={show.poster_path}
            alt={show.title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-sm font-medium text-foreground">{show.title}</p>
        <p className="font-counter text-xs font-semibold tracking-wide text-foreground">
          S{pad(episode.season_number)} · E{pad(episode.episode_number)}
        </p>
      </div>
      <span className="shrink-0 rounded-full border border-cyan-accent/30 bg-cyan-accent/10 px-3 py-1 font-counter text-xs tabular-nums text-cyan-accent">
        {formatCountdownLabel(daysUntil)}
      </span>
    </Link>
  );
}
