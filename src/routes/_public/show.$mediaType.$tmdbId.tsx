import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, ChevronDown, Play, Plus, RotateCcw } from "lucide-react";
import { BackButton } from "@/components/back-button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAuthGate } from "@/hooks/use-auth-gate";
import { VhsCounter } from "@/components/vhs-counter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_public/show/$mediaType/$tmdbId")({
  component: ShowDetail,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">Erreur : {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm text-muted-foreground">Introuvable.</div>,
});

type ShowRow = {
  id: number;
  tmdb_id: number;
  media_type: string;
  title: string;
  overview: string | null;
  poster_path: string | null;
  first_air_date: string | null;
  status: string | null;
  genres: string[] | null;
  vote_average: number | null;
  tagline: string | null;
};
type SeasonRow = {
  id: number;
  show_id: number;
  season_number: number;
  episode_count: number | null;
};
type EpisodeRow = {
  id: number;
  show_id: number;
  season_number: number;
  episode_number: number;
  title: string | null;
  air_date: string | null;
  overview: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  a_voir: "À voir",
  en_cours: "En cours",
  termine: "Terminé",
  abandonne: "Abandonné",
  archive: "Archivé",
};

const TV_TMDB_STATUS_LABELS: Record<string, string> = {
  "Returning Series": "En diffusion",
  Ended: "Terminée",
  Canceled: "Annulée",
  "In Production": "En production",
  Planned: "Prévue",
  Pilot: "Pilote",
};

const MOVIE_TMDB_STATUS_LABELS: Record<string, string> = {
  Released: "Sorti",
  "Post Production": "Post-production",
  "In Production": "En production",
  Planned: "Prévu",
  Canceled: "Annulé",
  Rumored: "Rumeur",
};

const pad = (n: number) => n.toString().padStart(2, "0");

function ShowDetail() {
  const { mediaType, tmdbId } = Route.useParams();
  const { user } = useAuth();
  const { requireAuth } = useAuthGate();
  const qc = useQueryClient();
  // Verrou par épisode, partagé entre toggleWatched et addRewatch : les deux
  // actions touchent la même ligne watch_status pour un épisode donné, donc
  // ni isPending ni variables (qui ne reflètent que le DERNIER mutate() sur
  // une instance de mutation partagée par toute la liste) ne suffisent à
  // empêcher des requêtes concurrentes sur le même épisode.
  const [lockedEpisodes, setLockedEpisodes] = useState<Set<number>>(new Set());

  const detailsKey = ["show-details", mediaType, tmdbId];
  const { data, isLoading, error } = useQuery({
    queryKey: detailsKey,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-show-details", {
        body: { tmdb_id: Number(tmdbId), media_type: mediaType },
      });
      if (error) throw error;
      return data as { show: ShowRow; seasons: SeasonRow[]; episodes: EpisodeRow[] };
    },
  });

  const show = data?.show;

  const followKey = ["user-show", user?.id, show?.id];
  const { data: userShow } = useQuery({
    queryKey: followKey,
    enabled: !!user && !!show,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_shows")
        .select("*")
        .eq("user_id", user!.id)
        .eq("show_id", show!.id)
        .maybeSingle();
      return data;
    },
  });

  const watchedKey = ["watched", user?.id, show?.id];
  const { data: watched } = useQuery({
    queryKey: watchedKey,
    enabled: !!user && !!show,
    queryFn: async () => {
      const episodeIds = (data?.episodes ?? []).map((e) => e.id);
      if (!episodeIds.length) return {} as Record<number, { count: number }>;
      const { data: rows } = await supabase
        .from("watch_status")
        .select("episode_id, watch_count")
        .eq("user_id", user!.id)
        .in("episode_id", episodeIds);
      const map: Record<number, { count: number }> = {};
      (rows ?? []).forEach((r) => (map[r.episode_id] = { count: r.watch_count }));
      return map;
    },
  });

  const follow = useMutation({
    mutationFn: async () => {
      if (!user || !show) throw new Error("no user");
      const { error } = await supabase
        .from("user_shows")
        .upsert(
          { user_id: user.id, show_id: show.id, status: userShow?.status ?? "a_voir" },
          { onConflict: "user_id,show_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: followKey }),
  });

  const toggleWatched = useMutation({
    mutationFn: async ({ episodeId, isWatched }: { episodeId: number; isWatched: boolean }) => {
      if (!user) throw new Error("no user");
      if (isWatched) {
        // Décocher = reset complet, quel que soit le nombre de rewatchs accumulés.
        const { error } = await supabase
          .from("watch_status")
          .delete()
          .eq("user_id", user.id)
          .eq("episode_id", episodeId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("watch_status").upsert(
          {
            user_id: user.id,
            episode_id: episodeId,
            watch_count: 1,
            watched_at: new Date().toISOString(),
          },
          { onConflict: "user_id,episode_id" },
        );
        if (error) throw error;
      }
    },
    onMutate: async ({ episodeId, isWatched }) => {
      await qc.cancelQueries({ queryKey: watchedKey });
      const prev = qc.getQueryData<Record<number, { count: number }>>(watchedKey);
      qc.setQueryData<Record<number, { count: number }>>(watchedKey, (old) => {
        const next = { ...(old ?? {}) };
        if (isWatched) {
          delete next[episodeId];
        } else {
          next[episodeId] = { count: 1 };
        }
        return next;
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(watchedKey, ctx.prev);
      toast.error("Impossible de mettre à jour l'épisode");
    },
    onSettled: (_data, _err, { episodeId }) => {
      qc.invalidateQueries({ queryKey: watchedKey });
      setLockedEpisodes((prev) => {
        const next = new Set(prev);
        next.delete(episodeId);
        return next;
      });
    },
  });

  const addRewatch = useMutation({
    mutationFn: async ({
      episodeId,
      currentCount,
    }: {
      episodeId: number;
      currentCount: number;
    }) => {
      if (!user) throw new Error("no user");
      const newCount = currentCount + 1;
      const { error } = await supabase.from("watch_status").upsert(
        {
          user_id: user.id,
          episode_id: episodeId,
          watch_count: newCount,
          watched_at: new Date().toISOString(),
        },
        { onConflict: "user_id,episode_id" },
      );
      if (error) throw error;
      return newCount;
    },
    onMutate: async ({ episodeId, currentCount }) => {
      await qc.cancelQueries({ queryKey: watchedKey });
      const prev = qc.getQueryData<Record<number, { count: number }>>(watchedKey);
      qc.setQueryData<Record<number, { count: number }>>(watchedKey, (old) => ({
        ...(old ?? {}),
        [episodeId]: { count: currentCount + 1 },
      }));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(watchedKey, ctx.prev);
      toast.error("Impossible d'ajouter le revisionnage");
    },
    onSettled: (_data, _err, { episodeId }) => {
      qc.invalidateQueries({ queryKey: watchedKey });
      setLockedEpisodes((prev) => {
        const next = new Set(prev);
        next.delete(episodeId);
        return next;
      });
    },
  });

  if (isLoading || !data) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 animate-pulse rounded-full bg-surface-elevated" />
          <div className="h-4 w-24 animate-pulse rounded bg-surface-elevated" />
        </div>
        <div className="mt-4 flex gap-4">
          <div className="h-40 w-28 shrink-0 animate-pulse rounded-md bg-surface-elevated" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-6 w-3/4 animate-pulse rounded bg-surface-elevated" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-surface-elevated" />
            <div className="h-8 w-24 animate-pulse rounded-md bg-surface-elevated" />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-surface-elevated" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-surface-elevated" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-surface-elevated" />
        </div>
        <div className="mt-6 space-y-3">
          <div className="h-5 w-28 animate-pulse rounded bg-surface-elevated" />
          <div className="h-12 w-full animate-pulse rounded-md bg-surface-elevated" />
          <div className="h-10 w-full animate-pulse rounded-md bg-surface-elevated" />
          <div className="h-10 w-full animate-pulse rounded-md bg-surface-elevated" />
        </div>
      </div>
    );
  }
  if (error || !show) {
    return <div className="p-6 text-sm text-destructive">Chargement impossible.</div>;
  }

  const year = show.first_air_date ? show.first_air_date.slice(0, 4) : "—";
  const seasons = data.seasons;
  const episodes = data.episodes;

  const statusLabel = show.status
    ? (mediaType === "tv" ? TV_TMDB_STATUS_LABELS : MOVIE_TMDB_STATUS_LABELS)[show.status]
    : undefined;

  const today = new Date().toISOString().slice(0, 10);
  const nextAirDate =
    mediaType === "tv"
      ? episodes
          .filter((e) => e.air_date && e.air_date >= today)
          .sort((a, b) => (a.air_date! < b.air_date! ? -1 : 1))[0]?.air_date
      : undefined;

  const firstUnwatched =
    mediaType === "tv"
      ? episodes.find(
          (e) => (watched?.[e.id]?.count ?? 0) === 0 && e.air_date && e.air_date <= today,
        )
      : undefined;
  const anyWatched = episodes.some((e) => (watched?.[e.id]?.count ?? 0) > 0);

  return (
    <>
      <div className="flex items-center gap-3 px-5 pt-6">
        <Link
          to="/search"
          className="rounded-full border border-border bg-card p-2 text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="font-counter text-[11px] uppercase tracking-widest text-muted-foreground">
          {mediaType === "tv" ? "Série" : "Film"} · {year}
          {statusLabel ? ` · ${statusLabel}` : ""}
        </span>
      </div>

      <div className="mt-4 flex gap-4 px-5">
        <div className="h-40 w-28 shrink-0 overflow-hidden rounded-md border border-border bg-surface-elevated">
          {show.poster_path && (
            <img src={show.poster_path} alt={show.title} className="h-full w-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl leading-tight text-foreground">{show.title}</h1>
          {show.tagline && (
            <p className="mt-1 text-sm italic text-muted-foreground">{show.tagline}</p>
          )}
          {(!!show.vote_average || (show.genres ?? []).length > 0) && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {!!show.vote_average && (
                <span className="font-counter text-sm text-primary">
                  {show.vote_average.toFixed(1)}
                  <span className="text-muted-foreground">/10</span>
                </span>
              )}
              {(show.genres ?? []).map((g) => (
                <span
                  key={g}
                  className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  {g}
                </span>
              ))}
            </div>
          )}
          {nextAirDate && (
            <p className="mt-2 font-counter text-[11px] uppercase tracking-widest text-primary">
              Prochain épisode le{" "}
              {new Date(nextAirDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
            </p>
          )}
          {!userShow && (
            <button
              onClick={() =>
                requireAuth(() => follow.mutate(), {
                  reason: "suivre cette série",
                  intent: {
                    kind: "follow",
                    tmdbId: Number(tmdbId),
                    mediaType: mediaType as "tv" | "movie",
                  },
                })
              }
              disabled={follow.isPending}
              className="mt-3 inline-flex h-11 items-center gap-1.5 rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              Suivre
            </button>
          )}
          {userShow && (
            <>
              <p className="mt-3 flex items-center gap-1.5 font-counter text-[11px] uppercase tracking-widest text-muted-foreground">
                <Check className="h-3 w-3" /> Suivi
              </p>
              <StatusPicker
                userShow={userShow}
                onChange={() => qc.invalidateQueries({ queryKey: followKey })}
              />
            </>
          )}
        </div>
      </div>

      {show.overview && (
        <p className="mx-5 mt-4 text-sm leading-relaxed text-muted-foreground">{show.overview}</p>
      )}

      {mediaType === "tv" && firstUnwatched && (
        <div className="mx-5 mt-4 flex items-center gap-2">
          <Play className="h-4 w-4 shrink-0 text-primary" />
          <p className="text-sm text-foreground">
            <span className="text-muted-foreground">
              {anyWatched ? "Reprendre à" : "Commencer avec"}{" "}
            </span>
            <span className="font-counter text-primary">
              S{pad(firstUnwatched.season_number)}E{pad(firstUnwatched.episode_number)}
            </span>
          </p>
        </div>
      )}

      {mediaType === "tv" && (
        <div className="mt-6 space-y-6 px-5 pb-24">
          {seasons.map((s) => {
            const eps = episodes.filter((e) => e.season_number === s.season_number);
            const watchedCount = eps.filter((e) => (watched?.[e.id]?.count ?? 0) > 0).length;
            const last = eps[eps.length - 1]?.episode_number ?? 0;
            return (
              <section key={s.id}>
                <div className="mb-2 flex items-baseline justify-between">
                  <h2 className="font-display text-lg text-foreground">Saison {s.season_number}</h2>
                </div>
                <VhsCounter
                  seasonNumber={s.season_number}
                  lastEpisode={last}
                  watched={watchedCount}
                  total={eps.length}
                />
                <ul className="mt-3 space-y-1.5">
                  {eps.map((e) => {
                    const count = watched?.[e.id]?.count ?? 0;
                    const isWatched = count > 0;
                    const isLocked = lockedEpisodes.has(e.id);
                    const lockEpisode = () => setLockedEpisodes((prev) => new Set(prev).add(e.id));
                    return (
                      <EpisodeRow
                        key={e.id}
                        episode={e}
                        count={count}
                        onToggleWatched={() =>
                          requireAuth(
                            () => {
                              if (lockedEpisodes.has(e.id)) return;
                              lockEpisode();
                              toggleWatched.mutate({ episodeId: e.id, isWatched });
                            },
                            {
                              reason: "marquer cet épisode",
                              intent: {
                                kind: "mark_watched",
                                tmdbId: Number(tmdbId),
                                mediaType: mediaType as "tv" | "movie",
                                seasonNumber: e.season_number,
                                episodeNumber: e.episode_number,
                              },
                            },
                          )
                        }
                        onRewatch={() =>
                          requireAuth(
                            () => {
                              if (lockedEpisodes.has(e.id)) return;
                              lockEpisode();
                              addRewatch.mutate({ episodeId: e.id, currentCount: count });
                            },
                            { reason: "ajouter un revisionnage" },
                          )
                        }
                        isTogglePending={isLocked}
                        isRewatchPending={isLocked}
                      />
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

function EpisodeRow({
  episode,
  count,
  onToggleWatched,
  onRewatch,
  isTogglePending,
  isRewatchPending,
}: {
  episode: EpisodeRow;
  count: number;
  onToggleWatched: () => void;
  onRewatch: () => void;
  isTogglePending: boolean;
  isRewatchPending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isWatched = count > 0;
  const hasOverview = !!episode.overview;

  return (
    <li className="rounded-md border border-border bg-card px-3 py-2.5">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleWatched}
          disabled={isTogglePending}
          aria-label={isWatched ? "Marquer non vu" : "Marquer vu"}
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border transition-colors disabled:opacity-50 ${
            isWatched
              ? "border-cyan-accent bg-cyan-accent/10 text-cyan-accent"
              : "border-border bg-surface-elevated text-muted-foreground hover:text-primary hover:border-primary/60"
          }`}
        >
          {isWatched ? (
            count > 1 ? (
              <span className="font-counter text-[10px]">×{count}</span>
            ) : (
              <Check className="h-4 w-4" />
            )
          ) : (
            <Check className="h-4 w-4 opacity-40" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-counter text-[11px] tracking-widest text-primary">
              E{pad(episode.episode_number)}
            </span>
            <span className="truncate text-sm text-foreground">{episode.title ?? "—"}</span>
          </div>
          <p className="font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
            {episode.air_date ?? "date inconnue"}
          </p>
        </div>
        {isWatched && (
          <button
            onClick={onRewatch}
            disabled={isRewatchPending}
            aria-label="Ajouter un revisionnage"
            className="shrink-0 rounded-full p-1.5 text-cyan-accent hover:text-cyan-accent/80 disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
        {hasOverview && (
          <button
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? "Masquer le synopsis" : "Afficher le synopsis"}
            className="shrink-0 rounded-full p-3.5 text-muted-foreground hover:text-foreground"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        )}
      </div>
      {expanded && hasOverview && (
        <p className="mt-2 pl-11 text-xs leading-relaxed text-muted-foreground">
          {episode.overview}
        </p>
      )}
    </li>
  );
}

function StatusPicker({
  userShow,
  onChange,
}: {
  userShow: { show_id: number; status: string };
  onChange: () => void;
}) {
  const { user } = useAuth();
  const [status, setStatus] = useState(userShow.status);

  const update = async (next: string) => {
    setStatus(next);
    const { error } = await supabase
      .from("user_shows")
      .update({ status: next })
      .eq("user_id", user!.id)
      .eq("show_id", userShow.show_id);
    if (error) toast.error(error.message);
    else onChange();
  };

  return (
    <Select value={status} onValueChange={update}>
      <SelectTrigger className="mt-2 h-11 w-full max-w-[200px] rounded-md border-border bg-card px-3 text-sm text-foreground data-[state=open]:border-primary sm:w-auto">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(STATUS_LABELS).map(([k, label]) => (
          <SelectItem key={k} value={k} className="py-2.5 text-sm">
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
