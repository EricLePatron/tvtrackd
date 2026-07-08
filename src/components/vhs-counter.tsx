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
    };

export function VhsCounter(props: VhsCounterProps) {
  const { seasonNumber, watched, total } = props;
  const isGrid = props.variant === "grid";
  const lineOneEpisode = isGrid ? props.nextEpisodeNumber : props.lastEpisode;

  const [display, setDisplay] = useState(watched);
  const [bump, setBump] = useState(false);

  useEffect(() => {
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

  if (isGrid) {
    return (
      <div className="flex flex-col gap-1 rounded-md bg-surface-elevated px-2 py-1.5 font-counter text-[10px] uppercase tracking-widest">
        <span className="text-primary">
          S{pad(seasonNumber)} E{pad(lineOneEpisode)}
        </span>
        <span
          className={`transition-transform ${bump ? "scale-110 text-cyan-accent" : "text-foreground"}`}
        >
          {pad(display)}/{pad(total)}
        </span>
      </div>
    );
  }

  const pct = total ? Math.min(100, (watched / total) * 100) : 0;

  return (
    <div className="rounded-md border border-border bg-surface-elevated px-3 py-2.5">
      <div className="flex items-center justify-between font-counter text-[11px] uppercase tracking-widest">
        <span className="text-primary">
          S{pad(seasonNumber)} E{pad(lineOneEpisode)}
        </span>
        <span
          className={`transition-transform ${bump ? "scale-110 text-cyan-accent" : "text-foreground"}`}
        >
          {pad(display)}/{pad(total)}
        </span>
      </div>
      <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-border">
        <div
          className="h-full bg-primary transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
