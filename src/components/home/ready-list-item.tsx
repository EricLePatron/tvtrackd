import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import type { ReadyItem } from "@/lib/schedule";
import { formatReadyLabel } from "@/lib/schedule";
import { useMarkWatched } from "@/hooks/use-mark-watched";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

/**
 * Compact row used for the "Reprendre" list under the hero ticket. Never the
 * "list item per episode" — one row per followed show. ("À commencer" no
 * longer uses this row — it renders as a horizontal poster rail instead, see
 * `start-rail.tsx`.)
 *
 * `progress` (Étage 2.2 — progression saison en cours sur "Reprendre") is
 * the show's OWN current-season watched/total tally, computed by
 * `computeReprendreProgress` (schedule.ts) and passed down by `HomeContent`
 * (index.tsx) — `undefined` when not (yet) reliable (see
 * `isSeasonTallyReliable`), in which case this row simply omits the
 * fraction/bar line entirely, exactly like the hero ticket omits its own
 * counter when `heroProgress` is `null`.
 *
 * Deliberately NOT `VhsCounter`'s "grid" variant (design review correction
 * — an earlier revision of this row did reuse it): that chip is a boxed,
 * self-contained module (`bg-surface-elevated`, rounded, padded) meant for
 * the library's dense tile grid, where every card needs the same compact
 * footprint. The validated maquette for THIS row shows the fraction + bar
 * laid directly on the card, with no box/border around them — closer to
 * `HeroTicket`'s own bare counter than to the library chip. So this row
 * hand-rolls its own minimal fraction + bar markup below rather than
 * stretching `VhsCounter`'s grid variant into a shape it was never designed
 * for. `library.tsx`'s own "grid" usage is untouched — it keeps its boxed
 * chip unchanged, per the CLAUDE.md exception that's scoped to it
 * specifically.
 *
 * S/E + episode title share one muted line ("SxxExx · titre épisode") right
 * under the show title — mirrors `HeroTicket`'s header pairing (S/E first,
 * episode title after), just without the hero's phosphore prominence: this
 * row is a compact secondary surface, so both stay muted here. The fraction
 * (cyan, discreet — never the hero's glowed/animated digit, that signature
 * treatment stays reserved for the hero, per CLAUDE.md) + a thin cyan bar
 * come right below when `progress` is available.
 *
 * No `extraCount` ("+N") badge (design review correction — removed, was
 * never part of the validated maquette): the section header's own "+N
 * actives" summary (`HomeContent`, index.tsx) already covers that count at
 * the list level — repeating it per-row amber-badged just added visual
 * noise this card doesn't need.
 */
export function ReadyListItem({
  item,
  progress,
  onTap,
}: {
  item: ReadyItem;
  progress?: { watched: number; total: number };
  /**
   * (§5 a11y fix — design review) Called with the exact "Marquer comme vu"
   * button element at the moment it's clicked, BEFORE the mutation fires —
   * lets `HomeContent` (index.tsx) remember which button had focus, so a
   * post-commit effect there can detect if THIS row got removed (Direction
   * A promoted it to hero — see `schedule.ts`'s selectHero doc comment) and
   * recover focus explicitly instead of letting the browser silently drop
   * it to `<body>`. See `HomeContent`'s own doc comment for the full
   * mechanism — this component only ever reports "I was tapped", it has no
   * opinion on what happens after.
   */
  onTap?: (button: HTMLButtonElement) => void;
}) {
  const { show, nextEpisode } = item;
  const markWatched = useMarkWatched();
  const label = formatReadyLabel(item);
  const pct =
    progress && progress.total ? Math.min(100, (progress.watched / progress.total) * 100) : 0;

  const handleMark = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (markWatched.isPending) return;
    onTap?.(e.currentTarget);
    markWatched.mutate({ episodeId: nextEpisode.id, showId: show.id });
  };

  return (
    <Link
      to="/show/$mediaType/$tmdbId"
      params={{ mediaType: show.media_type, tmdbId: String(show.tmdb_id) }}
      className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
    >
      <div className="h-14 w-10 shrink-0 overflow-hidden rounded-md border border-border bg-surface-elevated">
        {show.poster_path && (
          <img
            src={show.poster_path}
            alt={show.title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        {/* formatReadyLabel returns null once the backlog is 30j+ old — omit
            the line entirely rather than rendering an empty eyebrow. */}
        {label && (
          <p className="font-counter text-[10px] uppercase tracking-widest text-primary">{label}</p>
        )}
        <h4 className="mt-0.5 truncate text-sm text-foreground">{show.title}</h4>
        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
          <span className="font-counter">
            S{pad(nextEpisode.season_number)}E{pad(nextEpisode.episode_number)}
          </span>
          {nextEpisode.title ? ` · ${nextEpisode.title}` : ""}
        </p>
        {progress && (
          <div className="mt-1.5">
            <p className="font-counter text-xs tabular-nums text-cyan-accent">
              {progress.watched}/{progress.total}
            </p>
            {/* Barre fine (2px), cyan, posée directement sur la carte — pas
                de conteneur encadré (revue design). Même langage visuel que
                la barre du HeroTicket (index.tsx), à une échelle plus
                discrète. */}
            <div className="mt-1 h-[2px] w-full overflow-hidden rounded-full bg-muted-foreground/15">
              <div
                className="h-full rounded-full bg-cyan-accent transition-[width] duration-300 ease-out motion-reduce:transition-none"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}
      </div>
      {/* 44px tap target (WCAG 2.5.5) — the visible icon stays small (~16px),
          only the hitbox grows, matching the hero ticket's own check button. */}
      <button
        type="button"
        onClick={handleMark}
        disabled={markWatched.isPending}
        aria-label="Marquer comme vu"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cyan-accent/40 bg-cyan-accent/10 text-cyan-accent transition-colors hover:bg-cyan-accent/20 disabled:opacity-50"
      >
        <Check className="h-4 w-4" />
      </button>
    </Link>
  );
}
