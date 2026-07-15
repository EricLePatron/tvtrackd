import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useRollingNumber } from "@/hooks/use-rolling-number";

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
       * Compact grid chip (library "En cours" tab). Line 1 = NEXT unwatched
       * episode, not the last one of the season — deliberately a different
       * prop name (`nextEpisodeNumber`) so this semantic swap can't be missed
       * by a future reader of this component.
       */
      variant: "grid";
      seasonNumber: number;
      nextEpisodeNumber: number;
      watched: number;
      total: number;
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

  // S/E line color — deliberately `text-primary` (amber) across both
  // variants, never `text-cyan-accent`. Amber = action/CTA/"en cours" per
  // the design system; cyan is reserved for "vu"/success. The S/E line
  // always names the *next episode to watch*, not one already watched, so
  // amber is the semantically correct choice here.
  if (isGrid) {
    const pct = total ? Math.min(100, (display / total) * 100) : 0;
    return (
      <div className="flex h-7 flex-col justify-center gap-1 rounded-md bg-surface-elevated px-2 py-1.5 font-counter text-[10px] uppercase tracking-wide leading-none">
        <span className="text-primary">E{pad(lineOneEpisode)}</span>
        <div className="h-[2px] w-full overflow-hidden bg-muted-foreground/15">
          <div
            className={`h-full transition-[width,background-color] duration-200 ease-out motion-reduce:transition-none ${
              bump ? "bg-cyan-accent shadow-[0_0_4px_var(--cyan-accent)]" : "bg-primary"
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
