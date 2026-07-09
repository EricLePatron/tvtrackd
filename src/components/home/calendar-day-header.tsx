import { getDayLabelParts } from "@/lib/schedule";

/**
 * The /calendar screen's "counter module" day header — the quantième alone
 * in a square, `font-counter` module (evoking the VHS/mechanical-counter
 * design signature), with the weekday/month stacked next to it. Deliberately
 * NOT used by `DayRail`'s default label (Home keeps its plain dot+text
 * label unchanged) — this is wired in only from `calendar-timeline.tsx`,
 * either via `DayRail`'s optional `dateHeader` prop (populated days) or
 * rendered directly (the "empty-today" row, and the pinned sticky overlay).
 *
 * `compact` is the pinned-header variant used by the sticky overlay: same
 * tokens/colors, smaller module and a single-line weekday+month (instead of
 * stacked), sized to fit a slim full-width bar.
 */
export function CalendarDayHeader({
  date,
  today,
  compact,
}: {
  date: string;
  today: string;
  compact?: boolean;
}) {
  const parts = getDayLabelParts(date, today);

  return (
    <div className="flex items-center gap-3">
      <div
        className={
          "flex shrink-0 items-center justify-center rounded-md bg-surface-elevated " +
          (parts.isToday ? "border border-primary/50" : "") +
          (compact ? " h-8 w-8" : " h-[46px] w-[46px]")
        }
      >
        <span
          className={
            "font-counter " +
            (parts.isToday ? "text-primary" : "text-foreground") +
            (compact ? " text-base" : " text-[22px]")
          }
        >
          {parts.dayNumber}
        </span>
      </div>
      {parts.isToday ? (
        <span className="font-counter text-[10px] uppercase tracking-widest text-primary">
          Aujourd'hui
        </span>
      ) : compact ? (
        <span className="font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
          {parts.weekday} {parts.month}
        </span>
      ) : (
        <div className="flex flex-col leading-tight">
          <span className="font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
            {parts.weekday}
          </span>
          <span className="font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
            {parts.month}
          </span>
        </div>
      )}
    </div>
  );
}
