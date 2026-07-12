import { CalendarDays, Rows3 } from "lucide-react";
import type { CalendarViewPreference } from "@/lib/client-storage";

/**
 * Single-tap Agenda/Semaine toggle for the /calendar header. Always shows
 * the DESTINATION view (icon + label), not the current one, per the product
 * decision. Sober styling matching the design system's other pill-shaped
 * controls: transparent background, thin `--border`, muted text/icon,
 * amber (`--primary`) hover — no new color/effect.
 */
export function CalendarViewToggle({
  view,
  onToggle,
}: {
  view: CalendarViewPreference;
  onToggle: (next: CalendarViewPreference) => void;
}) {
  const next: CalendarViewPreference = view === "agenda" ? "semaine" : "agenda";
  const label = next === "semaine" ? "Semaine" : "Agenda";
  const Icon = next === "semaine" ? CalendarDays : Rows3;

  return (
    <button
      type="button"
      onClick={() => onToggle(next)}
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-transparent px-3 font-counter text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
