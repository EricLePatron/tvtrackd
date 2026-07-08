import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatUpcomingDayLabel } from "@/lib/schedule";
import type { CalendarTimeline as CalendarTimelineData } from "@/hooks/use-calendar-timeline";
import { DayRail } from "./day-rail";
import { buildFlatRows, estimateRowSize, ROW_HEIGHT, type FlatRow } from "./calendar-timeline-rows";

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
      {showTopOverlay && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center pt-2">
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
 * Renders each day's row: `DayRail` (imported unmodified from `day-rail.tsx`)
 * for a populated day — identical poster-card/horizontal-rail layout as the
 * Home screen, no border/background wrapper around it — or a plain,
 * border-free label + text line for the one case `DayRail` doesn't cover:
 * an empty "today". The label markup below intentionally mirrors (small,
 * unavoidable duplication) `DayRail`'s own day-label JSX, since `day-rail.tsx`
 * is not to be modified to add an "empty state" variant to the shared
 * component.
 */
function TimelineRow({ row, today }: { row: FlatRow; today: string }) {
  if (row.kind === "empty-today") {
    return (
      <div>
        <p className="mb-2 flex items-center gap-2 font-counter text-[10px] uppercase tracking-widest">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          <span className="text-primary">{formatUpcomingDayLabel(row.date, today)}</span>
        </p>
        <p className="text-xs text-muted-foreground">Rien de prévu aujourd'hui.</p>
      </div>
    );
  }

  return (
    <DayRail
      group={{ date: row.date, entries: row.entries }}
      today={today}
      saturated={row.saturated}
    />
  );
}
