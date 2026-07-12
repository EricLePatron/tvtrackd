import { useEffect, useState } from "react";
import { Upload, AlertTriangle, Search as SearchIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { parseImportFile, FORMAT_LABELS, type ImportItem } from "@/lib/import-parsers";

const MAX_VISIBLE_WARNINGS = 5;
const SERIES_PER_BATCH = 12;

export type Unmatched = {
  key: string;
  title: string;
  year: number | null;
  occurrences: number;
};

// Doit répliquer exactement la clé de groupement `(title, year)` utilisée côté
// edge function (`import-history/index.ts`).
export function itemKey(item: ImportItem): string {
  return `${item.title.trim().toLowerCase()}|${item.year ?? ""}`;
}

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

export function ImportPanel({
  variant = "compact",
  onImported,
}: {
  variant?: "compact" | "guided";
  onImported?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [unmatched, setUnmatched] = useState<Unmatched[]>([]);
  const [pendingItems, setPendingItems] = useState<ImportItem[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, number>>({});
  const [detectedFormats, setDetectedFormats] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);

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
      await runImportInBatches(items, formats);
    } catch {
      toast.error(
        "Impossible de lire ce fichier — vérifiez qu'il s'agit bien d'un export TV Time ou Betaseries.",
      );
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function callBatch(
    items: ImportItem[],
    res: Record<string, number>,
    source?: string,
  ): Promise<{ imported: number; followed: number; unmatched: Unmatched[] } | null> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const { data, error } = await supabase.functions.invoke("import-history", {
        body: { items, resolutions: res, source: source ?? "" },
      });
      if (!error) {
        return data as { imported: number; followed: number; unmatched: Unmatched[] };
      }
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1500));
    }
    return null;
  }

  async function runImportInBatches(items: ImportItem[], formats: string[]) {
    const groups = groupItemsByShow(items);
    const batches = chunkGroups(groups, SERIES_PER_BATCH);
    setProgress({ done: 0, total: groups.length });
    setPendingItems(items);

    const source = formats[0] ?? "";
    const allUnmatched: Unmatched[] = [];
    let totalImported = 0;
    let totalFollowed = 0;
    let seriesDone = 0;
    let failedBatches = 0;

    for (const batch of batches) {
      const seriesInBatch = new Set(batch.map(itemKey)).size;
      const result = await callBatch(batch, {}, source);
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
      toast.success(`${totalImported} épisodes importés · ${totalFollowed} nouvelles séries`);
      onImported?.();
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
      onImported?.();
    }
    setResolutions({});
    setBusy(false);
  }

  const progressPct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.done / progress.total) * 100))
      : 0;

  const dropZoneBase =
    variant === "guided"
      ? "flex min-h-[140px] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-6 text-center text-sm transition-colors"
      : "flex h-11 w-full cursor-pointer items-center gap-2 rounded-md border border-border bg-surface-elevated px-4 text-sm text-foreground hover:bg-surface-elevated/70";
  const dropZoneState =
    variant === "guided"
      ? dragOver
        ? "border-primary bg-primary/5 text-foreground"
        : "border-border bg-surface-elevated/40 text-muted-foreground hover:border-primary/60 hover:text-foreground"
      : "";

  return (
    <>
      <label
        className={`${dropZoneBase} ${dropZoneState}`}
        onDragOver={(e) => {
          if (variant !== "guided") return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          if (variant !== "guided") return;
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f && !busy) handleFile(f);
        }}
      >
        <Upload className={variant === "guided" ? "h-6 w-6 text-primary" : "h-4 w-4"} />
        {variant === "guided" ? (
          <>
            <span className="font-display text-sm text-foreground">
              {busy
                ? progress
                  ? `Import en cours… ${progress.done}/${progress.total} séries`
                  : "Lecture du fichier…"
                : "Déposez votre fichier ici ou cliquez pour parcourir"}
            </span>
            <span className="text-[11px] text-muted-foreground">
              Export TV Time (.zip) · Betaseries (.csv) · JSON générique
            </span>
          </>
        ) : (
          <span>
            {busy
              ? progress
                ? `Import en cours… ${progress.done}/${progress.total} séries`
                : "Lecture du fichier…"
              : "Importer un export TV Time (.zip) ou Betaseries (.csv)"}
          </span>
        )}
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
          <p className="text-[11px] text-muted-foreground">
            Ces séries n'ont pas pu être identifiées automatiquement. Choisissez la bonne fiche
            pour chacune, puis relancez.
          </p>
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
