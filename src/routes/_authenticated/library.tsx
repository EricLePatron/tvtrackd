import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ScreenHeader } from "@/components/screen-header";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { VhsCounter } from "@/components/vhs-counter";
import {
  buildLibraryProgress,
  type LibraryProgressEntry,
  type ScheduleEpisode,
} from "@/lib/schedule";

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

  // Show ids for the "En cours" tab only — the batched progress query below
  // is scoped to this tab, not to the whole library (cf. plan).
  const enCoursShowIds = useMemo(
    () =>
      rows
        .filter((r) => r.status === "en_cours" && r.show)
        .map((r) => r.show!.id)
        .sort((a, b) => a - b),
    [rows],
  );

  const { data: progressData, isLoading: progressLoading } = useQuery({
    queryKey: ["library-progress", user?.id, enCoursShowIds],
    enabled: !!user && active === "en_cours" && enCoursShowIds.length > 0,
    queryFn: async () => {
      // Unlike the home screen's episodes query (src/routes/_public/index.tsx),
      // this one cannot be bounded to a time window: buildLibraryProgress needs
      // the *whole* show (all seasons) to walk back to the first unwatched
      // episode and to size the current season's total, which can include
      // not-yet-aired episodes. The unbounded payload is accepted for the MVP's
      // low volume, but an explicit season/episode order means that if
      // PostgREST's default row cap (commonly 1000) ever truncates the result,
      // it drops the *tail* of a deterministically sorted list (later
      // seasons/episodes) rather than an arbitrary DB-order slice — keeping
      // buildLibraryProgress's "first unwatched episode" resolution correct for
      // as many shows as possible instead of silently corrupting it.
      const { data: eps, error: epsError } = await supabase
        .from("episodes")
        .select(
          "id, season_number, episode_number, title, air_date, show:shows!inner(id, tmdb_id, media_type, title, poster_path)",
        )
        .in("show_id", enCoursShowIds)
        .order("season_number", { ascending: true })
        .order("episode_number", { ascending: true });
      if (epsError) throw epsError;

      const episodes = (eps ?? []) as unknown as ScheduleEpisode[];
      const epIds = episodes.map((e) => e.id);
      const { data: watched, error: watchedError } = epIds.length
        ? await supabase
            .from("watch_status")
            .select("episode_id")
            .eq("user_id", user!.id)
            .in("episode_id", epIds)
        : { data: [], error: null };
      if (watchedError) throw watchedError;

      const watchedSet = new Set((watched ?? []).map((w) => w.episode_id));
      const today = new Date().toISOString().slice(0, 10);
      return buildLibraryProgress(episodes, watchedSet, today);
    },
  });

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
                <LibraryCard
                  key={r.id}
                  show={r.show}
                  showProgress={
                    active === "en_cours"
                      ? {
                          loading: progressLoading,
                          knownShowIds: progressData?.knownShowIds,
                          entry: progressData?.progressByShowId.get(r.show.id),
                        }
                      : undefined
                  }
                />
              ) : null,
            )}
          </div>
        )}
      </div>
    </>
  );
}

function LibraryCard({
  show,
  showProgress,
}: {
  show: NonNullable<Row["show"]>;
  showProgress?: {
    loading: boolean;
    knownShowIds: ReadonlySet<number> | undefined;
    entry: LibraryProgressEntry | undefined;
  };
}) {
  return (
    <Link
      to="/show/$mediaType/$tmdbId"
      params={{
        mediaType: show.media_type,
        tmdbId: String(show.tmdb_id),
      }}
      className="group block"
    >
      <div className="aspect-[2/3] overflow-hidden rounded-md border border-border bg-surface-elevated">
        {show.poster_path && (
          <img
            src={show.poster_path}
            alt={show.title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <p className="mt-1.5 line-clamp-2 text-xs text-foreground">{show.title}</p>

      {showProgress && (
        // Fixed min-height shared by all 4 states (skeleton / chip / "à jour" /
        // no-data) so the card never jumps when the skeleton resolves and
        // sibling cards stay aligned in the grid — ~42px matches the 2-line
        // grid VhsCounter chip, the tallest of the 4 states.
        <div className="mt-1.5 flex min-h-[42px] w-full flex-col justify-center">
          {showProgress.loading ? (
            <div className="h-[42px] w-full animate-pulse rounded-md bg-surface-elevated" />
          ) : showProgress.entry ? (
            <VhsCounter
              variant="grid"
              seasonNumber={showProgress.entry.nextEpisode.season_number}
              nextEpisodeNumber={showProgress.entry.nextEpisode.episode_number}
              watched={showProgress.entry.seasonWatched}
              total={showProgress.entry.seasonTotal}
            />
          ) : showProgress.knownShowIds?.has(show.id) ? (
            <div className="flex min-h-[42px] items-center justify-center rounded-md bg-surface-elevated px-2 py-1.5 font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
              À jour
            </div>
          ) : (
            <div className="min-h-[42px]" aria-hidden="true" />
          )}
        </div>
      )}
    </Link>
  );
}
