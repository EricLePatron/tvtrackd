import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import type { TimelineDayGroup, TimelineEpisode } from "@/lib/schedule";
import { CalendarDayHeader } from "./calendar-day-header";

/** Cap before the rest of a day's episodes collapse into a "+N" line. */
const MAX_VISIBLE_PER_DAY = 3;

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

/**
 * Mini episode card for one cell of a `WeekDayColumn` — a deliberately
 * separate component from `day-rail.tsx`'s (unexported, `w-32`,
 * horizontally-arranged) `EntryCard`: the week grid needs a smaller poster
 * stacked *vertically* within a narrow day column, which `EntryCard` isn't
 * shaped for, and it isn't exported for reuse anyway. The poster treatment
 * and "Vu" badge markup/classes are intentionally copied verbatim from
 * `EntryCard` (same `bg-background/85`/`text-cyan-accent`/`Check` icon) so
 * the visual language stays identical, just at a reduced size — no new
 * color or effect introduced.
 */
function WeekEntryCard({ episode, saturated }: { episode: TimelineEpisode; saturated: boolean }) {
  const show = episode.show;

  return (
    <Link
      to="/show/$mediaType/$tmdbId"
      params={{ mediaType: show.media_type, tmdbId: String(show.tmdb_id) }}
      className="block"
    >
      <div
        className={`relative aspect-[2/3] w-12 overflow-hidden rounded-md border border-border bg-surface-elevated md:w-full ${
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
        {episode.watched && (
          <span
            aria-label="Vu"
            className="absolute right-0.5 top-0.5 flex items-center gap-0.5 rounded-full bg-background/85 px-1 py-0.5 text-cyan-accent"
          >
            <Check aria-hidden="true" className="h-2.5 w-2.5" />
          </span>
        )}
      </div>
      <p className="mt-1 line-clamp-1 text-[10px] text-foreground">{show.title}</p>
      <p className="font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
        S{pad(episode.season_number)}E{pad(episode.episode_number)}
      </p>
    </Link>
  );
}

/**
 * One column of the /calendar "Semaine" grid: `CalendarDayHeader`'s existing
 * `compact` variant (reused unmodified, per plan) followed by a vertical
 * stack of up to `MAX_VISIBLE_PER_DAY` `WeekEntryCard`s, then a "+N" line for
 * the rest — the same cap/overflow pattern as `DayRail`'s `truncate` prop,
 * just stacked vertically instead of hidden past a horizontal cutoff.
 */
export function WeekDayColumn({ group, today }: { group: TimelineDayGroup; today: string }) {
  const visible = group.episodes.slice(0, MAX_VISIBLE_PER_DAY);
  const hiddenCount = group.episodes.length - visible.length;

  return (
    <div className="w-[104px] shrink-0 snap-start md:w-full md:shrink md:snap-none">
      <CalendarDayHeader date={group.date} today={today} compact />
      <div className="mt-3 space-y-2">
        {visible.map((episode) => (
          <WeekEntryCard key={episode.id} episode={episode} saturated={group.isPastOrToday} />
        ))}
        {hiddenCount > 0 && (
          <p className="font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
            +{hiddenCount}
          </p>
        )}
        {group.episodes.length === 0 && (
          <p className="font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
            —
          </p>
        )}
      </div>
    </div>
  );
}
