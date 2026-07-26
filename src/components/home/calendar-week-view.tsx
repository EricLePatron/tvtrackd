import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { addDaysToDateString, getDayLabelParts } from "@/lib/schedule";
import type { CalendarTimeline as CalendarTimelineData } from "@/hooks/use-calendar-timeline";
import { buildFlatRows } from "./calendar-timeline-rows";

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

      {/* Vraie grille hebdomadaire : 7 colonnes côte à côte (une par jour),
          scrollables horizontalement sur petit écran — volontairement
          différente de la vue continue jour par jour. */}
      <div className="-mx-5 overflow-x-auto px-5 pb-2">
        <div className="grid min-w-[560px] grid-cols-7 gap-2">
          {days.map((date) => {
            const row = rowsByDate.get(date);
            const entries = row && row.kind === "day" ? row.entries : [];
            const isToday = date === today;
            const parts = getDayLabelParts(date, today);
            return (
              <div
                key={date}
                className={`flex min-h-[220px] flex-col rounded-lg border bg-surface p-1.5 ${
                  isToday ? "border-primary/60 bg-primary/5" : "border-border"
                }`}
              >
                <div className="mb-2 text-center">
                  <p
                    className={`font-counter text-[9px] uppercase tracking-widest ${
                      isToday ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {parts.isToday ? "AUJ." : parts.weekday}
                  </p>
                  <p
                    className={`font-counter text-lg leading-none ${
                      isToday ? "text-primary" : "text-foreground"
                    }`}
                  >
                    {parts.dayNumber}
                  </p>
                </div>
                <span
                  aria-hidden="true"
                  className={`mb-2 h-[3px] w-full rounded-full ${
                    date === today
                      ? "bg-primary"
                      : date < today
                        ? "bg-cyan-accent/70"
                        : "bg-border"
                  }`}
                />
                <div className="flex flex-1 flex-col gap-1.5">
                  {entries.length === 0 ? (
                    <span className="mt-2 text-center font-counter text-[9px] uppercase tracking-widest text-muted-foreground/60">
                      —
                    </span>
                  ) : (
                    entries.map((entry) => (
                      <Link
                        key={entry.episode.id}
                        to="/show/$mediaType/$tmdbId"
                        params={{
                          mediaType: entry.show.media_type,
                          tmdbId: String(entry.show.tmdb_id),
                        }}
                        className="group block"
                      >
                        <div
                          className={`relative aspect-[2/3] overflow-hidden rounded border border-border bg-surface-elevated ${
                            date <= today ? "" : "opacity-70"
                          }`}
                        >
                          {entry.show.poster_path && (
                            <img
                              src={entry.show.poster_path}
                              alt={entry.show.title}
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          )}
                          {entry.watched && (
                            <span className="absolute inset-x-0 bottom-0 bg-background/85 py-0.5 text-center font-counter text-[8px] uppercase tracking-widest text-cyan-accent">
                              Vu
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-center font-counter text-[9px] text-muted-foreground">
                          S{String(entry.episode.season_number).padStart(2, "0")}E
                          {String(entry.episode.episode_number).padStart(2, "0")}
                        </p>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
