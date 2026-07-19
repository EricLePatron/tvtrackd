import { cn } from "@/lib/utils";

/**
 * Extracted from the show detail page (`show.$mediaType.$tmdbId.tsx`, where
 * it was first introduced for `ProgressCard`'s "Votre progression" badge) so
 * the library grid's status tabs (`library.tsx`) can reuse the exact same
 * tone tokens instead of growing a third, divergent pill variant — cf.
 * CLAUDE.md's design-system discipline.
 */
export type PillTone = "amber" | "cyan" | "muted";

export const PILL_TONE_CLASSES: Record<PillTone, string> = {
  amber: "border-primary/40 bg-primary/10 text-primary",
  cyan: "border-cyan-accent/40 bg-cyan-accent/10 text-cyan-accent",
  muted: "border-border text-muted-foreground",
};

/** Same tone tokens, dimmed — used by `library.tsx`'s inactive status tabs (`active={false}`) so the selected tab still reads as the one "lit up" among the row. */
const PILL_TONE_CLASSES_INACTIVE: Record<PillTone, string> = {
  amber: "border-border bg-card text-muted-foreground",
  cyan: "border-border bg-card text-muted-foreground",
  muted: "border-border bg-card text-muted-foreground",
};

export const PILL_DOT_CLASSES: Record<PillTone, string> = {
  amber: "bg-primary",
  cyan: "bg-cyan-accent",
  muted: "bg-muted-foreground",
};

export function StatusPill({
  label,
  tone,
  count,
  active = true,
}: {
  label: string;
  tone: PillTone;
  /**
   * Optional leading counter chip (e.g. library's per-status show count).
   * Absent by default — `ProgressCard`'s read-only pill on the show detail
   * page never passes it, so its rendering is unaffected by this addition.
   */
  count?: number;
  /**
   * Whether this pill renders "lit up" in its full tone (the only mode that
   * existed before this prop, and still the default — `ProgressCard` always
   * renders `active` pills). `false` dims it to a neutral/inactive look
   * while keeping the semantic dot color, for `library.tsx`'s non-selected
   * status tabs.
   */
  active?: boolean;
}) {
  // A tab pill (identified by `count` being passed — `ProgressCard`'s
  // read-only pill never is) uses ONE uniform "selected" look on every status:
  // the app's amber selection wash, with the semantic dot (`PILL_DOT_CLASSES`)
  // carrying the status color. This keeps selection learnable ("amber wash = I
  // am here") instead of the wash changing color per tab (cyan on Terminé,
  // amber on En cours…). `ProgressCard` (no `count`) is untouched: it still
  // renders `PILL_TONE_CLASSES[tone]`, pixel-identical to before the extraction.
  const isTab = count !== undefined;
  const activeClass = isTab
    ? "border-primary/40 bg-primary/10 text-foreground"
    : PILL_TONE_CLASSES[tone];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 font-counter text-[10px] uppercase tracking-widest",
        active ? activeClass : PILL_TONE_CLASSES_INACTIVE[tone],
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 shrink-0 rounded-full", PILL_DOT_CLASSES[tone])}
        aria-hidden="true"
      />
      {count !== undefined && (
        <span className="tabular-nums">{count.toString().padStart(2, "0")}</span>
      )}
      {label}
    </span>
  );
}
