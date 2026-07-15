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
    }
  | {
      /**
       * Enlarged pastille for the Home "Ce soir" hero ticket (real hero and
       * anonymous demo hero alike). Line 1 = next episode to watch, same
       * semantics as "grid". `watched`/`total` are deliberately optional: the
       * signed-in hero currently has no season-progress data fetched into
       * `ReadyItem`, so it renders a single line (SxxExx only). The
       * anonymous demo hero supplies fabricated `watched`/`total` to show
       * the full two-line fraction + bump animation — the app's signature
       * "compteur mécanique" — right on the first screen.
       */
      variant: "hero";
      seasonNumber: number;
      nextEpisodeNumber: number;
      watched?: number;
      total?: number;
    };

export function VhsCounter(props: VhsCounterProps) {
  const { seasonNumber, watched, total } = props;
  const isGrid = props.variant === "grid";
  const isHero = props.variant === "hero";
  const lineOneEpisode = isGrid || isHero ? props.nextEpisodeNumber : props.lastEpisode;
  const showFraction = watched !== undefined && total !== undefined;

  const reducedMotion = useReducedMotion();
  const { display, bump } = useRollingNumber(watched ?? 0, {
    enabled: showFraction,
    reducedMotion,
  });

  const pad = (n: number) => n.toString().padStart(2, "0");

  // S/E line color — deliberately `text-primary` (amber) across all three
  // variants, never `text-cyan-accent`. Amber = action/CTA/"en cours" per
  // the design system; cyan is reserved for "vu"/success. The S/E line
  // always names the *next episode to watch*, not one already watched, so
  // amber is the semantically correct choice here — including on the "hero"
  // variant, even though the hand-rolled pastille it replaced happened to
  // render this line in cyan. Do not "restore" cyan on this line thinking
  // it's a regression; it isn't.
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

  if (isHero) {
    return (
      <div className="flex items-center justify-between rounded-md bg-surface-elevated px-3 py-1.5 font-counter text-sm uppercase tracking-widest">
        {/* Amber, not cyan — see the note above this if/else chain. */}
        <span className="text-primary">
          S{pad(seasonNumber)} E{pad(lineOneEpisode)}
        </span>
        {showFraction && (
          <span
            className={`transition-transform motion-reduce:transition-none ${bump ? "scale-110 text-cyan-accent" : "text-foreground"}`}
          >
            {pad(display)}/{pad(total ?? 0)}
          </span>
        )}
      </div>
    );
  }

  // Only "detail" (the default) reaches here — its type guarantees
  // `watched`/`total` are required numbers, unlike "hero"'s optional pair.
  // `pct` tracks `display` (the animated value), not the raw `watched`
  // target, so the bar fills in lockstep with the rolling digits.
  const detailTotal = total as number;
  const pct = detailTotal ? Math.min(100, (display / detailTotal) * 100) : 0;
  const seasonLabel = pct === 100 ? "Saison bouclée" : "En cours";

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-white/[0.07] bg-surface-elevated px-3.5 py-3">
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
