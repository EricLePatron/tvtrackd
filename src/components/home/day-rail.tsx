import { Link } from "@tanstack/react-router";
import type { DayGroup, UpcomingEntry } from "@/lib/schedule";
import { formatUpcomingDayLabel } from "@/lib/schedule";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function entryKey(entry: UpcomingEntry) {
  return entry.type === "drop"
    ? `drop-${entry.show.id}-${entry.seasonNumber}`
    : `single-${entry.episode.id}`;
}

function EntryCard({ entry, saturated }: { entry: UpcomingEntry; saturated: boolean }) {
  const show = entry.show;
  const sub =
    entry.type === "drop"
      ? `S${pad(entry.seasonNumber)} · +${entry.count} épisodes`
      : `S${pad(entry.episode.season_number)}E${pad(entry.episode.episode_number)}`;

  return (
    <Link
      to="/show/$mediaType/$tmdbId"
      params={{ mediaType: show.media_type, tmdbId: String(show.tmdb_id) }}
      className="w-32 shrink-0 snap-start"
    >
      <div
        className={`aspect-[2/3] overflow-hidden rounded-md border border-border bg-surface-elevated ${
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
 */
export function DayRail({
  group,
  today,
  saturated,
  truncate,
}: {
  group: DayGroup;
  today: string;
  saturated: boolean;
  truncate?: number;
}) {
  const entries = truncate ? group.entries.slice(0, truncate) : group.entries;
  const hiddenCount = group.entries.length - entries.length;
  const isToday = group.date === today;

  return (
    <div>
      <p className="mb-2 flex items-center gap-2 font-counter text-[10px] uppercase tracking-widest">
        {isToday && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
        <span className={isToday ? "text-primary" : "text-muted-foreground"}>
          {formatUpcomingDayLabel(group.date, today)}
        </span>
      </p>
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
        {entries.map((entry) => (
          <EntryCard key={entryKey(entry)} entry={entry} saturated={saturated} />
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
