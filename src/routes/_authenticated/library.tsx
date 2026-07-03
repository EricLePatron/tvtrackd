import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ScreenHeader } from "@/components/screen-header";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/library")({
  component: LibraryScreen,
});

const STATUSES = [
  { key: "a_voir", label: "À voir" },
  { key: "en_cours", label: "En cours" },
  { key: "termine", label: "Terminé" },
  { key: "abandonne", label: "Abandonné" },
  { key: "archive", label: "Archive" },
] as const;

type Row = {
  id: number;
  status: string;
  show: {
    id: number;
    tmdb_id: number;
    media_type: string;
    title: string;
    poster_path: string | null;
  } | null;
};

function LibraryScreen() {
  const { user } = useAuth();
  const [active, setActive] = useState<(typeof STATUSES)[number]["key"]>("en_cours");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["library", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_shows")
        .select("id, status, show:shows(id, tmdb_id, media_type, title, poster_path)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const counts: Record<string, number> = {};
  for (const s of STATUSES) counts[s.key] = 0;
  rows.forEach((r) => {
    counts[r.status] = (counts[r.status] ?? 0) + 1;
  });

  const filtered = rows.filter((r) => r.status === active);

  return (
    <>
      <ScreenHeader eyebrow="Ma collection" title="Bibliothèque">
        Vos suivis, filtrés par statut — l'archive garde tout l'historique.
      </ScreenHeader>

      <div className="px-5">
        <div className="-mx-1 overflow-x-auto">
          <div className="flex gap-2 px-1 pb-2">
            {STATUSES.map((s) => (
              <button
                key={s.key}
                onClick={() => setActive(s.key)}
                className={`shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active === s.key
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground"
                }`}
              >
                <span className="font-counter mr-1.5">
                  {(counts[s.key] ?? 0).toString().padStart(2, "0")}
                </span>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <p className="mt-8 text-center font-counter text-[11px] uppercase tracking-widest text-muted-foreground">
            Chargement…
          </p>
        ) : filtered.length === 0 ? (
          <p className="mt-10 text-center font-counter text-[11px] uppercase tracking-widest text-muted-foreground">
            — vide —
          </p>
        ) : (
          <div className="mt-5 grid grid-cols-3 gap-3">
            {filtered.map((r) =>
              r.show ? (
                <Link
                  key={r.id}
                  to="/show/$mediaType/$tmdbId"
                  params={{
                    mediaType: r.show.media_type,
                    tmdbId: String(r.show.tmdb_id),
                  }}
                  className="group block"
                >
                  <div className="aspect-[2/3] overflow-hidden rounded-md border border-border bg-surface-elevated">
                    {r.show.poster_path && (
                      <img
                        src={r.show.poster_path}
                        alt={r.show.title}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-xs text-foreground">
                    {r.show.title}
                  </p>
                </Link>
              ) : null,
            )}
          </div>
        )}
      </div>
    </>
  );
}
