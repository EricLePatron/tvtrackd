import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Ban, Check, ChevronDown, ChevronRight, Plus, RotateCcw, Trash2 } from "lucide-react";
import { BackButton } from "@/components/back-button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAuthGate } from "@/hooks/use-auth-gate";
import { followShow, unfollowShow } from "@/lib/follow-show";
import { VhsCounter } from "@/components/vhs-counter";
import { SeasonToggle } from "@/components/season-toggle";
import {
  NetworkLine,
  WhereToWatch,
  type NetworkRef,
  type WatchProviders,
} from "@/components/where-to-watch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SimilarRail } from "@/components/show/similar-rail";

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
  watch_providers: WatchProviders | null;
  networks: NetworkRef[] | null;
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
  const [overviewExpanded, setOverviewExpanded] = useState(false);
  const [isOverviewTruncated, setIsOverviewTruncated] = useState(false);
  const overviewRef = useRef<HTMLParagraphElement>(null);

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

  // Détection simple de troncature (au montage / au chargement du synopsis) :
  // line-clamp-2 peut ne rien tronquer si le texte est court, auquel cas le
  // bouton "Lire la suite" ne doit pas s'afficher. Pas de ResizeObserver ni
  // de recalcul au resize, un check ponctuel suffit pour ce cas d'usage.
  useEffect(() => {
    const el = overviewRef.current;
    setIsOverviewTruncated(!!el && el.scrollHeight > el.clientHeight);
  }, [show?.overview]);

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
      await followShow(user.id, show.id, !!userShow);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: followKey }),
  });

  // Invalide toujours `followKey` après une action de tracking (mark/unmark/
  // rewatch/saison) : `status`/`manual_override` peuvent changer côté SQL
  // (triggers de la migration auto_status) et le badge affiché plus haut sur
  // cette page doit refléter ce changement sans attendre une renavigation.
  // Si l'override valait "abandonne" juste avant l'action et vaut `null`
  // après refetch, ça signifie que le trigger SQL vient de lever la reprise
  // de suivi implicite (nouvel épisode marqué vu) : on l'annonce par un
  // toast, plutôt que de laisser le badge changer silencieusement.
  //
  // Garde-fou anti double-toast : si l'utilisateur marque deux épisodes en
  // succession rapide, les deux mutations peuvent chacune capturer
  // `prevOverride: "abandonne"` avant que l'une ait abouti, et donc chacune
  // constater après coup que l'override est passé à `null` — sans ce ref,
  // les deux afficheraient le toast. `liftNotifiedRef` mémorise qu'une levée
  // a déjà été annoncée pour le cycle "abandonne" courant ; il n'est remis à
  // `false` que lorsque `manual_override` redevient "abandonne" (nouvelle
  // action explicite de l'utilisateur), ce qui autorise une nouvelle
  // notification lors d'une future levée.
  const liftNotifiedRef = useRef(false);
  useEffect(() => {
    if (userShow?.manual_override === "abandonne") {
      liftNotifiedRef.current = false;
    }
  }, [userShow?.manual_override]);

  const notifyOverrideLift = async (prevOverride: string | null | undefined) => {
    await qc.invalidateQueries({ queryKey: followKey });
    if (prevOverride !== "abandonne" || liftNotifiedRef.current) return;
    const updated = qc.getQueryData<UserShowRow | null>(followKey);
    if (updated && updated.manual_override === null) {
      liftNotifiedRef.current = true;
      toast.success("Reprise de suivi détectée");
    }
  };

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
      const prevOverride = qc.getQueryData<UserShowRow | null>(followKey)?.manual_override ?? null;
      qc.setQueryData<Record<number, { count: number }>>(watchedKey, (old) => {
        const next = { ...(old ?? {}) };
        if (isWatched) {
          delete next[episodeId];
        } else {
          next[episodeId] = { count: 1 };
        }
        return next;
      });
      return { prev, prevOverride };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(watchedKey, ctx.prev);
      toast.error("Impossible de mettre à jour l'épisode");
    },
    onSettled: (_data, _err, { episodeId }, ctx) => {
      qc.invalidateQueries({ queryKey: watchedKey });
      setLockedEpisodes((prev) => {
        const next = new Set(prev);
        next.delete(episodeId);
        return next;
      });
      notifyOverrideLift(ctx?.prevOverride);
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
      const prevOverride = qc.getQueryData<UserShowRow | null>(followKey)?.manual_override ?? null;
      qc.setQueryData<Record<number, { count: number }>>(watchedKey, (old) => ({
        ...(old ?? {}),
        [episodeId]: { count: currentCount + 1 },
      }));
      return { prev, prevOverride };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(watchedKey, ctx.prev);
      toast.error("Impossible d'ajouter le revisionnage");
    },
    onSettled: (_data, _err, { episodeId }, ctx) => {
      qc.invalidateQueries({ queryKey: watchedKey });
      setLockedEpisodes((prev) => {
        const next = new Set(prev);
        next.delete(episodeId);
        return next;
      });
      notifyOverrideLift(ctx?.prevOverride);
    },
  });

  // Bulk (marquer/démarquer toute une saison). Réutilise le même verrou par
  // épisode que toggleWatched/addRewatch pour empêcher un clic individuel
  // concurrent pendant l'opération groupée.
  const toggleSeason = useMutation({
    mutationFn: async ({
      action,
      episodeIds,
    }: {
      action: "mark" | "unmark";
      episodeIds: number[];
    }) => {
      if (!user) throw new Error("no user");
      if (!episodeIds.length) return;
      if (action === "mark") {
        const rows = episodeIds.map((episodeId) => ({
          user_id: user.id,
          episode_id: episodeId,
          watch_count: 1,
          watched_at: new Date().toISOString(),
        }));
        const { error } = await supabase
          .from("watch_status")
          .upsert(rows, { onConflict: "user_id,episode_id" });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("watch_status")
          .delete()
          .eq("user_id", user.id)
          .in("episode_id", episodeIds);
        if (error) throw error;
      }
    },
    onMutate: async ({ action, episodeIds }) => {
      await qc.cancelQueries({ queryKey: watchedKey });
      const prev = qc.getQueryData<Record<number, { count: number }>>(watchedKey);
      const prevOverride = qc.getQueryData<UserShowRow | null>(followKey)?.manual_override ?? null;
      qc.setQueryData<Record<number, { count: number }>>(watchedKey, (old) => {
        const next = { ...(old ?? {}) };
        episodeIds.forEach((episodeId) => {
          if (action === "mark") next[episodeId] = { count: 1 };
          else delete next[episodeId];
        });
        return next;
      });
      return { prev, prevOverride };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(watchedKey, ctx.prev);
      toast.error("Impossible de mettre à jour la saison");
    },
    onSettled: (_data, _err, { episodeIds }, ctx) => {
      qc.invalidateQueries({ queryKey: watchedKey });
      setLockedEpisodes((prev) => {
        const next = new Set(prev);
        episodeIds.forEach((episodeId) => next.delete(episodeId));
        return next;
      });
      notifyOverrideLift(ctx?.prevOverride);
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
        <div className="mt-4 space-y-1.5">
          <div className="h-3 w-20 animate-pulse rounded bg-surface-elevated" />
          <div className="flex gap-2">
            <div className="h-10 w-10 animate-pulse rounded-md bg-surface-elevated" />
            <div className="h-10 w-10 animate-pulse rounded-md bg-surface-elevated" />
            <div className="h-10 w-10 animate-pulse rounded-md bg-surface-elevated" />
            <div className="h-10 w-10 animate-pulse rounded-md bg-surface-elevated" />
          </div>
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
  const nextUpcomingEpisode =
    mediaType === "tv"
      ? episodes
          .filter((e) => e.air_date && e.air_date >= today)
          .sort((a, b) => (a.air_date! < b.air_date! ? -1 : 1))[0]
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
        <BackButton fallbackTo="/search" />

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
          {!!show.vote_average && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="font-counter text-sm text-cyan-accent">
                {show.vote_average.toFixed(1)}
                <span className="text-muted-foreground">/10</span>
              </span>
            </div>
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
        </div>
      </div>

      {(show.genres ?? []).length > 0 && (
        <div className="mx-5 mt-2 flex flex-wrap gap-2">
          {show.genres!.map((genre) => (
            <span
              key={genre}
              className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              {genre}
            </span>
          ))}
        </div>
      )}

      {mediaType === "tv" && <NetworkLine networks={show.networks} />}

      {show.overview && (
        <div className="mx-5 mt-4">
          <p
            ref={overviewRef}
            className={cn(
              "text-sm leading-relaxed text-muted-foreground",
              !overviewExpanded && "line-clamp-2",
            )}
          >
            {show.overview}
          </p>
          {isOverviewTruncated && (
            <button
              type="button"
              onClick={() => setOverviewExpanded((v) => !v)}
              aria-expanded={overviewExpanded}
              className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
            >
              {overviewExpanded ? "Réduire" : "Lire la suite"}
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${overviewExpanded ? "rotate-180" : ""}`}
              />
            </button>
          )}
        </div>
      )}

      <WhereToWatch showTitle={show.title} watchProviders={show.watch_providers} />

      {mediaType === "tv" && nextUpcomingEpisode && (
        <div className="mx-5 mt-4">
          <p className="font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
            Prochain épisode
          </p>
          <p className="mt-0.5 font-counter text-sm font-semibold text-foreground">
            S{pad(nextUpcomingEpisode.season_number)}E{pad(nextUpcomingEpisode.episode_number)} ·{" "}
            {new Date(nextUpcomingEpisode.air_date!).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>
      )}

      {userShow && (
        <div className="mx-5 mt-4">
          <StatusPicker
            userShow={userShow}
            mediaType={mediaType}
            showTitle={show.title}
            onChange={() => qc.invalidateQueries({ queryKey: followKey })}
          />
        </div>
      )}

      {mediaType === "tv" && <Separator className="mx-5 mt-6 w-auto" />}

      {mediaType === "tv" && userShow && !userShow.manual_override && firstUnwatched && (
        <div className="mx-5 mt-6">
          <button
            type="button"
            onClick={() => {
              const target = document.getElementById(`episode-${firstUnwatched.id}`);
              target?.scrollIntoView({ behavior: "smooth", block: "center" });
              target?.focus({ preventScroll: true });
            }}
            className="-my-3 inline-flex items-center gap-1.5 py-3 text-sm font-medium text-foreground"
          >
            {anyWatched ? "Reprendre" : "Commencer avec"}{" "}
            <span className="font-counter">
              S{pad(firstUnwatched.season_number)}E{pad(firstUnwatched.episode_number)}
            </span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {mediaType === "tv" && (
        <div className="mt-6 space-y-6 px-5 pb-24">
          {seasons.map((s) => {
            const eps = episodes.filter((e) => e.season_number === s.season_number);
            const watchedCount = eps.filter((e) => (watched?.[e.id]?.count ?? 0) > 0).length;
            const last = eps[eps.length - 1]?.episode_number ?? 0;

            // Épisodes "éligibles" au marquage groupé : ceux déjà diffusés.
            // Les épisodes sans air_date connue ne sont pas considérés comme
            // futurs (on ne les bloque pas faute de donnée), seuls ceux avec
            // une air_date strictement postérieure à aujourd'hui le sont.
            const eligibleEpisodes = eps.filter((e) => !(e.air_date && e.air_date > today));
            const eligibleWatchedCount = eligibleEpisodes.filter(
              (e) => (watched?.[e.id]?.count ?? 0) > 0,
            ).length;
            const seasonState: boolean | "indeterminate" =
              eligibleEpisodes.length === 0 || eligibleWatchedCount === 0
                ? false
                : eligibleWatchedCount === eligibleEpisodes.length
                  ? true
                  : "indeterminate";
            const seasonLocked = eps.some((e) => lockedEpisodes.has(e.id));
            const seasonToggleDisabled =
              seasonLocked || (eligibleEpisodes.length === 0 && watchedCount === 0);

            const lockEpisodes = (ids: number[]) =>
              setLockedEpisodes((prev) => {
                const next = new Set(prev);
                ids.forEach((id) => next.add(id));
                return next;
              });

            const markSeasonWatched = () =>
              requireAuth(
                () => {
                  if (seasonLocked) return;
                  const ids = eligibleEpisodes
                    .filter((e) => (watched?.[e.id]?.count ?? 0) === 0)
                    .map((e) => e.id);
                  if (!ids.length) return;
                  lockEpisodes(ids);
                  toggleSeason.mutate({ action: "mark", episodeIds: ids });
                },
                { reason: "marquer cette saison" },
              );

            const unmarkSeasonWatched = () =>
              requireAuth(
                () => {
                  if (seasonLocked) return;
                  const ids = eps.filter((e) => (watched?.[e.id]?.count ?? 0) > 0).map((e) => e.id);
                  if (!ids.length) return;
                  lockEpisodes(ids);
                  toggleSeason.mutate({ action: "unmark", episodeIds: ids });
                },
                { reason: "démarquer cette saison" },
              );

            return (
              <section key={s.id}>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="font-display text-lg text-foreground">Saison {s.season_number}</h2>
                  <SeasonToggle
                    seasonNumber={s.season_number}
                    state={seasonState}
                    disabled={seasonToggleDisabled}
                    onMark={markSeasonWatched}
                    onUnmark={unmarkSeasonWatched}
                  />
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

      <div className="mx-5 pb-24">
        <SimilarRail tmdbId={tmdbId} mediaType={mediaType} />
      </div>
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
    <li
      id={`episode-${episode.id}`}
      tabIndex={-1}
      className="scroll-mt-6 rounded-md border border-border bg-card px-3 py-2.5"
    >
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
            <span className="font-counter text-[11px] tracking-widest text-muted-foreground">
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

type UserShowRow = {
  show_id: number;
  status: string;
  manual_override: string | null;
};

// Pour les séries TV, `status` (à voir / en cours / terminé) est désormais
// TOUJOURS dérivé automatiquement de la progression de visionnage côté SQL
// (triggers sur watch_status/episodes/seasons/shows, cf. migrations
// 20260706100000_auto_status.sql et 20260706110000_lift_abandon_on_new_watch.sql)
// — l'utilisateur ne le choisit plus jamais directement. Le picker devient un
// badge lecture-seule + un menu "Gérer le suivi" qui n'écrit que
// `manual_override` ("Abandonner" / "Reprendre le suivi") ou supprime la
// ligne `user_shows` ("Ne plus suivre"), jamais `status` directement.
// "Archiver" n'existe plus comme action : les lignes déjà en `archive`
// (valeur toujours valide en base, cf. migration) sont traitées comme un
// override actif au même titre que `abandonne` (proposent "Reprendre le
// suivi"). Pour les films (aucune donnée episodes/seasons pour eux dans ce
// schéma), le comportement reste inchangé : un select manuel classique à 5
// valeurs.
function StatusPicker({
  userShow,
  mediaType,
  showTitle,
  onChange,
}: {
  userShow: UserShowRow;
  mediaType: string;
  showTitle: string;
  onChange: () => void;
}) {
  if (mediaType !== "tv") {
    return <MovieStatusPicker userShow={userShow} onChange={onChange} />;
  }
  return <TvStatusBadge userShow={userShow} showTitle={showTitle} onChange={onChange} />;
}

function MovieStatusPicker({
  userShow,
  onChange,
}: {
  userShow: UserShowRow;
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
      <SelectTrigger className="h-11 w-full max-w-[200px] rounded-md border-border bg-card px-3 text-sm text-foreground data-[state=open]:border-primary sm:w-auto">
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

// Couleurs du badge alignées sur les indicateurs déjà utilisés ailleurs dans
// l'app (rail "Suivi" plus haut, ready-list-item, calendar-timeline) : ambre
// pour "en cours", cyan pour "terminé", neutre (bordure seule, sans fond)
// pour à voir / abandonné / archivé.
const TV_STATUS_BADGE_STYLES: Record<string, string> = {
  en_cours: "border-primary/40 bg-primary/10 text-primary",
  termine: "border-cyan-accent/40 bg-cyan-accent/10 text-cyan-accent",
  a_voir: "border-border text-muted-foreground",
  abandonne: "border-border text-muted-foreground",
  archive: "border-border text-muted-foreground",
};

function TvStatusBadge({
  userShow,
  showTitle,
  onChange,
}: {
  userShow: UserShowRow;
  showTitle: string;
  onChange: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  // Même clé que celle utilisée par le composant parent pour `userShow`
  // (reconstruite localement plutôt que passée en prop, `userShow.show_id`
  // étant strictement égal au `show?.id` du parent une fois cette ligne
  // chargée). Sert uniquement à annuler un refetch obsolète, cf. setOverride.
  const followKey = ["user-show", user?.id, userShow.show_id];
  const [pending, setPending] = useState(false);
  // Contrôlé (plutôt que laissé non contrôlé) pour pouvoir fermer
  // explicitement le menu quand on ouvre l'AlertDialog de confirmation
  // depuis l'item "Ne plus suivre" (cf. onSelect ci-dessous), et pour piloter
  // la rotation du chevron du trigger comme les autres disclosures du
  // fichier.
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmUnfollowOpen, setConfirmUnfollowOpen] = useState(false);
  const [unfollowPending, setUnfollowPending] = useState(false);
  // Optimistic UI (cf. CLAUDE.md : jamais d'attente visible sur une action de
  // tracking) : au clic, on affiche immédiatement le résultat attendu, sans
  // attendre la requête ni le refetch déclenché par onChange(). Pour
  // "Abandonner" le nouveau manual_override est connu à l'avance, donc
  // affiché tel quel. Pour "Reprendre le suivi", le statut réel dépend du
  // recalcul serveur (trigger SQL) qu'on ne peut pas prédire côté client : on
  // affiche un badge "Recalcul…" transitoire jusqu'à ce que `userShow`
  // reflète la valeur confirmée.
  const [optimistic, setOptimistic] = useState<{
    manualOverride: "abandonne" | null;
    recalculating: boolean;
  } | null>(null);

  // Une fois que la donnée serveur rattrape la valeur optimiste (après le
  // refetch déclenché par onChange()), on efface l'état local : `userShow`
  // fait alors foi, statut recalculé inclus.
  useEffect(() => {
    if (optimistic && userShow.manual_override === optimistic.manualOverride) {
      setOptimistic(null);
    }
  }, [userShow.manual_override, optimistic]);

  const manualOverride = optimistic ? optimistic.manualOverride : userShow.manual_override;
  const recalculating = optimistic?.recalculating ?? false;

  const setOverride = async (next: "abandonne" | null) => {
    // Annule tout refetch de `followKey` encore en vol (déclenché par un
    // clic précédent via onChange()) avant d'écrire un nouvel état
    // optimiste : sans ça, une réponse obsolète peut résoudre après celle
    // de cette action et écraser le cache avec une donnée périmée, laissant
    // le badge bloqué sur "Recalcul…" (cf. commentaire QA ci-dessus).
    await qc.cancelQueries({ queryKey: followKey });
    setOptimistic({ manualOverride: next, recalculating: next === null });
    setPending(true);
    const { error } = await supabase
      .from("user_shows")
      .update({ manual_override: next })
      .eq("user_id", user!.id)
      .eq("show_id", userShow.show_id);
    setPending(false);
    if (error) {
      setOptimistic(null);
      toast.error(error.message);
      return;
    }
    onChange();
  };

  // "Ne plus suivre" : suppression réelle de la ligne user_shows (jamais de
  // watch_status touché, cf. CLAUDE.md). Contrairement à setOverride, pas
  // d'état optimiste local : après succès, onChange() invalide `followKey`
  // et le composant parent fait redevenir `userShow` null au refetch, ce qui
  // démonte ce composant et fait réapparaître le bouton "Suivre" — même
  // mécanisme que pour un follow initial, en sens inverse. Le clic sur
  // l'AlertDialogAction fait un preventDefault (cf. JSX plus bas) pour garder
  // la boîte de dialogue ouverte, boutons désactivés, le temps de la requête,
  // plutôt que de la fermer instantanément sans retour visuel.
  const handleUnfollow = async () => {
    setUnfollowPending(true);
    try {
      await unfollowShow(user!.id, userShow.show_id);
      setConfirmUnfollowOpen(false);
      onChange();
      qc.invalidateQueries({ queryKey: ["followed-keys", user?.id] });
      qc.invalidateQueries({ queryKey: ["home-schedule", user?.id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de retirer cette série");
    } finally {
      setUnfollowPending(false);
    }
  };

  // Statut "effectif" affiché par le badge : l'override s'il est actif,
  // sinon le statut calculé. `abandonne`/`archive` partagent le même style
  // neutre que `a_voir` (cf. TV_STATUS_BADGE_STYLES) — sans texte de légende
  // sous le badge, un signal non-textuel (icône Ban) est nécessaire pour ne
  // pas rendre un statut figé indiscernable de "à voir".
  const effectiveStatus = manualOverride ?? userShow.status;
  const isOverrideState =
    !recalculating && (effectiveStatus === "abandonne" || effectiveStatus === "archive");

  const badgeLabel = recalculating
    ? "Recalcul…"
    : manualOverride
      ? STATUS_LABELS[manualOverride]
      : (STATUS_LABELS[userShow.status] ?? userShow.status);
  const badgeStyle = recalculating
    ? "border-border text-muted-foreground"
    : (TV_STATUS_BADGE_STYLES[effectiveStatus] ?? "border-border text-muted-foreground");

  const actionButtonClass =
    "h-11 gap-1.5 border-border bg-card text-foreground hover:bg-surface-elevated";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-counter text-[10px] uppercase tracking-widest ${badgeStyle}`}
        >
          {isOverrideState && <Ban className="h-3 w-3" aria-hidden="true" />}
          {badgeLabel}
        </span>

        {/* modal={false} : évite le bug Radix connu (radix-ui/primitives#3317,
            shadcn-ui/ui#7124) où le pointer-events:none posé sur <body> par un
            DropdownMenu modal peut ne jamais être relâché quand un AlertDialog
            s'ouvre par-dessus (cf. onSelect "Ne plus suivre" ci-dessous), ce
            qui gèlerait toute la page. */}
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending || unfollowPending}
              className={actionButtonClass}
            >
              Gérer le suivi
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${menuOpen ? "rotate-180" : ""}`}
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {manualOverride ? (
              <DropdownMenuItem onClick={() => setOverride(null)}>
                <RotateCcw className="h-3.5 w-3.5" />
                Reprendre le suivi
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => setOverride("abandonne")}>
                <Ban className="h-3.5 w-3.5" />
                Abandonner
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                // preventDefault : évite la fermeture "par défaut" du menu
                // (avec son retour de focus immédiat sur le trigger) pendant
                // que l'AlertDialog s'ouvre. On ferme le menu nous-mêmes juste
                // après via setMenuOpen(false), pour ne jamais le laisser
                // réapparaître visuellement derrière une fois l'AlertDialog
                // fermé (annulation ou confirmation).
                e.preventDefault();
                setMenuOpen(false);
                setConfirmUnfollowOpen(true);
              }}
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Ne plus suivre
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={confirmUnfollowOpen} onOpenChange={setConfirmUnfollowOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ne plus suivre {showTitle} ?</AlertDialogTitle>
            <AlertDialogDescription>
              La série sera retirée de votre bibliothèque. Votre historique d'épisodes vus est
              conservé — vous le retrouverez si vous suivez à nouveau la série.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unfollowPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleUnfollow();
              }}
              disabled={unfollowPending}
              className={cn(buttonVariants({ variant: "destructive" }))}
            >
              Ne plus suivre
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
