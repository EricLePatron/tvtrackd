import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { addDaysToDateString } from "@/lib/schedule";
import type { CalendarTimeline as CalendarTimelineData } from "@/hooks/use-calendar-timeline";
import { DayRail } from "./day-rail";
import { CalendarDayHeader } from "./calendar-day-header";
import { buildFlatRows, getTemporalBarClass } from "./calendar-timeline-rows";

/** Lundi de la semaine contenant `date` (chaîne YYYY-MM-DD). */
function startOfWeek(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0 = dimanche
  const offset = dow === 0 ? -6 : 1 - dow;
  return addDaysToDateString(date, offset);
}

function formatRange(start: string, end: string): string {
  const fmt = (s: string) =>
    new Date(`${s}T00:00:00Z`).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  return `${fmt(start)} – ${fmt(end)}`;
}

/**
 * Vue "semaine par semaine" du calendrier : même données que la timeline
 * verticale (`useCalendarTimeline`), mais bornées à 7 jours avec navigation
 * explicite. Réutilise `DayRail`/`CalendarDayHeader` sans les modifier.
 */
export function CalendarWeekView({ timeline }: { timeline: CalendarTimelineData }) {
  const { today, dayGroups, isLoading, hasPreviousPage, isFetchingPreviousPage, fetchPreviousPage } =
    timeline;
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today));
  const weekEnd = addDaysToDateString(weekStart, 6);

  const rowsByDate = useMemo(() => {
    const map = new Map<string, ReturnType<typeof buildFlatRows>[number]>();
    for (const row of buildFlatRows(dayGroups)) map.set(row.date, row);
    return map;
  }, [dayGroups]);

  const earliestLoaded = dayGroups[0]?.date;

  // Navigation vers le passé au-delà de la fenêtre chargée : on demande la
  // page précédente (pagination arrière déjà gérée par le hook).
  useEffect(() => {
    if (!earliestLoaded) return;
    if (weekStart < earliestLoaded && hasPreviousPage && !isFetchingPreviousPage) {
      fetchPreviousPage();
    }
  }, [weekStart, earliestLoaded, hasPreviousPage, isFetchingPreviousPage, fetchPreviousPage]);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysToDateString(weekStart, i)),
    [weekStart],
  );

  if (isLoading) {
    return (
      <div className="space-y-3 px-5">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  return (
    <div className="px-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <button
          type="button"
          aria-label="Semaine précédente"
          onClick={() => setWeekStart((w) => addDaysToDateString(w, -7))}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-surface-elevated"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <p className="font-counter text-[13px] uppercase tracking-widest text-foreground">
            {formatRange(weekStart, weekEnd)}
          </p>
          {weekStart !== startOfWeek(today) && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-[11px] uppercase tracking-widest"
              onClick={() => setWeekStart(startOfWeek(today))}
            >
              Cette semaine
            </Button>
          )}
        </div>
        <button
          type="button"
          aria-label="Semaine suivante"
          onClick={() => setWeekStart((w) => addDaysToDateString(w, 7))}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-surface-elevated"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-6">
        {days.map((date) => {
          const row = rowsByDate.get(date);
          return (
            <div key={date} className="flex gap-3">
              <span
                aria-hidden="true"
                className={`shrink-0 self-stretch rounded-full ${getTemporalBarClass(date, today)}`}
              />
              <div className="min-w-0 flex-1">
                {row && row.kind === "day" ? (
                  <DayRail
                    group={{ date, entries: row.entries }}
                    today={today}
                    saturated={row.saturated}
                    dateHeader={<CalendarDayHeader date={date} today={today} />}
                  />
                ) : (
                  <>
                    <div className="mb-2">
                      <CalendarDayHeader date={date} today={today} />
                    </div>
                    <p className="text-xs text-muted-foreground">Rien de prévu.</p>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
