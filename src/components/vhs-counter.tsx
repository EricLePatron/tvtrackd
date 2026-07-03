import { useEffect, useState } from "react";

export function VhsCounter({
  seasonNumber,
  lastEpisode,
  watched,
  total,
}: {
  seasonNumber: number;
  lastEpisode: number;
  watched: number;
  total: number;
}) {
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

  const pct = total ? Math.min(100, (watched / total) * 100) : 0;
  const pad = (n: number) => n.toString().padStart(2, "0");

  return (
    <div className="rounded-md border border-border bg-surface-elevated px-3 py-2.5">
      <div className="flex items-center justify-between font-counter text-[11px] uppercase tracking-widest">
        <span className="text-primary">
          S{pad(seasonNumber)} E{pad(lastEpisode)}
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
