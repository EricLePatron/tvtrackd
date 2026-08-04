import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ScreenHeader } from "@/components/screen-header";
import { ResolutionRow, itemKey, type Unmatched } from "@/components/import/import-panel";
import type { ImportItem } from "@/lib/import-parsers";

export const Route = createFileRoute("/_authenticated/import-run/$runId")({
  head: () => ({
    meta: [
      { title: "Détail d'un import — tvtrackd" },
      {
        name: "description",
        content:
          "Vérifiez le détail d'un import, corrigez à la main les séries non identifiées et validez leur réimport.",
      },
      { property: "og:title", content: "Détail d'un import — tvtrackd" },
      {
        property: "og:description",
        content: "Corrigez et validez manuellement les séries non identifiées d'un import.",
      },
    ],
  }),
  component: ImportRunDetail,
});

type Run = {
  id: number;
  source: string;
  created_at: string;
  imported_episodes: number;
  followed_shows: number;
  unmatched_count: number;
  total_groups: number | null;
  unmatched: Unmatched[];
  unmatched_items: ImportItem[];
  resolved_keys: string[];
};

function ImportRunDetail() {
  const { runId } = Route.useParams();
  const qc = useQueryClient();
  const [resolutions, setResolutions] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  const { data: run, isLoading } = useQuery({
    queryKey: ["import-run", runId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_runs")
        .select(
          "id, source, created_at, imported_episodes, followed_shows, unmatched_count, total_groups, unmatched, unmatched_items, resolved_keys",
        )
        .eq("id", Number(runId))
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Run | null;
    },
  });

  async function markResolved(keys: string[]) {
    if (!run) return;
    const next = [...new Set([...(run.resolved_keys ?? []), ...keys])];
    await supabase
      .from("import_runs")
      .update({ resolved_keys: next as unknown as never })
      .eq("id", run.id);
    qc.invalidateQueries({ queryKey: ["import-run", runId] });
    qc.invalidateQueries({ queryKey: ["import-runs"] });
  }

  async function validate() {
    if (!run) return;
    const keys = Object.keys(resolutions);
    if (!keys.length) return;
    setBusy(true);
    const items = (run.unmatched_items ?? []).filter((it) => keys.includes(itemKey(it)));
    const { data, error } = await supabase.functions.invoke("import-history", {
      body: { items, resolutions, source: run.source },
    });
    setBusy(false);
    if (error) {
      toast.error("Échec de la validation — réessayez.");
      return;
    }
    const res = data as { imported: number; followed: number; unmatched: Unmatched[] };
    const stillUnmatched = new Set((res.unmatched ?? []).map((u) => u.key));
    const done = keys.filter((k) => !stillUnmatched.has(k));
    toast.success(`${res.imported} épisodes importés · ${res.followed} nouvelles séries`);
    setResolutions({});
    await markResolved(done);
  }

  const resolved = new Set(run?.resolved_keys ?? []);
  const pending = (run?.unmatched ?? []).filter((u) => !resolved.has(u.key));

  return (
    <>
      <ScreenHeader eyebrow="Compte" title="Détail de l'import" />
      <div className="mx-5 space-y-4 pb-24">
        <Link
          to="/profile"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Retour au profil
        </Link>

        {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
        {!isLoading && !run && (
          <p className="text-sm text-muted-foreground">Cet import est introuvable.</p>
        )}

        {run && (
          <>
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="font-counter text-[11px] uppercase tracking-widest text-primary">
                {run.source ? run.source : "Import"} ·{" "}
                {new Date(run.created_at).toLocaleString("fr-FR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                <Stat value={run.imported_episodes} label="épisodes" />
                <Stat value={run.followed_shows} label="séries" />
                <Stat value={pending.length} label="à corriger" alert={pending.length > 0} />
              </div>
              {run.total_groups != null && (
                <p className="mt-3 text-[11px] text-muted-foreground">
                  {run.total_groups - run.unmatched_count} série(s) sur {run.total_groups}{" "}
                  identifiées automatiquement.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="font-display text-sm uppercase tracking-widest text-foreground">
                Correction manuelle
              </h2>
              {pending.length === 0 ? (
                <p className="mt-3 flex items-center gap-2 text-xs text-secondary">
                  <CheckCircle2 className="h-4 w-4" /> Tout est traité pour cet import.
                </p>
              ) : (
                <>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    Choisissez la bonne fiche pour chaque série, puis validez : les épisodes
                    correspondants de cet import seront ajoutés à votre bibliothèque.
                  </p>
                  <div className="mt-3 space-y-3">
                    {pending.map((u) => (
                      <div key={u.key} className="space-y-1">
                        <ResolutionRow
                          item={u}
                          chosen={resolutions[u.key]}
                          onPick={(id) => setResolutions((r) => ({ ...r, [u.key]: id }))}
                        />
                        <button
                          onClick={() => markResolved([u.key])}
                          className="text-[10px] text-muted-foreground hover:text-foreground"
                        >
                          Ignorer cette série
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={validate}
                    disabled={busy || Object.keys(resolutions).length === 0}
                    className="mt-4 h-11 w-full rounded-md bg-primary font-display text-sm text-primary-foreground disabled:opacity-40"
                  >
                    {busy
                      ? "Validation en cours…"
                      : `Valider ${Object.keys(resolutions).length || ""} correspondance(s)`}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Stat({ value, label, alert }: { value: number; label: string; alert?: boolean }) {
  return (
    <div className="rounded-md bg-surface-elevated/50 py-3">
      <p
        className={`font-counter text-lg tabular-nums ${alert ? "text-destructive" : "text-foreground"}`}
      >
        {value}
      </p>
      <p className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}
