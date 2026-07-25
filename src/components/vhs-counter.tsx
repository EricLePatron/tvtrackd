import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useRollingNumber } from "@/hooks/use-rolling-number";

type GridTone = "amber" | "muted";

type VhsCounterProps =
  | {
      /** Default — used on the show detail page. Line 1 = last episode of the season. */
      variant?: "detail";
      seasonNumber: number;
      lastEpisode: number;
      watched: number;
      total: number;
    }
  | {
      /**
       * Compact grid chip — library "En cours" tab ("Actif"/"En pause"
       * subgroups, see library.tsx) AND, since Étage 2.2 of the Home
       * refonte, the Home's "Reprendre" rows (`ReadyListItem`, progression
       * saison en cours). Line 1 = season + NEXT unwatched episode
       * ("S02·E06"), not the last one of the season — deliberately a
       * different prop name (`nextEpisodeNumber`) so this semantic swap can't
       * be missed by a future reader of this component. The library's
       * caught-up ("à jour") chip is a distinct content shape (no episode
       * number, just a season + "À jour" label) and is NOT rendered through
       * this component — see `LibraryCard`'s local `CaughtUpChip`.
       */
      variant: "grid";
      seasonNumber: number;
      nextEpisodeNumber: number;
      watched: number;
      total: number;
      /**
       * "amber" (default) = active/en-cours card. "muted" = the library's
       * "En pause" subgroup — same S·E content and bar, dimmed instead of
       * highlighted, per the library's 3-tone design decision. Never
       * "cyan" here: cyan is reserved for the separate "à jour" chip shape.
       */
      tone?: GridTone;
      /**
       * `false`/omitted (default) — the library grid tile's ORIGINAL shape:
       * `S02·E06` only, no numeric fraction, the bar alone carries the
       * proportion. This is a deliberate, CLAUDE.md-documented exception
       * scoped to the grid vignette specifically ("le seul contexte où la
       * barre remplace la fraction chiffrée... à ne pas généraliser aux
       * autres surfaces") — `library.tsx` must NEVER pass `true` here.
       *
       * `true` — appends the numeric fraction after the S/E code
       * ("S02·E06 · 6/13"), for surfaces OUTSIDE the grid vignette that
       * still want this compact chip's overall footprint (muted, no glow,
       * subordinate to a hero) but need the actual number, not just a bar —
       * today, the Home's "Reprendre" rows (`ready-list-item.tsx`), where
       * the validated product intent is showing the current season's
       * numeric progress ("S06 · 6/13"), not just its proportion.
       */
      showFraction?: boolean;
    };
// NB: there used to be a third "hero" variant here (an enlarged pastille
// meant for the Home "Ce soir" ticket). It was removed as dead code — the
// hero ticket (`HeroTicket` in src/routes/_public/index.tsx) never actually
// consumed it; it has always hand-rolled its own markup, which now
// implements the same sober mono-line + bump animation independently (see
// that file's `HeroTicket` component for the equivalent tween logic).

export function VhsCounter(props: VhsCounterProps) {
  const { seasonNumber, watched, total } = props;
  const isGrid = props.variant === "grid";
  const lineOneEpisode = isGrid ? props.nextEpisodeNumber : props.lastEpisode;

  const reducedMotion = useReducedMotion();
  // `watched`/`total` are required numbers on both variants (no optional
  // "hero"-style pastille anymore, cf. NB above) — the fraction is always
  // shown, so no `enabled` gate is needed here.
  const { display, bump } = useRollingNumber(watched, { reducedMotion });

  const pad = (n: number) => n.toString().padStart(2, "0");

  // S/E line color — `text-primary` (amber) for the "detail" variant and the
  // grid's default/"amber" tone, never `text-cyan-accent`: amber =
  // action/CTA/"en cours" per the design system, cyan is reserved for
  // "vu"/success (and, in the grid, for the separate "à jour" chip shape —
  // never rendered through this component, see `GridTone`'s doc comment).
  // The S/E line always names the *next episode to watch*, not one already
  // watched, so amber is the semantically correct default here.
  if (isGrid) {
    const tone: GridTone = props.tone ?? "amber";
    const pct = total ? Math.min(100, (display / total) * 100) : 0;
    const lineOneClass = tone === "muted" ? "text-muted-foreground" : "text-primary";
    const barBaseClass = tone === "muted" ? "bg-muted-foreground/50" : "bg-primary";
    return (
      <div className="flex h-7 flex-col justify-center gap-1 rounded-md bg-surface-elevated px-2 py-1.5 font-counter text-[10px] uppercase tracking-wide leading-none">
        <span className={cn(lineOneClass, "whitespace-nowrap")}>
          S{pad(seasonNumber)}·E{pad(lineOneEpisode)}
          {/* Fraction chiffrée (non paddée, ex. "6/13") — uniquement quand
              `showFraction` est explicitement demandé (jamais par défaut,
              cf. exception CLAUDE.md sur la vignette de grille bibliothèque,
              qui doit rester "S02·E06" seul). `display` (pas `watched` brut)
              pour rester en phase avec l'animation de la barre juste
              en-dessous, qui suit déjà `display`. */}
          {props.showFraction && ` · ${display}/${total}`}
        </span>
        <div className="h-[2px] w-full overflow-hidden bg-muted-foreground/15">
          <div
            className={`h-full transition-[width,background-color] duration-200 ease-out motion-reduce:transition-none ${
              bump ? "bg-cyan-accent shadow-[0_0_4px_var(--cyan-accent)]" : barBaseClass
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  // Only "detail" (the default) reaches here.
  // `pct` tracks `display` (the animated value), not the raw `watched`
  // target, so the bar fills in lockstep with the rolling digits.
  const detailTotal = total as number;
  const pct = detailTotal ? Math.min(100, (display / detailTotal) * 100) : 0;
  const seasonLabel = pct === 100 ? "Saison bouclée" : "En cours";

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-surface-elevated px-3.5 py-3">
      {/* Pièce maîtresse de la fiche série (cf. CLAUDE.md, élément signature) :
          la fraction vue/total domine visuellement, cyan en permanence (pas
          seulement pendant le bump), avec un léger glow — jamais reléguée au
          rang de texte secondaire blanc. */}
      <span className="flex items-baseline gap-1 font-counter tabular-nums">
        <span
          className={cn(
            "text-[28px] leading-none tracking-tight text-cyan-accent transition-transform motion-reduce:transition-none",
            bump && "scale-110",
          )}
          style={{ textShadow: "0 0 14px rgba(77,217,196,0.35)" }}
        >
          {pad(display)}
        </span>
        <span className="text-lg leading-none text-muted-foreground">/{pad(detailTotal)}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block font-counter text-[9px] uppercase tracking-[0.2em] text-primary">
          S{pad(seasonNumber)} E{pad(lineOneEpisode)}
        </span>
        <span className="mt-1 block font-counter text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
          {seasonLabel}
        </span>
        <span className="mt-1.5 ml-auto block h-[3px] w-20 overflow-hidden rounded-full bg-white/[0.09]">
          <span
            className="block h-full rounded-full bg-cyan-accent transition-[width] duration-300 ease-out motion-reduce:transition-none"
            style={{ width: `${pct}%` }}
          />
        </span>
      </span>
    </div>
  );
}
