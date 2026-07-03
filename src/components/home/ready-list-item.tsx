import { Link } from "@tanstack/react-router";
import type { ReadyItem } from "@/lib/schedule";
import { formatReadyLabel } from "@/lib/schedule";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

/**
 * Compact row used for the "Reprendre" / "Nouveau" lists under the hero
 * ticket. Never the "list item per episode" — one row per followed show.
 */
export function ReadyListItem({ item }: { item: ReadyItem }) {
  const { show, nextEpisode, extraCount } = item;

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
        <p className="font-counter text-[10px] uppercase tracking-widest text-primary">
          {formatReadyLabel(item)}
        </p>
        <h4 className="mt-0.5 truncate text-sm text-foreground">{show.title}</h4>
        <p className="font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
          S{pad(nextEpisode.season_number)} E{pad(nextEpisode.episode_number)}
        </p>
      </div>
      {extraCount > 0 && (
        <span className="shrink-0 rounded-full border border-primary/40 bg-primary/10 px-2 py-1 font-counter text-[10px] uppercase tracking-widest text-primary">
          +{extraCount} disponibles
        </span>
      )}
    </Link>
  );
}
