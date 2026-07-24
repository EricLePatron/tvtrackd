import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import type { ReadyItem } from "@/lib/schedule";
import { formatReadyLabel } from "@/lib/schedule";
import { useMarkWatched } from "@/hooks/use-mark-watched";
import { VhsCounter } from "@/components/vhs-counter";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

/**
 * Compact row used for the "Reprendre" list under the hero ticket. Never the
 * "list item per episode" — one row per followed show. ("À commencer" no
 * longer uses this row — it renders as a horizontal poster rail instead, see
 * `start-rail.tsx`.)
 *
 * `progress` (Étage 2.2 — progression saison en cours sur "Reprendre") is
 * the show's OWN current-season watched/total tally, computed by
 * `computeReprendreProgress` (schedule.ts) and passed down by `HomeContent`
 * (index.tsx) — `undefined` when not (yet) reliable (see
 * `isSeasonTallyReliable`), in which case this row falls back to the plain
 * `SxxExx` text label it always showed before this lot, exactly like the
 * hero ticket falls back to its bare S/E label when `heroProgress` is
 * `null`. Reuses `VhsCounter`'s "grid" variant (previously library.tsx
 * only) rather than a new component — same compact `S02·E06` + bar chip.
 */
export function ReadyListItem({
  item,
  progress,
}: {
  item: ReadyItem;
  progress?: { watched: number; total: number };
}) {
  const { show, nextEpisode, extraCount } = item;
  const markWatched = useMarkWatched();
  const label = formatReadyLabel(item);

  const handleMark = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (markWatched.isPending) return;
    markWatched.mutate({ episodeId: nextEpisode.id, showId: show.id });
  };

  return (
    <Link
      to="/show/$mediaType/$tmdbId"
      params={{ mediaType: show.media_type, tmdbId: String(show.tmdb_id) }}
      className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
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
        {/* formatReadyLabel returns null once the backlog is 30j+ old — omit
            the line entirely rather than rendering an empty eyebrow. */}
        {label && (
          <p className="font-counter text-[10px] uppercase tracking-widest text-primary">{label}</p>
        )}
        <h4 className="mt-0.5 truncate text-sm text-foreground">{show.title}</h4>
        {progress ? (
          <div className="mt-1 flex items-center gap-2">
            <VhsCounter
              variant="grid"
              seasonNumber={nextEpisode.season_number}
              nextEpisodeNumber={nextEpisode.episode_number}
              watched={progress.watched}
              total={progress.total}
              // "muted", pas le "amber" par défaut : l'eyebrow formatReadyLabel
              // juste au-dessus ("Prêt · Nj") est déjà ambre — deux étiquettes
              // ambre consécutives recréerait exactement l'effet "deux
              // labels qui se répètent" corrigé au Lot 4 sur le hero (voir
              // HeroTicket, index.tsx). Le bump reste cyan quoi qu'il arrive
              // (VhsCounter le gère indépendamment du tone).
              tone="muted"
            />
            {extraCount > 0 && (
              <span className="font-counter text-[10px] uppercase tracking-widest text-primary">
                +{extraCount}
              </span>
            )}
          </div>
        ) : (
          <p className="font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
            S{pad(nextEpisode.season_number)} E{pad(nextEpisode.episode_number)}
            {extraCount > 0 && <span className="ml-2 text-primary">+{extraCount}</span>}
          </p>
        )}
      </div>
      {/* 44px tap target (WCAG 2.5.5) — the visible icon stays small (~16px),
          only the hitbox grows, matching the hero ticket's own check button. */}
      <button
        type="button"
        onClick={handleMark}
        disabled={markWatched.isPending}
        aria-label="Marquer comme vu"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cyan-accent/40 bg-cyan-accent/10 text-cyan-accent transition-colors hover:bg-cyan-accent/20 disabled:opacity-50"
      >
        <Check className="h-4 w-4" />
      </button>
    </Link>
  );
}
