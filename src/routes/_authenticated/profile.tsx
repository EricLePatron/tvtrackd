import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Upload, LogOut, History, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { estimateWatchMinutes } from "@/lib/watch-time";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfileScreen,
});

const MAX_VISIBLE_WARNINGS = 5;

type Unmatched = { key: string; title: string; year: number | null; occurrences: number };

type ImportRun = {
  id: number;
  source: string;
  imported_episodes: number;
  followed_shows: number;
  unmatched_count: number;
  created_at: string;
};

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
      const minutes = estimateWatchMinutes(episodesWatched);
      return {
        episodesWatched,
        inProgress,
        hours: Math.round(minutes / 60),
        days: Math.floor(minutes / (60 * 24)),
      };
    },
  });

  // Historique des runs d'import (20 plus récents)
  const { data: importRuns } = useQuery({
    queryKey: ["import-runs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("import_runs")
        .select("id, source, imported_episodes, followed_shows, unmatched_count, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      return (data ?? []) as ImportRun[];
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
            Récupérez vos années de tracking depuis TV Time ou Betaseries, avec un guide pas à pas.
            Export JSON dispo à tout moment.
          </p>
          <div className="mt-4 space-y-2">
            <Link
              to="/import"
              className="flex h-11 w-full items-center justify-between gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <span className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Importer mes séries (guide pas à pas)
              </span>
              <ArrowRight className="h-4 w-4" />
            </Link>
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

        {/* Historique des imports */}
        {importRuns && importRuns.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-display text-sm uppercase tracking-widest text-foreground">
                Historique des imports
              </h3>
            </div>
            <div className="mt-3 space-y-2">
              {importRuns.map((run) => (
                <ImportRunRow key={run.id} run={run} />
              ))}
            </div>
          </div>
        )}

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

function ImportRunRow({ run }: { run: ImportRun }) {
  const date = new Date(run.created_at).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const sourceLabel = run.source
    ? run.source.charAt(0).toUpperCase() + run.source.slice(1)
    : "Import";

  return (
    <div className="flex items-start justify-between rounded-md bg-surface-elevated/50 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground">{sourceLabel}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">{date}</p>
      </div>
      <div className="ml-3 flex shrink-0 gap-3 text-right">
        <div>
          <p className="font-counter text-sm text-foreground tabular-nums">
            {run.imported_episodes}
          </p>
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground">épisodes</p>
        </div>
        <div>
          <p className="font-counter text-sm text-foreground tabular-nums">{run.followed_shows}</p>
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground">séries</p>
        </div>
        {run.unmatched_count > 0 && (
          <div>
            <p className="font-counter text-sm text-destructive tabular-nums">
              {run.unmatched_count}
            </p>
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground">manqués</p>
          </div>
        )}
      </div>
    </div>
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
