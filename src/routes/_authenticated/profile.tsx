import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Upload, Search as SearchIcon, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfileScreen,
});

const AVG_EPISODE_MIN = 42;

type ImportItem = {
  title: string;
  year?: number | null;
  season?: number | null;
  episode?: number | null;
  watched_at?: string | null;
};

type Unmatched = { key: string; title: string; year: number | null; occurrences: number };

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
    link.download = `nightframe-export-${Date.now()}.json`;
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
              <p className="font-display text-lg text-foreground truncate">
                {username ?? "—"}
              </p>
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
            Importez depuis TV Time ou Betaseries. Exportez à tout moment.
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

function StatCard({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="font-counter text-2xl text-foreground tabular-nums">
        {value.toString().padStart(2, "0")}
      </p>
      {suffix && (
        <p className="font-counter text-[10px] text-secondary">≈ {suffix}</p>
      )}
      <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

// ------- Import -------

function ImportPanel() {
  const [busy, setBusy] = useState(false);
  const [unmatched, setUnmatched] = useState<Unmatched[]>([]);
  const [pendingItems, setPendingItems] = useState<ImportItem[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, number>>({});

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const text = await file.text();
      const items = file.name.endsWith(".json") ? parseJSON(text) : parseCSV(text);
      if (!items.length) {
        toast.error("Aucune ligne détectée dans le fichier");
        return;
      }
      await runImport(items, {});
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runImport(items: ImportItem[], res: Record<string, number>) {
    const { data, error } = await supabase.functions.invoke("import-history", {
      body: { items, resolutions: res },
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    const result = data as { imported: number; followed: number; unmatched: Unmatched[] };
    toast.success(
      `${result.imported} épisodes importés · ${result.followed} nouvelles séries`,
    );
    setPendingItems(items);
    setUnmatched(result.unmatched ?? []);
  }

  async function resolveAndRetry() {
    setBusy(true);
    await runImport(pendingItems, resolutions);
    setResolutions({});
    setBusy(false);
  }

  return (
    <>
      <label className="flex h-11 w-full cursor-pointer items-center gap-2 rounded-md border border-border bg-surface-elevated px-4 text-sm text-foreground hover:bg-surface-elevated/70">
        <Upload className="h-4 w-4" />
        {busy ? "Import en cours…" : "Importer un fichier CSV ou JSON"}
        <input
          type="file"
          accept=".csv,.json,text/csv,application/json"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
          className="hidden"
        />
      </label>

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

// ------- Parsers -------

function parseJSON(text: string): ImportItem[] {
  const raw = JSON.parse(text);
  const arr: unknown[] = Array.isArray(raw) ? raw : raw.items ?? raw.episodes ?? raw.data ?? [];
  return arr.map((r) => normalizeRow(r)).filter((r): r is ImportItem => !!r?.title);
}

function parseCSV(text: string): ImportItem[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => (row[h] = cells[idx] ?? ""));
    rows.push(row);
  }
  return rows.map((r) => normalizeRow(r)).filter((r): r is ImportItem => !!r?.title);
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') inQ = false;
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === "," || c === ";") {
        out.push(cur);
        cur = "";
      } else cur += c;
    }
  }
  out.push(cur);
  return out;
}

function pick(row: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

function normalizeRow(raw: any): ImportItem | null {
  if (!raw || typeof raw !== "object") return null;
  const lower: Record<string, unknown> = {};
  for (const k of Object.keys(raw)) lower[k.toLowerCase()] = raw[k];

  const title = pick(lower, [
    "title",
    "tv_show_name",
    "show",
    "show_name",
    "series",
    "name",
  ]);
  if (!title) return null;
  const season = pick(lower, ["season", "season_number", "s"]);
  const episode = pick(lower, ["episode", "episode_number", "e"]);
  const year = pick(lower, ["year", "first_air_year", "release_year"]);
  const watched = pick(lower, [
    "watched_at",
    "updated_at",
    "date",
    "seen_at",
    "created_at",
  ]);
  return {
    title,
    year: year ? Number(year) : null,
    season: season ? Number(season) : null,
    episode: episode ? Number(episode) : null,
    watched_at: watched ?? null,
  };
}
