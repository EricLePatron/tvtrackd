import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatUpcomingDayLabel,
  type TimelineDayGroup,
  type TimelineEpisode,
} from "@/lib/schedule";
import type { CalendarTimeline as CalendarTimelineData } from "@/hooks/use-calendar-timeline";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

type FlatRow =
  | { kind: "day-header"; key: string; date: string; isToday: boolean }
  | { kind: "empty-today"; key: string }
  | { kind: "episode"; key: string; saturated: boolean; episode: TimelineEpisode };

/** Fixed row heights (no `measureElement`) so scroll-position math on prepend stays exact. */
const ROW_HEIGHT = { header: 36, episode: 76, empty: 56 } as const;

function buildFlatRows(dayGroups: TimelineDayGroup[]): FlatRow[] {
  const rows: FlatRow[] = [];
  for (const group of dayGroups) {
    rows.push({
      kind: "day-header",
      key: `h-${group.date}`,
      date: group.date,
      isToday: group.isToday,
    });
    if (group.episodes.length === 0) {
      // Only "today" can reach this branch — buildTimelineDayGroups never
      // emits an empty group for any other date.
      rows.push({ kind: "empty-today", key: `empty-${group.date}` });
    } else {
      for (const ep of group.episodes) {
        rows.push({
          kind: "episode",
          key: `ep-${ep.id}`,
          saturated: group.isPastOrToday,
          episode: ep,
        });
      }
    }
  }
  return rows;
}

function estimateRowSize(row: FlatRow): number {
  if (row.kind === "day-header") return ROW_HEIGHT.header;
  if (row.kind === "empty-today") return ROW_HEIGHT.empty;
  return ROW_HEIGHT.episode;
}

/**
 * Full bidirectional timeline for the dedicated /calendar screen: a single
 * virtualized vertical list, one row per episode (never the Home rails'
 * "drop" aggregation), anchored on "today" on mount, with unlimited backward
 * pagination as the user scrolls up. Home's rails (`day-rail.tsx`,
 * `upcoming-section.tsx`) are untouched and unrelated to this component.
 */
export function CalendarTimelineList({ timeline }: { timeline: CalendarTimelineData }) {
  const {
    today,
    dayGroups,
    isLoading,
    isFetchingPreviousPage,
    hasPreviousPage,
    fetchPreviousPage,
  } = timeline;

  const flatRows = useMemo(() => buildFlatRows(dayGroups), [dayGroups]);
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const hasScrolledToToday = useRef(false);
  const previousTotalSize = useRef(0);

  const rowVirtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: (index) => estimateRowSize(flatRows[index]),
    overscan: 6,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const firstRenderedIndex = virtualItems[0]?.index ?? 0;

  // Trigger backward pagination once the rendered window nears the top.
  useEffect(() => {
    if (firstRenderedIndex <= 4 && hasPreviousPage && !isFetchingPreviousPage) {
      fetchPreviousPage();
    }
  }, [firstRenderedIndex, hasPreviousPage, isFetchingPreviousPage, fetchPreviousPage]);

  // Preserve scroll position when older pages are prepended at the top: the
  // virtualizer's total size grows by exactly the height of the new rows,
  // so nudging scrollTop by that same delta keeps the viewport pinned on
  // whatever the user was already looking at (no visual jump).
  useLayoutEffect(() => {
    const newTotalSize = rowVirtualizer.getTotalSize();
    const diff = newTotalSize - previousTotalSize.current;
    if (hasScrolledToToday.current && diff > 0 && scrollElementRef.current) {
      scrollElementRef.current.scrollTop += diff;
    }
    previousTotalSize.current = newTotalSize;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flatRows.length]);

  // Anchor on "today" once the initial window has loaded (runs once).
  useEffect(() => {
    if (hasScrolledToToday.current || !flatRows.length) return;
    const todayIndex = flatRows.findIndex((r) => r.kind === "day-header" && r.isToday);
    if (todayIndex === -1) return;
    rowVirtualizer.scrollToIndex(todayIndex, { align: "start" });
    hasScrolledToToday.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flatRows]);

  if (isLoading) {
    return (
      <div className="space-y-3 px-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-[68px] w-full" />
        <Skeleton className="h-[68px] w-full" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-[68px] w-full" />
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Overlay, not part of the scroll flow — never affects scrollHeight/anchoring math. */}
      {isFetchingPreviousPage && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center pt-2">
          <Skeleton className="h-6 w-32 rounded-full" />
        </div>
      )}
      <div ref={scrollElementRef} className="h-[70vh] overflow-y-auto px-5">
        <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative", width: "100%" }}>
          {virtualItems.map((virtualRow) => {
            const row = flatRows[virtualRow.index];
            return (
              <div
                key={row.key}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: virtualRow.size,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <TimelineRow row={row} today={today} />
              </div>
            );
          })}
        </div>
        {!hasPreviousPage && (
          <p className="py-4 text-center font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
            Début de l'historique
          </p>
        )}
      </div>
    </div>
  );
}

function TimelineRow({ row, today }: { row: FlatRow; today: string }) {
  if (row.kind === "day-header") {
    return (
      <div className="flex h-9 items-center gap-2">
        {row.isToday && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
        <p
          className={`font-counter text-[10px] uppercase tracking-widest ${
            row.isToday ? "text-primary" : "text-muted-foreground"
          }`}
        >
          {formatUpcomingDayLabel(row.date, today)}
        </p>
      </div>
    );
  }

  if (row.kind === "empty-today") {
    return (
      <div className="flex h-14 items-center">
        <p className="text-xs text-muted-foreground">Rien de prévu aujourd'hui.</p>
      </div>
    );
  }

  return <EpisodeRow episode={row.episode} saturated={row.saturated} />;
}

/** One row per episode — reuses the same `saturated` treatment as the Home rails' `EntryCard`. */
function EpisodeRow({ episode, saturated }: { episode: TimelineEpisode; saturated: boolean }) {
  const { show } = episode;
  return (
    <Link
      to="/show/$mediaType/$tmdbId"
      params={{ mediaType: show.media_type, tmdbId: String(show.tmdb_id) }}
      className="flex h-[68px] items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
    >
      <div
        className={`h-14 w-10 shrink-0 overflow-hidden rounded-md border border-border bg-surface-elevated ${
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
      <div className="min-w-0 flex-1">
        <h4 className="truncate text-sm text-foreground">{show.title}</h4>
        <p className="truncate text-xs text-muted-foreground">{episode.title ?? "—"}</p>
        <p className="font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
          S{pad(episode.season_number)} E{pad(episode.episode_number)}
        </p>
      </div>
      {/* Vu/à-voir badge: only for aired entries, watched-only signal (cyan-accent, same as
          elsewhere in the app) — absence of the badge implies "pas encore vu". */}
      {saturated && episode.watched && (
        <span className="flex shrink-0 items-center gap-1 font-counter text-[10px] uppercase tracking-widest text-cyan-accent">
          <Check className="h-3 w-3" />
          Vu
        </span>
      )}
    </Link>
  );
}
