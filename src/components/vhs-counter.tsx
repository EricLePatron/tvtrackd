import { useEffect, useState } from "react";

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

  const [display, setDisplay] = useState(watched ?? 0);
  const [bump, setBump] = useState(false);

  useEffect(() => {
    if (watched === undefined) return;
    if (display === watched) return;
    setBump(true);
    const diff = watched - display;
    const steps = Math.min(Math.abs(diff), 6);
    const step = diff / (steps || 1);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setDisplay((d) => (i >= steps ? watched : Math.round(d + step)));
      if (i >= steps) {
        clearInterval(id);
        setTimeout(() => setBump(false), 200);
      }
    }, 40);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watched]);

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
            className={`h-full transition-[width,background-color] duration-200 ease-out ${
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
            className={`transition-transform ${bump ? "scale-110 text-cyan-accent" : "text-foreground"}`}
          >
            {pad(display)}/{pad(total ?? 0)}
          </span>
        )}
      </div>
    );
  }

  // Only "detail" (the default) reaches here — its type guarantees
  // `watched`/`total` are required numbers, unlike "hero"'s optional pair.
  const detailWatched = watched as number;
  const detailTotal = total as number;
  const pct = detailTotal ? Math.min(100, (detailWatched / detailTotal) * 100) : 0;

  return (
    <div className="rounded-md border border-border bg-surface-elevated px-3 py-2.5">
      <div className="flex items-center justify-between font-counter text-[11px] uppercase tracking-widest">
        <span className="text-primary">
          S{pad(seasonNumber)} E{pad(lineOneEpisode)}
        </span>
        <span
          className={`transition-transform ${bump ? "scale-110 text-cyan-accent" : "text-foreground"}`}
        >
          {pad(display)}/{pad(detailTotal)}
        </span>
      </div>
      <div className="mt-2 h-[2px] w-full overflow-hidden bg-muted-foreground/15">
        <div
          className="h-full bg-primary transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
