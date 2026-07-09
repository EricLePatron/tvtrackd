import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { CalendarTimeline as CalendarTimelineData } from "@/hooks/use-calendar-timeline";
import { DayRail } from "./day-rail";
import { CalendarDayHeader } from "./calendar-day-header";
import {
  buildFlatRows,
  estimateRowSize,
  getTemporalBarClass,
  ROW_HEIGHT,
  type FlatRow,
} from "./calendar-timeline-rows";

/**
 * Pinned-header bar height (px): `CalendarDayHeader`'s `compact` module
 * (32px) + the overlay's own `py-2` padding (16px) + its `border-b` (1px),
 * rounded up. Used to push the pagination pill (`showTopOverlay` below) down
 * far enough that the two top-pinned overlays never visually collide —
 * deliberately never suppressing either one; both must stay reachable at
 * the same time (e.g. "Début de l'historique" while today's date is still
 * pinned above it).
 */
const STICKY_HEADER_HEIGHT = 52;

/**
 * Full bidirectional timeline for the dedicated /calendar screen: a single
 * virtualized vertical list, one row per DAY, each rendered through the
 * unmodified `DayRail`/`EntryCard` from `day-rail.tsx` (same poster card,
 * same horizontal scroll-if-several layout as the Home rails) — never the
 * Home rails' "drop" aggregation (see `calendar-timeline-rows.ts`). Anchored
 * on "today" on mount, with unlimited backward pagination as the user
 * scrolls up. `upcoming-section.tsx` (Home's bucket-header wrapper around
 * `DayRail`) is untouched and unrelated to this component.
 */
export function CalendarTimelineList({ timeline }: { timeline: CalendarTimelineData }) {
  const {
    today,
    dayGroups,
    isLoading,
    isFetchingPreviousPage,
    isError,
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

  // Single layout effect handling both "anchor on today" (first load) and
  // "preserve scroll position on prepend" (subsequent backward pages) —
  // deliberately merged rather than split across two effects. Splitting them
  // caused a regression: on the very first commit where `flatRows` goes from
  // empty to the full initial window, both effects used to fire in the same
  // pass. The anchor effect would call `scrollToIndex` (synchronous
  // `scrollTop` write) and flip `hasScrolledToToday.current` to `true`; the
  // second effect would then see that ref already `true` with
  // `previousTotalSize.current` still at its initial `0`, and add the *entire*
  // newly-loaded content height on top of the position `scrollToIndex` had
  // just set — overshooting past the scrollable max, which the browser
  // clamps to the bottom of the list. Merging into one effect makes the two
  // cases mutually exclusive within a single run: the first-load branch
  // anchors *and* establishes the `previousTotalSize` baseline together, so
  // it can never also be treated as a prepend to compensate for.
  useLayoutEffect(() => {
    const newTotalSize = rowVirtualizer.getTotalSize();

    if (!hasScrolledToToday.current) {
      if (!flatRows.length) return;
      // Both `FlatRow` kinds carry `date` — buildTimelineDayGroups always
      // includes a group for "today" (possibly empty, hence "empty-today"),
      // so comparing on `date` covers both the populated and empty cases.
      const todayIndex = flatRows.findIndex((r) => r.date === today);
      if (todayIndex === -1) return; // defensive: buildTimelineDayGroups always includes "today"
      rowVirtualizer.scrollToIndex(todayIndex, { align: "start" });
      hasScrolledToToday.current = true;
      previousTotalSize.current = newTotalSize;
      return;
    }

    // Already anchored: any growth in total size comes from an older page
    // prepended above the current viewport — nudge scrollTop by that exact
    // delta so whatever the user was looking at doesn't visually move.
    const diff = newTotalSize - previousTotalSize.current;
    if (diff > 0 && scrollElementRef.current) {
      scrollElementRef.current.scrollTop += diff;
    }
    previousTotalSize.current = newTotalSize;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flatRows]);

  const virtualItems = rowVirtualizer.getVirtualItems();
  const firstRenderedIndex = virtualItems[0]?.index ?? 0;

  // Trigger backward pagination once the rendered window nears the top —
  // gated on the initial "today" anchor having already happened, so we
  // never fire an unrequested fetch while the list is still sitting at its
  // pre-anchor scroll position (which would otherwise look like index ~0,
  // i.e. "near the top", on the very first paint).
  useEffect(() => {
    if (!hasScrolledToToday.current) return;
    if (firstRenderedIndex <= 4 && hasPreviousPage && !isFetchingPreviousPage && !isError) {
      fetchPreviousPage();
    }
  }, [firstRenderedIndex, hasPreviousPage, isFetchingPreviousPage, isError, fetchPreviousPage]);

  // Which row currently sits at (or just above) the top edge of the visible
  // viewport — drives the pinned header overlay below. Deliberately NOT
  // `virtualItems[0]`: with `overscan: 6`, the first *rendered* item is
  // usually several rows above the actual viewport top. Instead, walk the
  // (index-ascending) virtual items and keep the last one whose `start` has
  // already been scrolled past — the standard "sticky section header"
  // lookup for a virtualized list. `rowVirtualizer.scrollOffset` is the same
  // live scroll position the virtualizer already tracks internally to
  // compute `virtualItems` on every scroll tick, so reading it here adds no
  // new re-render churn beyond what the virtualizer already causes.
  const scrollOffset = rowVirtualizer.scrollOffset ?? 0;
  const stickyRow = useMemo(() => {
    let candidate: FlatRow | null = null;
    for (const item of virtualItems) {
      if (item.start <= scrollOffset) {
        candidate = flatRows[item.index];
      } else {
        break;
      }
    }
    return candidate ?? flatRows[0] ?? null;
  }, [virtualItems, scrollOffset, flatRows]);

  if (isLoading) {
    return (
      <div className="space-y-3 px-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton style={{ height: ROW_HEIGHT.day }} className="w-full" />
        <Skeleton className="h-4 w-24" />
        <Skeleton style={{ height: ROW_HEIGHT.day }} className="w-full" />
      </div>
    );
  }

  // All three states below concern the *past* boundary (backward pagination:
  // in flight / failed / exhausted) — they must anchor to the TOP of the
  // scrollable area, not appear after the virtualized rows (which is the
  // bottom of the DOM flow, i.e. the future/J+90 end). Same overlay technique
  // for all three (absolute, pinned to the viewport top, outside the scroll
  // flow) so the retry affordance is reachable without scrolling all the way
  // down to the future horizon first.
  //
  // `isFetchingPreviousPage` is inherently scroll-gated already (it only
  // becomes true from the `firstRenderedIndex <= 4` trigger below). `isError`
  // and `!hasPreviousPage`, once true, stay true for the rest of the session
  // regardless of where the user scrolls afterwards — so they must be
  // explicitly re-gated on the same "near the top" condition, or the pill
  // would stay permanently pinned over whatever is currently at the top of
  // the viewport (e.g. "aujourd'hui"), even while browsing the future.
  const nearTop = firstRenderedIndex <= 4;
  const showTopOverlay = isFetchingPreviousPage || (nearTop && (isError || !hasPreviousPage));

  return (
    <div className="relative">
      {stickyRow && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 border-b border-border bg-surface px-5 py-2">
          <CalendarDayHeader date={stickyRow.date} today={today} compact />
        </div>
      )}
      {showTopOverlay && (
        <div
          className="pointer-events-none absolute inset-x-0 z-20 flex justify-center pt-2"
          style={{ top: STICKY_HEADER_HEIGHT }}
        >
          {isFetchingPreviousPage ? (
            <Skeleton className="h-6 w-32 rounded-full" />
          ) : isError ? (
            <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-3 pr-1.5">
              <p className="font-counter text-[10px] uppercase tracking-widest text-destructive">
                Erreur de chargement
              </p>
              <Button variant="outline" size="sm" onClick={fetchPreviousPage}>
                Réessayer
              </Button>
            </div>
          ) : (
            <p className="rounded-full border border-border bg-card px-3 py-1 font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
              Début de l'historique
            </p>
          )}
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
      </div>
    </div>
  );
}

/**
 * Renders each day's row: a vertical "temporal status" bar (liseré — past /
 * today / future, see `getTemporalBarClass`) followed by either `DayRail`
 * (imported unmodified from `day-rail.tsx`, its default label swapped for
 * `CalendarDayHeader`'s counter-module treatment via the `dateHeader` prop)
 * for a populated day, or a plain, border-free header + text line for the
 * one case `DayRail` doesn't cover: an empty "today".
 */
function TimelineRow({ row, today }: { row: FlatRow; today: string }) {
  const barClass = getTemporalBarClass(row.date, today);

  if (row.kind === "empty-today") {
    return (
      <div className="flex gap-3">
        <span className={`shrink-0 self-stretch rounded-full ${barClass}`} />
        <div className="min-w-0 flex-1">
          <div className="mb-3">
            <CalendarDayHeader date={row.date} today={today} />
          </div>
          <p className="text-xs text-muted-foreground">Rien de prévu aujourd'hui.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <span className={`shrink-0 self-stretch rounded-full ${barClass}`} />
      <div className="min-w-0 flex-1">
        <DayRail
          group={{ date: row.date, entries: row.entries }}
          today={today}
          saturated={row.saturated}
          dateHeader={<CalendarDayHeader date={row.date} today={today} />}
        />
      </div>
    </div>
  );
}
