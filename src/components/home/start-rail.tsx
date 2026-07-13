import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import type { ReadyItem } from "@/lib/schedule";
import { useMarkWatched } from "@/hooks/use-mark-watched";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

/** Posters loaded before the "+N" trailing card takes over. */
const MAX_VISIBLE = 8;

/**
 * Horizontal poster rail for "À commencer" (a_voir shows with a ready
 * episode) — a new call site of the exact same visual pattern as
 * `EntryCard`/`DayRail` (day-rail.tsx): `w-32` poster card, `aspect-[2/3]`,
 * `border-border bg-surface-elevated`, `snap-x` row, trailing "+N" card.
 * Deliberately NOT built on top of `DayRail` itself — that component groups
 * `UpcomingEntry` by calendar day, which doesn't apply here (one flat list of
 * shows, not a day-grouped rail) — but every className below is copied
 * verbatim from `EntryCard`'s poster box / check button so the two rails
 * stay visually identical without introducing a second design language.
 */
export function StartRail({ items }: { items: ReadyItem[] }) {
  if (!items.length) return null;

  const visible = items.slice(0, MAX_VISIBLE);
  const hiddenCount = items.length - visible.length;

  return (
    <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
      {visible.map((item) => (
        <StartCard key={item.show.id} item={item} />
      ))}
      {hiddenCount > 0 && (
        // Clickable — parity with "Reprendre"'s own "Voir tout" overflow
        // link, filtered to the a_voir tab (this rail's own status).
        // Deliberately styled `text-primary` + a trailing chevron (matching
        // "Voir tout" exactly) rather than DayRail's inert `+N` treatment —
        // that one is never clickable, so reusing its muted, chevron-less
        // look here would read as a dead-end rather than an affordance.
        // `snap-start` matches the poster cards before it (`StartCard`
        // below); it was missing initially, which let this card sit outside
        // the rail's scroll-snap rhythm.
        <Link
          to="/library"
          search={{ status: "a_voir" }}
          aria-label={`Voir toutes les séries à commencer (+${hiddenCount})`}
          className="w-32 shrink-0 snap-start"
        >
          {/* Same `aspect-[2/3]` height as StartCard's poster box (and no
              caption below it, matching StartCard's own "no second line
              needed here" case) — without this, the outer `<Link>` above
              stretches to the row's full poster+caption height (default
              flex `align-items: stretch` on the rail's row), and centering
              "+N ›" against THAT full height would sit it visibly lower
              than the neighboring posters' own vertical center. */}
          <div className="flex aspect-[2/3] items-center justify-center">
            <span className="font-counter text-[10px] uppercase tracking-widest text-primary">
              +{hiddenCount} ›
            </span>
          </div>
        </Link>
      )}
    </div>
  );
}

function StartCard({ item }: { item: ReadyItem }) {
  const { show, nextEpisode } = item;
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
      className="w-32 shrink-0 snap-start"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-md border border-border bg-surface-elevated">
        {show.poster_path && (
          <img
            src={show.poster_path}
            alt={show.title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        )}
        {/* Same cyan "vu" CTA as EntryCard's — never a "play" icon, a ready
            item is a not-yet-watched episode, not a resume-playback affordance. */}
        <button
          type="button"
          onClick={handleMark}
          disabled={markWatched.isPending}
          aria-label="Marquer comme vu"
          className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full border border-cyan-accent/50 bg-background/85 text-cyan-accent backdrop-blur-sm transition-colors hover:bg-cyan-accent/20 disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1.5 line-clamp-1 text-sm text-foreground">{show.title}</p>
      <p className="font-counter text-[11px] uppercase tracking-widest text-muted-foreground">
        S{pad(nextEpisode.season_number)} E{pad(nextEpisode.episode_number)}
      </p>
    </Link>
  );
}
