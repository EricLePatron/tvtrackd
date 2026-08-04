import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { estimateWatchMinutes } from "@/lib/watch-time";

/**
 * Section « Statistiques » dédiée du profil. Toutes les durées restent des
 * estimations (cf. `watch-time.ts`) et sont préfixées « ≈ ». Les dates
 * approximatives issues d'un import (`watched_at_approximate`) sont exclues
 * des séries temporelles pour ne pas inventer une activité récente.
 */

const PAGE = 1000;

type WatchRow = {
  watch_count: number;
  watched_at: string;
  watched_at_approximate: boolean;
  episodes: { show_id: number } | null;
};

type ShowRow = {
  status: string;
  show_id: number;
  shows: { title: string; genres: string[]; poster_path: string | null } | null;
};

async function fetchAllWatch(userId: string) {
  const rows: WatchRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("watch_status")
      .select("watch_count, watched_at, watched_at_approximate, episodes(show_id)")
      .eq("user_id", userId)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as WatchRow[]));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export function useProfileStats(userId?: string) {
  return useQuery({
    queryKey: ["profile-stats-detailed", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [watch, showsRes, ratingsRes] = await Promise.all([
        fetchAllWatch(userId!),
        supabase
          .from("user_shows")
          .select("status, show_id, shows(title, genres, poster_path)")
          .eq("user_id", userId!),
        supabase.from("show_ratings").select("rating").eq("user_id", userId!),
      ]);

      const userShows = (showsRes.data ?? []) as unknown as ShowRow[];
      const ratings = (ratingsRes.data ?? []).map((r) => r.rating as number);

      const episodesWatched = watch.reduce((s, r) => s + (r.watch_count ?? 1), 0);
      const rewatched = watch.reduce((s, r) => s + Math.max(0, (r.watch_count ?? 1) - 1), 0);
      const minutes = estimateWatchMinutes(episodesWatched);

      const byStatus = userShows.reduce<Record<string, number>>((acc, s) => {
        acc[s.status] = (acc[s.status] ?? 0) + 1;
        return acc;
      }, {});

      // Épisodes vus par série (pour le top séries)
      const perShow = new Map<number, number>();
      for (const r of watch) {
        const id = r.episodes?.show_id;
        if (!id) continue;
        perShow.set(id, (perShow.get(id) ?? 0) + (r.watch_count ?? 1));
      }
      const showMeta = new Map(userShows.map((s) => [s.show_id, s.shows]));
      const topShows = [...perShow.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, count]) => ({
          id,
          count,
          title: showMeta.get(id)?.title ?? "Série",
          poster: showMeta.get(id)?.poster_path ?? null,
        }))
        .filter((s) => showMeta.has(s.id));

      // Genres pondérés par épisodes vus, fallback sur les séries suivies
      const genreCount = new Map<string, number>();
      for (const s of userShows) {
        const weight = perShow.get(s.show_id) ?? 0;
        for (const g of s.shows?.genres ?? []) {
          genreCount.set(g, (genreCount.get(g) ?? 0) + (weight || 1));
        }
      }
      const topGenres = [...genreCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
      const genreMax = topGenres[0]?.[1] ?? 1;

      // Activité : 12 dernières semaines (dates fiables uniquement)
      const weeks: { label: string; count: number }[] = [];
      const thisWeek = startOfWeek(new Date());
      for (let i = 11; i >= 0; i--) {
        const start = new Date(thisWeek);
        start.setDate(start.getDate() - i * 7);
        weeks.push({
          label: start.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
          count: 0,
        });
      }
      const firstWeek = new Date(thisWeek);
      firstWeek.setDate(firstWeek.getDate() - 11 * 7);
      let last7 = 0;
      let last30 = 0;
      const now = Date.now();
      for (const r of watch) {
        if (r.watched_at_approximate) continue;
        const t = new Date(r.watched_at);
        const days = (now - t.getTime()) / 86400000;
        if (days <= 7) last7 += r.watch_count ?? 1;
        if (days <= 30) last30 += r.watch_count ?? 1;
        if (t >= firstWeek) {
          const idx = Math.floor((startOfWeek(t).getTime() - firstWeek.getTime()) / (7 * 86400000));
          if (idx >= 0 && idx < 12) weeks[idx].count += r.watch_count ?? 1;
        }
      }

      return {
        episodesWatched,
        rewatched,
        hours: Math.round(minutes / 60),
        days: Math.floor(minutes / (60 * 24)),
        totalShows: userShows.length,
        byStatus,
        topShows,
        topGenres,
        genreMax,
        weeks,
        last7,
        last30,
        ratingsCount: ratings.length,
        ratingAvg: ratings.length
          ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
          : null,
      };
    },
  });
}

type Stats = NonNullable<ReturnType<typeof useProfileStats>["data"]>;

export function ProfileStatsSection({ userId }: { userId?: string }) {
  const { data: stats, isLoading } = useProfileStats(userId);

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-display text-sm uppercase tracking-widest text-foreground">
          Statistiques
        </h2>
      </div>

      {isLoading || !stats ? (
        <p className="mt-4 text-xs text-muted-foreground">Calcul en cours…</p>
      ) : (
        <div className="mt-4 space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Épisodes vus" value={stats.episodesWatched} />
            <Stat
              label="Temps de visionnage"
              value={stats.hours}
              unit="h"
              hint={stats.days > 0 ? `≈ ${stats.days} j` : undefined}
            />
            <Stat label="Séries suivies" value={stats.totalShows} />
            <Stat label="Revisionnages" value={stats.rewatched} />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="7 derniers jours" value={stats.last7} accent />
            <Stat label="30 derniers jours" value={stats.last30} accent />
            <Stat
              label="Note moyenne"
              value={stats.ratingAvg ?? 0}
              unit={stats.ratingAvg !== null ? "/5" : undefined}
              hint={stats.ratingsCount > 0 ? `${stats.ratingsCount} notées` : "aucune note"}
              accent
            />
            <Stat label="Terminées" value={stats.byStatus["termine"] ?? 0} accent />
          </div>

          <StatusBreakdown stats={stats} />
          <WeeklyActivity stats={stats} />
          <TopShows stats={stats} />
          <TopGenres stats={stats} />

          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Les durées sont des estimations (≈ 42 min/épisode). L'activité hebdomadaire exclut les
            visionnages dont la date provient d'un import approximatif.
          </p>
        </div>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  unit,
  hint,
  accent,
}: {
  label: string;
  value: number;
  unit?: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg bg-surface-elevated/60 p-3">
      <p
        className={`font-counter text-2xl tabular-nums ${accent ? "text-secondary" : "text-foreground"}`}
      >
        {value.toLocaleString("fr-FR")}
        {unit && <span className="text-sm text-muted-foreground"> {unit}</span>}
      </p>
      {hint && <p className="font-counter text-[10px] text-muted-foreground">{hint}</p>}
      <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  a_voir: "À voir",
  en_cours: "En cours",
  termine: "Terminées",
  abandonne: "Abandonnées",
  archive: "Archivées",
};

function StatusBreakdown({ stats }: { stats: Stats }) {
  const entries = Object.keys(STATUS_LABELS)
    .map((k) => [k, stats.byStatus[k] ?? 0] as const)
    .filter(([, n]) => n > 0);
  if (!entries.length) return null;
  const total = entries.reduce((s, [, n]) => s + n, 0);

  return (
    <div>
      <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground">
        Répartition de la bibliothèque
      </h3>
      <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-surface-elevated">
        {entries.map(([k, n], i) => (
          <div
            key={k}
            className={i % 2 === 0 ? "bg-primary" : "bg-secondary"}
            style={{ width: `${(n / total) * 100}%`, opacity: 1 - i * 0.12 }}
          />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
        {entries.map(([k, n]) => (
          <li key={k} className="flex items-baseline justify-between text-xs text-muted-foreground">
            <span>{STATUS_LABELS[k]}</span>
            <span className="font-counter tabular-nums text-foreground">{n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WeeklyActivity({ stats }: { stats: Stats }) {
  const max = Math.max(1, ...stats.weeks.map((w) => w.count));
  if (!stats.weeks.some((w) => w.count > 0)) return null;

  return (
    <div>
      <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground">
        Activité — 12 dernières semaines
      </h3>
      <div className="mt-3 flex h-24 items-end gap-1.5">
        {stats.weeks.map((w) => (
          <div key={w.label} className="flex flex-1 flex-col items-center gap-1">
            <div
              title={`${w.count} épisode(s) — semaine du ${w.label}`}
              className="w-full rounded-sm bg-primary/80"
              style={{ height: `${Math.max(3, (w.count / max) * 100)}%` }}
            />
            <span className="font-counter text-[8px] text-muted-foreground">{w.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopShows({ stats }: { stats: Stats }) {
  if (!stats.topShows.length) return null;
  const max = stats.topShows[0].count;

  return (
    <div>
      <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground">
        Top séries — épisodes vus
      </h3>
      <ul className="mt-3 space-y-2">
        {stats.topShows.map((s) => (
          <li key={s.id} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-xs text-foreground">{s.title}</span>
                <span className="font-counter text-xs tabular-nums text-secondary">{s.count}</span>
              </div>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-surface-elevated">
                <div className="h-full bg-primary" style={{ width: `${(s.count / max) * 100}%` }} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TopGenres({ stats }: { stats: Stats }) {
  if (!stats.topGenres.length) return null;
  return (
    <div>
      <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground">
        Genres favoris
      </h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {stats.topGenres.map(([genre, weight]) => (
          <span
            key={genre}
            className="rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs text-foreground"
            style={{ opacity: 0.55 + 0.45 * (weight / stats.genreMax) }}
          >
            {genre}
          </span>
        ))}
      </div>
    </div>
  );
}
