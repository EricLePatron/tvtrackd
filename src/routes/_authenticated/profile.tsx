import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Upload, Search as SearchIcon, LogOut, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { parseImportFile, FORMAT_LABELS, type ImportItem } from "@/lib/import-parsers";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfileScreen,
});

const AVG_EPISODE_MIN = 42;
const MAX_VISIBLE_WARNINGS = 5;

type Unmatched = { key: string; title: string; year: number | null; occurrences: number };

// Doit répliquer exactement la clé de groupement `(title, year)` utilisée côté
// edge function (`import-history/index.ts`) pour pouvoir isoler les items d'un
// groupe précis lors d'une résolution manuelle.
function itemKey(item: ImportItem): string {
  return `${item.title.trim().toLowerCase()}|${item.year ?? ""}`;
}

function ProfileScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    supabase
      .from("profiles")
      .select("username")
      .maybeSingle()
      .then(({ data }) => data && setUsername(data.username));
  }, []);

  const { data: stats } = useQuery({
    queryKey: ["profile-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [watchRes, showsRes] = await Promise.all([
        supabase.from("watch_status").select("watch_count").eq("user_id", user!.id),
        supabase.from("user_shows").select("status").eq("user_id", user!.id),
      ]);
      const episodesWatched = (watchRes.data ?? []).reduce(
        (sum, r) => sum + (r.watch_count ?? 1),
        0,
      );
      const inProgress = (showsRes.data ?? []).filter((s) => s.status === "en_cours").length;
      const minutes = episodesWatched * AVG_EPISODE_MIN;
      return {
        episodesWatched,
        inProgress,
        hours: Math.round(minutes / 60),
        days: Math.floor(minutes / (60 * 24)),
      };
    },
  });

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  async function handleExport() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    toast.loading("Préparation de l'export…", { id: "exp" });
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-data`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) {
      toast.error("Export impossible", { id: "exp" });
      return;
    }
    const blob = await res.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `tvtrackd-export-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success("Export téléchargé", { id: "exp" });
  }

  return (
    <>
      <ScreenHeader eyebrow="Compte" title="Profil" />
      <div className="mx-5 space-y-4 pb-24">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-surface-elevated">
              <span className="font-display text-lg text-primary">
                {(username ?? email ?? "?").slice(0, 1).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg text-foreground truncate">{username ?? "—"}</p>
              <p className="text-xs text-muted-foreground truncate">{email ?? "…"}</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Épisodes" value={stats?.episodesWatched ?? 0} />
          <StatCard
            label="Heures"
            value={stats?.hours ?? 0}
            suffix={stats && stats.days > 0 ? `${stats.days}j` : undefined}
          />
          <StatCard label="En cours" value={stats?.inProgress ?? 0} />
        </div>

        {/* Import / Export */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-display text-sm uppercase tracking-widest text-foreground">
            Historique
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Récupérez votre historique TV Time (.zip) ou Betaseries (.csv). Export JSON à tout moment.
          </p>
          <div className="mt-4 space-y-2">
            <ImportPanel />
            <Button
              onClick={handleExport}
              variant="outline"
              className="w-full h-11 justify-start gap-2 border-border bg-surface-elevated text-foreground hover:bg-surface-elevated/70"
            >
              <Download className="h-4 w-4" />
              Exporter mes données (JSON)
            </Button>
          </div>
        </div>

        <Button
          onClick={signOut}
          variant="outline"
          className="w-full h-11 gap-2 border-border bg-card text-foreground hover:bg-surface-elevated"
        >
          <LogOut className="h-4 w-4" /> Se déconnecter
        </Button>
      </div>
    </>
  );
}

function StatCard({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="font-counter text-2xl text-foreground tabular-nums">
        {value.toString().padStart(2, "0")}
      </p>
      {suffix && <p className="font-counter text-[10px] text-secondary">≈ {suffix}</p>}
      <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}

// ------- Import -------

// Nombre de séries uniques envoyées par appel à l'edge function. Choisi pour
// tenir sous le timeout ~150s : chaque série peut nécessiter un `searchTv` +
// `cacheShow` (toutes ses saisons TMDb en parallèle) + N inserts watch_status.
const SERIES_PER_BATCH = 12;

function groupItemsByShow(items: ImportItem[]): ImportItem[][] {
  const groups = new Map<string, ImportItem[]>();
  for (const it of items) {
    const key = itemKey(it);
    const arr = groups.get(key) ?? [];
    arr.push(it);
    groups.set(key, arr);
  }
  return [...groups.values()];
}

function chunkGroups(groups: ImportItem[][], perBatch: number): ImportItem[][] {
  const batches: ImportItem[][] = [];
  for (let i = 0; i < groups.length; i += perBatch) {
    batches.push(groups.slice(i, i + perBatch).flat());
  }
  return batches;
}

function ImportPanel() {
  const [busy, setBusy] = useState(false);
  const [unmatched, setUnmatched] = useState<Unmatched[]>([]);
  const [pendingItems, setPendingItems] = useState<ImportItem[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, number>>({});
  const [detectedFormats, setDetectedFormats] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setDetectedFormats([]);
    setWarnings([]);
    setUnmatched([]);
    setResolutions({});
    setProgress(null);
    try {
      const {
        items,
        detectedFormats: formats,
        warnings: parseWarnings,
      } = await parseImportFile(file);
      setDetectedFormats(formats.map((f) => FORMAT_LABELS[f]));
      setWarnings(parseWarnings);
      if (!items.length) {
        toast.error("Aucune ligne exploitable détectée dans le fichier");
        return;
      }
      await runImportInBatches(items);
    } catch {
      toast.error(
        "Impossible de lire ce fichier — vérifiez qu'il s'agit bien d'un export TV Time ou Betaseries.",
      );
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  // Envoie un batch (max SERIES_PER_BATCH séries uniques) à l'edge function
  // avec 1 retry en cas d'erreur réseau/timeout. Retourne null seulement si
  // l'appel a vraiment échoué (deux fois) — dans ce cas on continue avec les
  // batches suivants pour ne pas tout perdre.
  async function callBatch(
    items: ImportItem[],
    res: Record<string, number>,
  ): Promise<{ imported: number; followed: number; unmatched: Unmatched[] } | null> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const { data, error } = await supabase.functions.invoke("import-history", {
        body: { items, resolutions: res },
      });
      if (!error) {
        return data as { imported: number; followed: number; unmatched: Unmatched[] };
      }
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1500));
    }
    return null;
  }

  async function runImportInBatches(items: ImportItem[]) {
    const groups = groupItemsByShow(items);
    const batches = chunkGroups(groups, SERIES_PER_BATCH);
    setProgress({ done: 0, total: groups.length });
    setPendingItems(items);

    const allUnmatched: Unmatched[] = [];
    let totalImported = 0;
    let totalFollowed = 0;
    let seriesDone = 0;
    let failedBatches = 0;

    for (const batch of batches) {
      const seriesInBatch = new Set(batch.map(itemKey)).size;
      const result = await callBatch(batch, {});
      if (result) {
        totalImported += result.imported;
        totalFollowed += result.followed;
        if (result.unmatched?.length) allUnmatched.push(...result.unmatched);
      } else {
        failedBatches += 1;
      }
      seriesDone += seriesInBatch;
      setProgress({ done: seriesDone, total: groups.length });
    }

    setUnmatched(allUnmatched);
    if (totalImported || totalFollowed) {
      toast.success(
        `${totalImported} épisodes importés · ${totalFollowed} nouvelles séries`,
      );
    }
    if (failedBatches > 0) {
      toast.error(
        `${failedBatches} lot(s) n'ont pas pu être traités — réessayez ou recommencez l'import.`,
      );
    }
    if (!totalImported && !totalFollowed && !failedBatches && !allUnmatched.length) {
      toast("Rien de nouveau à importer");
    }
  }

  // Ne renvoie que les groupes que l'utilisateur vient de résoudre manuellement,
  // pas tout `pendingItems` : les séries déjà importées avec succès dans le même
  // lot ne doivent pas être retraitées à chaque clic sur "Relancer l'import".
  async function resolveAndRetry() {
    const keysToRetry = new Set(Object.keys(resolutions));
    if (!keysToRetry.size) return;
    setBusy(true);
    const itemsToRetry = pendingItems.filter((it) => keysToRetry.has(itemKey(it)));
    const result = await callBatch(itemsToRetry, resolutions);
    if (!result) {
      toast.error("Échec de la relance — réessayez.");
    } else {
      toast.success(`${result.imported} épisodes importés · ${result.followed} nouvelles séries`);
      setUnmatched((prev) => [
        ...prev.filter((u) => !keysToRetry.has(u.key)),
        ...(result.unmatched ?? []),
      ]);
    }
    setResolutions({});
    setBusy(false);
  }

  const progressPct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.done / progress.total) * 100))
      : 0;

  return (
    <>
      <label className="flex h-11 w-full cursor-pointer items-center gap-2 rounded-md border border-border bg-surface-elevated px-4 text-sm text-foreground hover:bg-surface-elevated/70">
        <Upload className="h-4 w-4" />
        {busy
          ? progress
            ? `Import en cours… ${progress.done}/${progress.total} séries`
            : "Lecture du fichier…"
          : "Importer un export TV Time (.zip) ou Betaseries (.csv)"}
        <input
          type="file"
          accept=".csv,.json,.zip,text/csv,application/json,application/zip"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
          className="hidden"
        />
      </label>

      {busy && progress && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {detectedFormats.length > 0 && (
        <div className="mt-3 rounded-md border border-border bg-surface-elevated/50 p-3 text-xs">
          <p className="text-foreground">Format détecté : {detectedFormats.join(", ")}</p>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="mt-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
          <div className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />À savoir sur cet import
          </div>
          <div className="mt-1.5 max-h-40 space-y-1 overflow-y-auto">
            {warnings.slice(0, MAX_VISIBLE_WARNINGS).map((w, i) => (
              <p key={i}>{w}</p>
            ))}
            {warnings.length > MAX_VISIBLE_WARNINGS && (
              <p className="font-medium">et {warnings.length - MAX_VISIBLE_WARNINGS} autre(s)…</p>
            )}
          </div>
        </div>
      )}

      {unmatched.length > 0 && (
        <div className="mt-4 space-y-3 rounded-md border border-dashed border-border p-3">
          <div className="flex items-baseline justify-between">
            <p className="font-counter text-[11px] uppercase tracking-widest text-primary">
              À résoudre · {unmatched.length}
            </p>
            <button
              onClick={resolveAndRetry}
              disabled={busy || Object.keys(resolutions).length === 0}
              className="text-[11px] font-medium text-secondary disabled:opacity-40"
            >
              Relancer l'import
            </button>
          </div>
          {unmatched.map((u) => (
            <ResolutionRow
              key={u.key}
              item={u}
              onPick={(id) => setResolutions((r) => ({ ...r, [u.key]: id }))}
              chosen={resolutions[u.key]}
            />
          ))}
        </div>
      )}
    </>
  );
}

function ResolutionRow({
  item,
  onPick,
  chosen,
}: {
  item: Unmatched;
  onPick: (tmdbId: number) => void;
  chosen?: number;
}) {
  const [q, setQ] = useState(item.title);
  const [debounced, setDebounced] = useState(item.title);
  const [results, setResults] = useState<
    { tmdb_id: number; title: string; year: number | null; poster_url: string | null }[]
  >([]);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    if (debounced.length < 2) return;
    supabase.functions
      .invoke("search-media", { body: { q: debounced } })
      .then(({ data }) =>
        setResults(
          ((data as any)?.results ?? []).filter((r: any) => r.media_type === "tv").slice(0, 6),
        ),
      );
  }, [debounced]);

  return (
    <div className="rounded-md bg-surface-elevated/50 p-2">
      <p className="text-xs text-foreground">
        {item.title}
        {item.year ? ` (${item.year})` : ""}
        <span className="ml-2 font-counter text-[10px] text-muted-foreground">
          ×{item.occurrences}
        </span>
      </p>
      <div className="mt-2 flex items-center gap-2 rounded border border-border bg-card px-2 py-1.5">
        <SearchIcon className="h-3 w-3 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 bg-transparent text-xs text-foreground outline-none"
        />
      </div>
      {results.length > 0 && (
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {results.map((r) => (
            <button
              key={r.tmdb_id}
              onClick={() => onPick(r.tmdb_id)}
              className={`w-20 shrink-0 text-left ${
                chosen === r.tmdb_id ? "ring-2 ring-primary rounded" : ""
              }`}
            >
              <div className="aspect-[2/3] overflow-hidden rounded border border-border bg-surface-elevated">
                {r.poster_url && (
                  <img src={r.poster_url} alt={r.title} className="h-full w-full object-cover" />
                )}
              </div>
              <p className="mt-1 line-clamp-2 text-[10px] text-foreground">{r.title}</p>
              <p className="font-counter text-[9px] text-muted-foreground">{r.year ?? "—"}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
