import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { CalendarWeek } from "@/hooks/use-calendar-week";
import { WeekDayColumn } from "./week-day-column";

function formatWeekRangeLabel(weekStart: string, weekDates: string[]): string {
  const last = weekDates[weekDates.length - 1];
  const startLabel = new Date(`${weekStart}T00:00:00Z`).toLocaleDateString("fr-FR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
  });
  const endLabel = new Date(`${last}T00:00:00Z`).toLocaleDateString("fr-FR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
  });
  return `${startLabel} — ${endLabel}`;
}

const navButtonClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-transparent text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary";

/**
 * Grid view for the /calendar "Semaine" toggle: a Prev/Today/Next nav row
 * (custom-styled buttons, matching `library.tsx`'s status-filter buttons
 * rather than shadcn primitives) above 7 `WeekDayColumn`s — a horizontally
 * scrollable, snap-aligned strip on mobile (same overflow-x technique as
 * `DayRail`, not the `DayRail` component itself) and a static 7-column CSS
 * grid from `md:` up.
 */
export function CalendarWeekGrid({
  week,
  today,
  onPrevWeek,
  onNextWeek,
  onToday,
}: {
  week: CalendarWeek;
  today: string;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
}) {
  const weekDates = week.dayGroups.map((g) => g.date);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 px-5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrevWeek}
            aria-label="Semaine précédente"
            className={navButtonClass}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onNextWeek}
            aria-label="Semaine suivante"
            className={navButtonClass}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {weekDates.length > 0 && (
            <span className="font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
              {formatWeekRangeLabel(week.weekStart, weekDates)}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onToday}
          className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-transparent px-3 font-counter text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
        >
          Auj.
        </button>
      </div>

      {week.isError ? (
        <div className="mt-5 flex justify-center px-5">
          <div className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-3 pr-1.5">
            <p className="font-counter text-[10px] uppercase tracking-widest text-destructive">
              Erreur de chargement
            </p>
            <Button variant="outline" size="sm" onClick={week.refetch}>
              Réessayer
            </Button>
          </div>
        </div>
      ) : week.isLoading ? (
        <div className="mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 md:grid md:grid-cols-7 md:overflow-visible">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-[104px] shrink-0 md:w-auto md:shrink" />
          ))}
        </div>
      ) : (
        <div className="mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 md:grid md:grid-cols-7 md:overflow-visible">
          {week.dayGroups.map((group) => (
            <WeekDayColumn key={group.date} group={group} today={today} />
          ))}
        </div>
      )}
    </div>
  );
}
