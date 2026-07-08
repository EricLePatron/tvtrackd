/**
 * Pure, React-free row-shaping logic for the /calendar timeline virtualizer.
 * No React, no `@tanstack/react-virtual`, no UI imports — same spirit as
 * `src/lib/schedule.ts` ("No React, no Supabase... unit-tested in
 * isolation"). `calendar-timeline.tsx` imports from here rather than
 * defining this logic inline, precisely so it stays testable without pulling
 * in the virtualizer/UI component tree.
 *
 * These functions (and their tests in `calendar-timeline-rows.test.ts`)
 * cover row shaping/ordering only — they do NOT and cannot exercise the
 * virtualizer itself (scroll-anchoring to "today", `scrollToIndex`, absence
 * of visual overlap between rows while scrolling), which still needs a
 * manual pass once `@tanstack/react-virtual` is installable in an
 * environment with full network access.
 */

import type { TimelineDayGroup, TimelineEpisode } from "@/lib/schedule";

export type FlatRow =
  | { kind: "day-header"; key: string; date: string; isToday: boolean }
  | { kind: "empty-today"; key: string }
  | {
      kind: "episode";
      key: string;
      saturated: boolean;
      /** `group.isToday` — distinct from `saturated` (past-or-today): drives the
       *  reinforced "aujourd'hui" background/border on the row itself, since this
       *  flat, individually-positioned-row virtualizer has no per-day wrapper to
       *  attach a group background to. */
      isToday: boolean;
      episode: TimelineEpisode;
    };

/**
 * Fixed row heights (no `measureElement`) so scroll-position math on prepend
 * stays exact. `episode` is the single source of truth for the episode row
 * slot — `EpisodeRow` fills it via `h-full` + bottom padding rather than a
 * second hardcoded height, so the two can never drift apart.
 *
 * All three values were measured with a headless-browser pass against the
 * actual rendered markup (Playwright, `getBoundingClientRect` on the exact
 * row classes, with representative text content), not hand-estimated:
 * header = h-10 (40px, exact — fixed height, no content-driven variance),
 * episode = 106px (h-20/80px poster + py-2/16px + border/2px on the `Link`,
 * + pb-2/8px on the outer slot — the poster is still the height-driving
 * element even with 3 lines of text), empty = h-14 (56px, unchanged).
 */
export const ROW_HEIGHT = { header: 40, episode: 106, empty: 56 } as const;

export function buildFlatRows(dayGroups: TimelineDayGroup[]): FlatRow[] {
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
          isToday: group.isToday,
          episode: ep,
        });
      }
    }
  }
  return rows;
}

export function estimateRowSize(row: FlatRow): number {
  if (row.kind === "day-header") return ROW_HEIGHT.header;
  if (row.kind === "empty-today") return ROW_HEIGHT.empty;
  return ROW_HEIGHT.episode;
}
