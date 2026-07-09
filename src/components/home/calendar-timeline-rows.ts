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

import type { TimelineDayGroup, UpcomingSingleEntry } from "@/lib/schedule";

export type FlatRow =
  | {
      kind: "day";
      key: string;
      date: string;
      isToday: boolean;
      /** `group.isPastOrToday` — drives `DayRail`'s `saturated` prop for this day. */
      saturated: boolean;
      /** Always `UpcomingSingleEntry` — /calendar deliberately never aggregates
       *  same-day/same-season episodes into a "drop" entry the way the Home
       *  rails do (`groupUpcomingByDay`): every episode of a followed show
       *  stays individually visible while scrolling back in time. Reusing
       *  `UpcomingEntry`'s "single" variant (rather than a bespoke shape) is
       *  what lets this render through the *unmodified* `DayRail`/`EntryCard`
       *  from `day-rail.tsx`. */
      entries: UpcomingSingleEntry[];
    }
  | { kind: "empty-today"; key: string; date: string };

/**
 * Fixed row heights (no `measureElement`) so scroll-position math on prepend
 * stays exact. One row per DAY (not per episode, see `buildFlatRows`) — the
 * horizontal rail's height never changes with the number of same-day
 * entries, only its scrollable width does, so a single fixed height safely
 * covers every "day" row regardless of episode count.
 *
 * `@tanstack/react-virtual` is not installable in this sandbox (confirmed
 * again for this change: `bun install` gets a 403 from the org's npm proxy
 * for `@tanstack/react-virtual`/`@tanstack/virtual-core`), and no headless
 * browser is available either — so, unlike the *claim* in this file's
 * previous revision, these values are NOT the result of an actual
 * Playwright/`getBoundingClientRect` pass. They are instead computed
 * directly from Tailwind's own token values against `DayRail`/`EntryCard`'s
 * exact classes, which — because every line-height involved is either an
 * exact Tailwind token ratio or an explicit unitless `1.5` (Preflight's
 * `html` default, inherited since neither `text-[10px]` nor `text-[11px]`
 * pairs a line-height with their arbitrary font-size) — is a deterministic
 * multiply-by-font-size computation, not a font-metrics-dependent estimate:
 *
 * `day` (label + one row of `EntryCard`s):
 *   - label: line-height 1.5 × 10px = 15px, + `mb-2` (8px)            = 23px
 *   - poster: `w-32` (128px) × `aspect-[2/3]` (height = width × 3/2)  = 192px
 *   - title: `mt-1.5` (6px) + `text-sm` line-height (1.25/0.875 × 14) = 26px
 *   - subtitle: `text-[11px]` line-height 1.5 × 11px, no margin       = 16.5px
 *   - rail wrapper `pb-1`                                             = 4px
 *   raw total = 23 + 192 + 26 + 16.5 + 4 = 261.5px, rounded up to 264px,
 *   +4px safety margin for the case where the rail's `overflow-x-auto`
 *   reserves horizontal-scrollbar height on a non-overlay-scrollbar browser
 *   (desktop Chrome/Windows/Linux; iOS/Android/macOS use overlay scrollbars
 *   and are unaffected) → 268px.
 * `empty` (label + one line of muted text, no card, no border):
 *   - label                                                           = 23px
 *   - `text-xs` line (1/0.75 × 12px)                                  = 16px
 *   raw total = 39px, rounded up with a small buffer                  → 42px.
 *
 * Both are flagged here as computed-not-measured; a manual visual pass in an
 * environment with full network/browser access is still recommended before
 * treating them as final, same caveat as the virtualizer's scroll-anchoring
 * behavior above.
 */
export const ROW_HEIGHT = { day: 268, empty: 42 } as const;

/**
 * One `FlatRow` per calendar day (not per episode, unlike the previous
 * revision of this module) — the virtualizer only ever needs to place a
 * day's rail as a whole, since `DayRail` handles the horizontal scroll
 * internally. Non-empty days map their `TimelineEpisode`s to
 * `UpcomingSingleEntry` (never "drop") so they can flow straight into the
 * unmodified `DayRail`/`EntryCard` from `day-rail.tsx`.
 */
export function buildFlatRows(dayGroups: TimelineDayGroup[]): FlatRow[] {
  const rows: FlatRow[] = [];
  for (const group of dayGroups) {
    if (group.episodes.length === 0) {
      // Only "today" can reach this branch — buildTimelineDayGroups never
      // emits an empty group for any other date.
      rows.push({ kind: "empty-today", key: `empty-${group.date}`, date: group.date });
      continue;
    }
    rows.push({
      kind: "day",
      key: `day-${group.date}`,
      date: group.date,
      isToday: group.isToday,
      saturated: group.isPastOrToday,
      entries: group.episodes.map(
        (ep): UpcomingSingleEntry => ({
          type: "single",
          show: ep.show,
          episode: ep,
          watched: ep.watched,
        }),
      ),
    });
  }
  return rows;
}

export function estimateRowSize(row: FlatRow): number {
  return row.kind === "empty-today" ? ROW_HEIGHT.empty : ROW_HEIGHT.day;
}
