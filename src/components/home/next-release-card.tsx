import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { NextReleaseItem } from "@/lib/schedule";
import { formatCountdownLabel, formatUpcomingDayLabel } from "@/lib/schedule";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

/**
 * Compact "prochaine sortie" teaser rendered directly under the Home hero in
 * the `normal` state (backlog ready AND a scheduled future episode both
 * present — see `HomeContent`, index.tsx). Distinct from
 * `NothingNowCountdownTicket` (empty-states.tsx): amber-tinted fill (not a
 * dashed border), a compact single row (not a centered block), and
 * navigable. Always represents a DIFFERENT show than the hero — the caller
 * excludes the hero's own show id from the candidates fed to
 * `selectNextReleases` (see index.tsx's queryFn) — so tapping it always
 * leads somewhere new, never back to the hero's own fiche.
 *
 * Deliberately reuses two already-shared formatting helpers rather than
 * inventing a third countdown vocabulary: `formatCountdownLabel` (the exact
 * "aujourd'hui"/"demain"/"dans Nj" wording already shared by the fiche série
 * and `NothingNowCountdownTicket`) for the urgency label, and
 * `formatUpcomingDayLabel` (already used by `DayRail`'s day headers) for the
 * human-readable calendar date on the secondary line.
 *
 * The countdown label is rendered fully STATIC — no bump/tween/glow, unlike
 * `HeroTicket`'s watched/total counter — by design: the CLAUDE.md "compteur
 * mécanique façon bande VHS" is the app's one reserved animated-counter
 * signature, scoped to watch progression only. A second, independently
 * animated number here would compete with it.
 */
export function NextReleaseCard({ item, today }: { item: NextReleaseItem; today: string }) {
  const { show, episode, date, daysUntil } = item;

  return (
    <Link
      to="/show/$mediaType/$tmdbId"
      params={{ mediaType: show.media_type, tmdbId: String(show.tmdb_id) }}
      className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 transition-colors hover:bg-primary/15"
    >
      <p className="shrink-0 font-counter text-sm uppercase tracking-wide text-primary">
        {formatCountdownLabel(daysUntil)}
      </p>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-sm font-medium text-foreground">{show.title}</p>
        <p className="font-counter text-[11px] uppercase tracking-widest text-muted-foreground">
          S{pad(episode.season_number)}·E{pad(episode.episode_number)} ·{" "}
          {formatUpcomingDayLabel(date, today)}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-primary/70" aria-hidden="true" />
    </Link>
  );
}
