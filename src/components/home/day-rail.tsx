import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import type { DayGroup, UpcomingEntry } from "@/lib/schedule";
import { formatUpcomingDayLabel } from "@/lib/schedule";
import { useMarkWatched } from "@/hooks/use-mark-watched";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function entryKey(entry: UpcomingEntry) {
  return entry.type === "drop"
    ? `drop-${entry.show.id}-${entry.seasonNumber}`
    : `single-${entry.episode.id}`;
}

function EntryCard({
  entry,
  saturated,
  today,
}: {
  entry: UpcomingEntry;
  saturated: boolean;
  today: string;
}) {
  const show = entry.show;
  const sub =
    entry.type === "drop"
      ? `S${pad(entry.seasonNumber)} · +${entry.count} épisodes`
      : `S${pad(entry.episode.season_number)}E${pad(entry.episode.episode_number)}`;

  // Le bouton "1-clic vu" n'apparaît que sur un épisode unitaire, déjà
  // diffusé (aujourd'hui inclus) et non encore vu — le calendrier /calendar
  // est la seule surface où `air_date <= today` peut arriver (la Home filtre
  // le futur strict), donc c'est bien ce cas là qui l'affiche.
  const canMarkWatched =
    entry.type === "single" &&
    !entry.watched &&
    !!entry.episode.air_date &&
    entry.episode.air_date <= today;

  const markWatched = useMarkWatched();

  const handleMark = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canMarkWatched || markWatched.isPending) return;
    if (entry.type !== "single") return;
    markWatched.mutate({ episodeId: entry.episode.id, showId: show.id });
  };

  return (
    <Link
      to="/show/$mediaType/$tmdbId"
      params={{ mediaType: show.media_type, tmdbId: String(show.tmdb_id) }}
      className="w-32 shrink-0 snap-start"
    >
      <div
        className={`relative aspect-[2/3] overflow-hidden rounded-md border border-border bg-surface-elevated ${
          saturated ? "" : "opacity-60"
        }`}
      >
        {show.poster_path && (
          <img
            src={show.poster_path}
            alt={show.title}
            loading="lazy"
            className={`h-full w-full object-cover ${saturated ? "" : "grayscale-[35%]"}`}
          />
        )}
        {/* Overlay badge, not an extra text line below the poster — keeps every
            card in a rail the same height whether or not it's watched (Home
            never sets `watched`, so this never renders there). */}
        {entry.type === "single" && entry.watched && (
          <span className="absolute right-1 top-1 flex items-center gap-1 rounded-full bg-background/85 px-1.5 py-0.5 font-counter text-[10px] uppercase tracking-widest text-cyan-accent">
            <Check className="h-3 w-3" />
            Vu
          </span>
        )}
        {canMarkWatched && (
          <button
            type="button"
            onClick={handleMark}
            disabled={markWatched.isPending}
            aria-label="Marquer comme vu"
            className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full border border-cyan-accent/50 bg-background/85 text-cyan-accent backdrop-blur-sm transition-colors hover:bg-cyan-accent/20 disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
          </button>
        )}
      </div>
      <p className="mt-1.5 line-clamp-1 text-sm text-foreground">{show.title}</p>
      <p className="font-counter text-[11px] uppercase tracking-widest text-muted-foreground">
        {sub}
      </p>
    </Link>
  );
}

/**
 * One horizontal mini-rail for a single calendar day — reuses the same
 * "aujourd'hui" treatment (primary dot + primary text) as
 * `calendar-timeline.tsx`'s `TimelineRow` day-header, rather than a
 * uniformly-muted label for every day.
 *
 * `dateHeader` is an optional override for the day-label block above the
 * rail: when provided (only `calendar-timeline.tsx` does this, to swap in
 * `CalendarDayHeader`'s "counter module" treatment for the dedicated
 * /calendar screen), it fully replaces the default dot+text `<p>` below.
 * Left `undefined` by every Home call site (`upcoming-section.tsx`), whose
 * rendering is therefore unchanged.
 */
export function DayRail({
  group,
  today,
  saturated,
  truncate,
  dateHeader,
}: {
  group: DayGroup;
  today: string;
  saturated: boolean;
  truncate?: number;
  dateHeader?: ReactNode;
}) {
  const entries = truncate ? group.entries.slice(0, truncate) : group.entries;
  const hiddenCount = group.entries.length - entries.length;
  const isToday = group.date === today;

  return (
    <div>
      {dateHeader ? (
        <div className="mb-3">{dateHeader}</div>
      ) : (
        <p className="mb-2 flex items-center gap-2 font-counter text-[10px] uppercase tracking-widest">
          {isToday && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
          <span className={isToday ? "text-primary" : "text-muted-foreground"}>
            {formatUpcomingDayLabel(group.date, today)}
          </span>
        </p>
      )}
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
        {entries.map((entry) => (
          <EntryCard key={entryKey(entry)} entry={entry} saturated={saturated} today={today} />
        ))}
        {hiddenCount > 0 && (
          <div className="flex w-32 shrink-0 items-center justify-center">
            <span className="font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
              +{hiddenCount}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
