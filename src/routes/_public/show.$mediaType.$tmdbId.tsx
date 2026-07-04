import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Check, Plus, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { VhsCounter } from "@/components/vhs-counter";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/show/$mediaType/$tmdbId")({
  component: ShowDetail,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">Erreur : {error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="p-6 text-sm text-muted-foreground">Introuvable.</div>
  ),
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
};
type SeasonRow = { id: number; show_id: number; season_number: number; episode_count: number | null };
type EpisodeRow = {
  id: number;
  show_id: number;
  season_number: number;
  episode_number: number;
  title: string | null;
  air_date: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  a_voir: "À voir",
  en_cours: "En cours",
  termine: "Terminé",
  abandonne: "Abandonné",
  archive: "Archivé",
};

function ShowDetail() {
  const { mediaType, tmdbId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();

  const detailsKey = ["show-details", mediaType, tmdbId];
  const {
    data,
    isLoading,
    error,
  } = useQuery({
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

  const markWatched = useMutation({
    mutationFn: async ({ episodeId, currentCount }: { episodeId: number; currentCount: number }) => {
      if (!user) throw new Error("no user");
      const newCount = currentCount + 1;
      const { error } = await supabase
        .from("watch_status")
        .upsert(
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
      toast.error("Impossible de marquer vu");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: watchedKey }),
  });

  if (isLoading || !data) {
    return (
      <div className="p-6">
        <div className="h-6 w-24 animate-pulse rounded bg-surface-elevated" />
        <div className="mt-4 aspect-[2/3] w-40 animate-pulse rounded-md bg-surface-elevated" />
      </div>
    );
  }
  if (error || !show) {
    return <div className="p-6 text-sm text-destructive">Chargement impossible.</div>;
  }

  const year = show.first_air_date ? show.first_air_date.slice(0, 4) : "—";
  const seasons = data.seasons;
  const episodes = data.episodes;

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
          <button
            onClick={() => follow.mutate()}
            disabled={follow.isPending}
            className={`mt-3 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
              userShow
                ? "bg-secondary/10 text-secondary border border-secondary/30"
                : "bg-primary text-primary-foreground"
            }`}
          >
            {userShow ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {userShow ? STATUS_LABELS[userShow.status] ?? "Suivi" : "Suivre"}
          </button>
          {userShow && <StatusPicker userShow={userShow} onChange={() => qc.invalidateQueries({ queryKey: followKey })} />}
        </div>
      </div>

      {show.overview && (
        <p className="mx-5 mt-4 text-sm leading-relaxed text-muted-foreground">
          {show.overview}
        </p>
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
                  <h2 className="font-display text-lg text-foreground">
                    Saison {s.season_number}
                  </h2>
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
                    return (
                      <li
                        key={e.id}
                        className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5"
                      >
                        <button
                          onClick={() =>
                            markWatched.mutate({ episodeId: e.id, currentCount: count })
                          }
                          aria-label={isWatched ? "Marquer comme revu" : "Marquer vu"}
                          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border transition-colors ${
                            isWatched
                              ? "border-secondary bg-secondary/10 text-secondary"
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
                              E{e.episode_number.toString().padStart(2, "0")}
                            </span>
                            <span className="truncate text-sm text-foreground">
                              {e.title ?? "—"}
                            </span>
                          </div>
                          <p className="font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
                            {e.air_date ?? "date inconnue"}
                          </p>
                        </div>
                        {isWatched && count > 1 && (
                          <RotateCcw className="h-3.5 w-3.5 text-secondary" />
                        )}
                      </li>
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
    <div className="mt-3 flex flex-wrap gap-1.5">
      {Object.entries(STATUS_LABELS).map(([k, label]) => (
        <button
          key={k}
          onClick={() => update(k)}
          className={`rounded-md border px-2 py-1 text-[11px] transition-colors ${
            status === k
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-card text-muted-foreground"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
