import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import type { ReadyItem } from "@/lib/schedule";
import { formatReadyLabel } from "@/lib/schedule";
import { useMarkWatched } from "@/hooks/use-mark-watched";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

/**
 * Compact row used for the "Reprendre" / "Nouveau" lists under the hero
 * ticket. Never the "list item per episode" — one row per followed show.
 */
export function ReadyListItem({ item }: { item: ReadyItem }) {
  const { show, nextEpisode, extraCount } = item;
  const markWatched = useMarkWatched();

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
        <p className="font-counter text-[10px] uppercase tracking-widest text-primary">
          {formatReadyLabel(item)}
        </p>
        <h4 className="mt-0.5 truncate text-sm text-foreground">{show.title}</h4>
        <p className="font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
          S{pad(nextEpisode.season_number)} E{pad(nextEpisode.episode_number)}
          {extraCount > 0 && (
            <span className="ml-2 text-primary">+{extraCount}</span>
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={handleMark}
        disabled={markWatched.isPending}
        aria-label="Marquer comme vu"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-accent/40 bg-cyan-accent/10 text-cyan-accent transition-colors hover:bg-cyan-accent/20 disabled:opacity-50"
      >
        <Check className="h-5 w-5" />
      </button>
    </Link>
  );
}
