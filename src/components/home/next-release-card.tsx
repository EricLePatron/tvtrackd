import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
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
 * Cyan, not amber (design review correction) — this card is pure
 * anticipation ("à venir"), not urgency: cyan is this app's "à venir /
 * info" color everywhere else it's used (`NextReleaseHeroCard`,
 * `NextEpisodeCard` on the fiche série), while amber is reserved for the
 * hero's own "à voir maintenant" urgency signal (`formatReadyLabel`'s
 * eyebrow) — this card must never be confused with that.
 *
 * Deliberately reuses `formatCountdownLabel` (the exact
 * "aujourd'hui"/"demain"/"Nj" wording already shared by the fiche série
 * and `NextReleaseHeroCard`) for the urgency label, rather than inventing a
 * second countdown vocabulary. Only ONE date vocabulary is shown on this
 * card by design (UX decision) — the secondary line stays a plain `SxxExx`
 * code, never a repeated calendar date (`formatUpcomingDayLabel`, used
 * elsewhere by `DayRail`'s day headers) alongside the countdown label.
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
      className="flex items-center gap-3 rounded-lg border border-cyan-accent/30 bg-cyan-accent/10 px-4 py-3 transition-colors hover:bg-cyan-accent/15"
    >
      <p className="shrink-0 font-counter text-sm uppercase tracking-widest text-cyan-accent">
        {formatCountdownLabel(daysUntil)}
      </p>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-sm font-medium text-foreground">{show.title}</p>
        <p className="font-counter text-xs font-semibold tracking-wide text-foreground">
          S{pad(episode.season_number)}·E{pad(episode.episode_number)}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-cyan-accent/70" aria-hidden="true" />
    </Link>
  );
}
