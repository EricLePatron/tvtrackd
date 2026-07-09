import type { DayGroup } from "@/lib/schedule";
import { countUpcomingEntries } from "@/lib/schedule";
import { DayRail } from "@/components/home/day-rail";

/**
 * A stack of per-day mini-rails under one bucket header (Demain / Cette
 * semaine / Plus tard). Shared between the home screen (truncated, desaturated)
 * and the dedicated /calendar screen (full, saturated).
 */
export function UpcomingBucketRails({
  label,
  groups,
  today,
  saturated,
  truncatePerGroup,
  maxGroups,
}: {
  label: string;
  groups: DayGroup[];
  today: string;
  saturated: boolean;
  truncatePerGroup?: number;
  maxGroups?: number;
}) {
  if (!groups.length) return null;
  const visibleGroups = maxGroups ? groups.slice(0, maxGroups) : groups;
  const hiddenGroupCount = groups.length - visibleGroups.length;

  return (
    <section>
      <h3 className="mb-3 font-display text-sm uppercase tracking-widest text-foreground">
        {label}
      </h3>
      <div className="space-y-4">
        {visibleGroups.map((group) => (
          <DayRail
            key={group.date}
            group={group}
            today={today}
            saturated={saturated}
            truncate={truncatePerGroup}
          />
        ))}
      </div>
      {hiddenGroupCount > 0 && (
        <p className="mt-2 font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
          +{countUpcomingEntries(groups.slice(maxGroups))} autres épisodes prévus
        </p>
      )}
    </section>
  );
}
