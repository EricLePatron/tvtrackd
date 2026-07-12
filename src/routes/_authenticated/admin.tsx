import { createFileRoute } from "@tanstack/react-router";
import { getAdminMetrics, type AdminMetrics } from "@/lib/admin-metrics.functions";
import type { TopShow } from "@/lib/admin-metrics-aggregation";
import { ScreenHeader } from "@/components/screen-header";

// ─── Route ──────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/_authenticated/admin")({
  loader: async () => {
    try {
      const metrics = await getAdminMetrics();
      return { metrics, forbidden: false };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Forbidden")) return { metrics: null, forbidden: true };
      throw err;
    }
  },
  component: AdminDashboard,
  errorComponent: AdminError,
  notFoundComponent: AdminNotFound,
});

// ─── Error / Not-found guards ────────────────────────────────────────────────

function AdminError() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-mono text-sm text-red-400">
        Erreur inattendue lors du chargement du dashboard.
      </p>
    </div>
  );
}

function AdminNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-heading text-xl font-bold tracking-tight text-white">Page introuvable</p>
    </div>
  );
}

// ─── Access Denied ───────────────────────────────────────────────────────────

function AccessDenied() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-heading text-2xl font-extrabold tracking-tight text-white uppercase">
        Accès refusé
      </p>
      <p className="font-body text-sm text-white/50">
        Vous n'avez pas les droits d'accès à ce tableau de bord.
      </p>
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: number | string;
  /** Cards mirroring import "noise" rather than real user activity — visually de-emphasized. */
  muted?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col gap-1">
      <span className="font-body text-xs text-white/50 uppercase tracking-widest">{label}</span>
      <span
        className={`font-mono text-2xl font-bold leading-none ${muted ? "text-white/40" : "text-white"}`}
      >
        {typeof value === "number" ? value.toLocaleString("fr-FR") : value}
      </span>
    </div>
  );
}

// ─── Format helpers ──────────────────────────────────────────────────────────

function formatPercent(value: number): string {
  return value.toLocaleString("fr-FR", { style: "percent", maximumFractionDigits: 1 });
}

function formatAvg(value: number): string {
  return value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
}

// ─── Sparkline ───────────────────────────────────────────────────────────────

function Sparkline({
  data,
  markerIndex,
  markerLabel,
}: {
  data: { count: number }[];
  /** Index within `data` to draw a vertical marker line at (e.g. TV Time closure date). */
  markerIndex?: number | null;
  markerLabel?: string;
}) {
  if (!data.length) return null;
  const W = 100;
  const H = 40;
  const max = Math.max(...data.map((d) => d.count), 1);
  const pts = data.map((d, i) => {
    const x = data.length > 1 ? (i / (data.length - 1)) * W : W / 2;
    const y = H - (d.count / max) * (H - 4) - 2;
    return `${x},${y}`;
  });
  const polyline = pts.join(" ");
  const area = `0,${H} ` + polyline + ` ${W},${H}`;
  const markerX =
    markerIndex != null && markerIndex >= 0 && data.length > 1
      ? (markerIndex / (data.length - 1)) * W
      : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-full" aria-hidden>
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#sg)" />
      <polyline
        points={polyline}
        fill="none"
        stroke="#a78bfa"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {markerX != null && (
        <g className="text-primary">
          <line
            x1={markerX}
            y1={0}
            x2={markerX}
            y2={H}
            stroke="currentColor"
            strokeWidth="0.75"
            strokeDasharray="2,1.5"
            vectorEffect="non-scaling-stroke"
          />
          {markerLabel && (
            <text
              x={markerX}
              y={7}
              fontSize="6"
              textAnchor={markerX > W - 12 ? "end" : "start"}
              fill="currentColor"
              className="font-mono"
            >
              {markerLabel}
            </text>
          )}
        </g>
      )}
    </svg>
  );
}

// ─── Top shows block ─────────────────────────────────────────────────────────

function TopShowsBlock({ title, shows }: { title: string; shows: TopShow[] }) {
  return (
    <div>
      <h3 className="font-body text-xs text-white/40 uppercase tracking-widest mb-2">{title}</h3>
      <div className="rounded-xl border border-white/10 bg-white/5 divide-y divide-white/5 overflow-hidden">
        {shows.length === 0 ? (
          <p className="px-4 py-3 font-body text-sm text-white/40">Aucune donnée</p>
        ) : (
          shows.map((show, i) => (
            <div key={show.title} className="flex items-center gap-4 px-4 py-3">
              <span className="font-mono text-xs text-white/30 w-5 shrink-0">{i + 1}</span>
              <span className="font-body text-sm text-white flex-1 truncate">{show.title}</span>
              <span className="font-mono text-sm text-violet-400 shrink-0">
                {show.followers.toLocaleString("fr-FR")}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

function AdminDashboard() {
  const { metrics, forbidden } = Route.useLoaderData();

  if (forbidden || !metrics) return <AccessDenied />;

  const m = metrics as AdminMetrics;

  return (
    <div className="max-w-2xl mx-auto px-4 pb-12 space-y-8">
      <ScreenHeader eyebrow="tvtrackd" title="Dashboard Admin" />

      {/* KPI grid — activité réelle uniquement (watched_at_approximate = false) */}
      <section>
        <h2 className="font-body text-xs text-white/40 uppercase tracking-widest mb-3">
          Indicateurs clés
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <KpiCard label="Inscrits" value={m.totalUsers} />
          <KpiCard label="DAU" value={m.dau} />
          <KpiCard label="WAU" value={m.wau} />
          <KpiCard label="MAU" value={m.mau} />
          <KpiCard label="Épisodes 7j" value={m.episodesWatchedLast7d} />
          <KpiCard label="Épisodes total" value={m.episodesWatchedTotal} />
          <KpiCard label="Séries — à voir" value={m.activeShowsAVoir} />
          <KpiCard label="Séries — en cours" value={m.activeShowsEnCours} />
          <KpiCard label="Runs d'import (14j)" value={m.importStats.totalRuns} />
        </div>
      </section>

      {/* Miroir "activité d'import" — mêmes fenêtres, watched_at_approximate = true.
          Un pic ici signale un import de masse, pas de l'engagement réel :
          gardé visuellement en retrait (muted) et jamais mélangé aux cards ci-dessus. */}
      <section>
        <h2 className="font-body text-xs text-white/40 uppercase tracking-widest mb-3">
          Activité d'import (bruit — à ne pas lire comme de l'engagement)
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <KpiCard label="Importeurs 24h" value={m.dauImports} muted />
          <KpiCard label="Importeurs 7j" value={m.wauImports} muted />
          <KpiCard label="Importeurs 30j" value={m.mauImports} muted />
          <KpiCard label="Ép. importés 7j" value={m.episodesImportedLast7d} muted />
          <KpiCard label="Ép. importés total" value={m.episodesImportedTotal} muted />
        </div>
      </section>

      {/* Sparkline inscriptions — 30 derniers jours */}
      <section>
        <h2 className="font-body text-xs text-white/40 uppercase tracking-widest mb-3">
          Inscriptions — 30 derniers jours
        </h2>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="h-20 w-full">
            <Sparkline data={m.signupsSeries} />
          </div>
          <div className="mt-2 flex justify-between font-mono text-[10px] text-white/30">
            <span>{m.signupsSeries[0]?.date?.slice(5)}</span>
            <span>{m.signupsSeries[m.signupsSeries.length - 1]?.date?.slice(5)}</span>
          </div>
        </div>
      </section>

      {/* Sparkline inscriptions — vue horaire, semaine de bascule TV Time */}
      <section>
        <h2 className="font-body text-xs text-white/40 uppercase tracking-widest mb-3">
          Inscriptions — semaine de bascule (heure par heure)
        </h2>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="h-20 w-full">
            <Sparkline
              data={m.signupsSeriesHourly}
              markerIndex={m.signupsHourlyMarkerIndex}
              markerLabel="15/07"
            />
          </div>
          <div className="mt-2 flex justify-between font-mono text-[10px] text-muted-foreground">
            <span>{m.signupsSeriesHourly[0]?.hourIso?.slice(0, 10)}</span>
            <span>
              {m.signupsSeriesHourly[m.signupsSeriesHourly.length - 1]?.hourIso?.slice(0, 10)}
            </span>
          </div>
        </div>
      </section>

      {/* Imports */}
      <section>
        <h2 className="font-body text-xs text-white/40 uppercase tracking-widest mb-3">
          Imports — 14 derniers jours
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-3">
          <KpiCard label="Taux d'échec" value={formatPercent(m.importStats.failureRate)} />
          <KpiCard
            label="Moy. épisodes importés"
            value={formatAvg(m.importStats.avgImportedEpisodes)}
          />
          <KpiCard label="Moy. séries suivies" value={formatAvg(m.importStats.avgFollowedShows)} />
          <KpiCard
            label="Taux de matching TMDb"
            value={m.importStats.matchRate == null ? "—" : formatPercent(m.importStats.matchRate)}
          />
        </div>
        {m.importStats.matchRate != null && (
          <p className="font-body text-xs text-muted-foreground mb-3">
            Calculé sur{" "}
            <span className="font-mono text-foreground">{m.importStats.runsWithMatchData}</span> /{" "}
            <span className="font-mono text-foreground">{m.importStats.totalRuns}</span> runs
            (colonne <span className="font-mono">total_groups</span> absente sur les runs plus
            anciens, non calculable rétroactivement).
          </p>
        )}
        <div className="rounded-xl border border-border bg-surface divide-y divide-white/5 overflow-hidden">
          {m.importStats.bySourceDay.length === 0 ? (
            <p className="px-4 py-3 font-body text-sm text-muted-foreground">Aucun import récent</p>
          ) : (
            [...m.importStats.bySourceDay].reverse().map((row) => (
              <div key={`${row.date}|${row.source}`} className="flex items-center gap-4 px-4 py-3">
                <span className="font-mono text-xs text-muted-foreground w-20 shrink-0">
                  {row.date.slice(5)}
                </span>
                <span className="font-body text-sm text-foreground flex-1 truncate capitalize">
                  {row.source}
                </span>
                <span className="font-mono text-sm text-cyan-accent shrink-0">
                  {row.runs.toLocaleString("fr-FR")}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Top 10 séries, scindé par statut */}
      <section className="space-y-4">
        <h2 className="font-body text-xs text-white/40 uppercase tracking-widest">
          Top 10 séries suivies
        </h2>
        <TopShowsBlock title="En cours" shows={m.topShowsEnCours} />
        <TopShowsBlock title="À voir" shows={m.topShowsAVoir} />
      </section>
    </div>
  );
}
