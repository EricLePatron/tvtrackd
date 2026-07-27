import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  Ban,
  Check,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  Play,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { BackButton } from "@/components/back-button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAuthGate } from "@/hooks/use-auth-gate";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useInViewOnce } from "@/hooks/use-in-view-once";
import { useRollingNumber } from "@/hooks/use-rolling-number";
import { followShow, unfollowShow } from "@/lib/follow-show";
import { formatApproxHours } from "@/lib/watch-time";

import { APP_NAME } from "@/lib/app-config";
import { VhsCounter } from "@/components/vhs-counter";
import { SeasonToggle } from "@/components/season-toggle";
import { ShowToggle } from "@/components/show-toggle";
import { StatusPill, type PillTone } from "@/components/status-pill";
import { NetworkLine, WhereToWatch } from "@/components/where-to-watch";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buttonVariants } from "@/components/ui/button";
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
import { CastRail } from "@/components/show/cast-rail";
import { StarRating } from "@/components/show/star-rating";
import { ShareWatchDialog } from "@/components/share-watch-dialog";
import { SITE_URL } from "@/lib/app-config";
import {
  fetchShowDetails,
  showDetailsQueryKey,
  type EpisodeRow,
  type ShowDetails,
  type ShowRow,
} from "@/lib/show-details";
import { fetchShowCredits, type CastMember } from "@/hooks/use-show-credits";
import { fetchSimilarMedia } from "@/hooks/use-similar-media";
import type { TrendingItem } from "@/components/home/discovery-grid";
import { retry } from "@/lib/retry";

type ShowRouteLoaderData = ShowDetails & {
  /** Best-effort (Promise.allSettled) — [] si l'appel échoue, jamais bloquant. */
  cast: CastMember[];
  similar: TrendingItem[];
};

// Coupe proprement une description TMDb à une longueur raisonnable pour une
// meta description, sur une frontière de mot (pas de troncature en plein mot).
function truncateForMeta(text: string, max = 155): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : max)}…`;
}

function settledOrEmpty<T>(result: PromiseSettledResult<T[]>, label: string): T[] {
  if (result.status === "fulfilled") return result.value;
  // Best-effort : casting/similaires ne doivent jamais faire échouer le SSR
  // de toute la fiche — un log suffit, le client réessaiera via useQuery.
  console.error(`[show loader] ${label} failed (best-effort, ignored)`, result.reason);
  return [];
}

export const Route = createFileRoute("/_public/show/$mediaType/$tmdbId")({
  component: ShowDetail,
  loader: async ({ params }): Promise<ShowRouteLoaderData> => {
    const tmdbId = Number(params.tmdbId);
    const mediaType = params.mediaType;
    const [detailsResult, castResult, similarResult] = await Promise.allSettled([
      // `get-show-details` est la seule requête critique (titre/synopsis/
      // saisons/épisodes alimentent `head()` et le corps de la page) — un
      // `loader` ne bénéficiant pas du retry par défaut de react-query
      // (contrairement au `useQuery` équivalent avant le passage en SSR),
      // `retry` restaure ce filet pour une erreur TMDb transitoire (QA P0-1,
      // majeur #3). Casting/similaires restent sans retry : best-effort pur,
      // un échec (transitoire ou non) doit juste rendre un tableau vide, pas
      // consommer du temps supplémentaire à bloquer le SSR.
      retry(() => fetchShowDetails(tmdbId, mediaType)),
      fetchShowCredits(tmdbId, mediaType),
      fetchSimilarMedia(tmdbId, mediaType),
    ]);
    // Un échec ici (même après retry) doit remonter à
    // `errorComponent`/`notFoundComponent`, pas être avalé silencieusement.
    if (detailsResult.status === "rejected") throw detailsResult.reason;
    return {
      ...detailsResult.value,
      cast: settledOrEmpty(castResult, "show-credits"),
      similar: settledOrEmpty(similarResult, "similar-media"),
    };
  },
  head: ({ params, loaderData }) => {
    const kind = params.mediaType === "movie" ? "Film" : "Série";
    const show = loaderData?.show;
    const canonicalUrl = `${SITE_URL}/show/${params.mediaType}/${params.tmdbId}`;

    // Filet de sécurité : si le loader n'a exceptionnellement pas encore de
    // données (ne devrait pas arriver, le loader ci-dessus fait échouer la
    // route sinon), on retombe sur le comportement générique précédent
    // plutôt que de planter `head()`.
    if (!show) {
      return {
        meta: [
          { title: `${kind} sur ${APP_NAME} — fiche détaillée` },
          {
            name: "description",
            content: `Fiche ${kind.toLowerCase()} sur ${APP_NAME} : synopsis, saisons, épisodes, plateformes de diffusion et suivi personnel de votre visionnage.`,
          },
        ],
        links: [{ rel: "canonical", href: canonicalUrl }],
      };
    }

    const year = show.first_air_date ? show.first_air_date.slice(0, 4) : null;
    const titleSuffix = year ? ` (${year})` : "";
    const title = `${show.title}${titleSuffix} — ${kind.toLowerCase()} : épisodes, casting et où regarder — ${APP_NAME}`;
    const baseDescription = show.overview
      ? truncateForMeta(show.overview)
      : `Suivi épisode par épisode de ${show.title} sur ${APP_NAME} : saisons, casting et plateformes de diffusion.`;

    return {
      meta: [
        { title },
        { name: "description", content: baseDescription },
        { property: "og:title", content: title },
        { property: "og:description", content: baseDescription },
        {
          property: "og:type",
          content: params.mediaType === "movie" ? "video.movie" : "video.tv_show",
        },
        { property: "og:url", content: canonicalUrl },
        ...(show.poster_path ? [{ property: "og:image", content: show.poster_path }] : []),
      ],
      links: [{ rel: "canonical", href: canonicalUrl }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": params.mediaType === "movie" ? "Movie" : "TVSeries",
            url: canonicalUrl,
            name: show.title,
            description: baseDescription,
            ...(show.poster_path ? { image: show.poster_path } : {}),
            ...(show.first_air_date ? { datePublished: show.first_air_date } : {}),
            inLanguage: "fr-FR",
            sameAs: `https://www.themoviedb.org/${params.mediaType}/${params.tmdbId}`,
          }),
        },
      ],
    };
  },
  // `<BackButton />` dans les deux fallbacks (QA P0-1, majeur #3) : cette
  // route devient atteignable en erreur plus souvent qu'avant (fetch critique
  // dans un `loader`, cf. `retry` ci-dessus) — sans bouton retour, un
  // utilisateur qui atterrit ici est bloqué sur un écran sans issue.
  errorComponent: ({ error }) => (
    <div className="p-6">
      <BackButton fallbackTo="/search" />
      <p className="mt-4 text-sm text-destructive">Erreur : {error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-6">
      <BackButton fallbackTo="/search" />
      <p className="mt-4 text-sm text-muted-foreground">Introuvable.</p>
    </div>
  ),
});

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

// Statuts TMDb "toujours en vie" (diffusion/production en cours ou à venir) :
// seuls ceux-là justifient le point pulsant ambre dans l'eyebrow du hero.
// `Ended`/`Canceled` (et le reste des statuts films) restent en muted, sans
// point — une série annulée n'est pas "en vie".
const LIVE_TMDB_STATUSES = new Set(["Returning Series", "In Production", "Planned", "Pilot"]);

const pad = (n: number) => n.toString().padStart(2, "0");

// Attend un cycle de commit + peinture (double rAF) avant de scroller vers un
// id du DOM — nécessaire depuis le passage des saisons en accordéons Radix
// fermés par défaut : ouvrir une saison (state React) puis scroller vers un
// de ses épisodes doit laisser le temps au DOM de refléter l'ouverture.
// Inoffensif si l'élément était déjà visible (le double rAF ne fait que
// retarder le scroll de 2 frames dans ce cas).
function scrollToIdSoon(domId: string) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const target = document.getElementById(domId);
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (target instanceof HTMLElement) target.focus({ preventScroll: true });
    });
  });
}

function ShowDetail() {
  const { mediaType, tmdbId } = Route.useParams();
  const { user } = useAuth();
  const { requireAuth } = useAuthGate();
  const qc = useQueryClient();
  // Verrou par épisode, partagé entre toggleWatched et toggleSeason : les deux
  // actions touchent la même ligne watch_status pour un épisode donné, donc
  // ni isPending ni variables (qui ne reflètent que le DERNIER mutate() sur
  // une instance de mutation partagée par toute la liste) ne suffisent à
  // empêcher des requêtes concurrentes sur le même épisode.
  const [lockedEpisodes, setLockedEpisodes] = useState<Set<number>>(new Set());
  const [overviewExpanded, setOverviewExpanded] = useState(false);
  const [isOverviewTruncated, setIsOverviewTruncated] = useState(false);
  const overviewRef = useRef<HTMLParagraphElement>(null);
  // Saisons dépliées (fermées par défaut, cf. refonte fiche série) : contrôlé
  // plutôt que laissé non contrôlé pour pouvoir forcer l'ouverture d'une
  // saison depuis "À voir maintenant" / "Revoir depuis le début".
  const [openSeasons, setOpenSeasons] = useState<string[]>([]);

  // Préchargé côté serveur par le `loader` de la route (cf. P0-1 SEO) : même
  // clé de query, même fetch (`fetchShowDetails`) que ce que faisait cet
  // écran en pur CSR auparavant — seul le "quand" change (avant l'hydratation
  // plutôt qu'après). `staleTime` évite un refetch client immédiat alors que
  // la donnée vient tout juste d'être chargée côté serveur, sans empêcher les
  // navigations SPA ultérieures (cache TMDb côté edge function reste la seule
  // source de vérité sur la fraîcheur réelle).
  const loaderData = Route.useLoaderData();
  const detailsKey = showDetailsQueryKey(mediaType, tmdbId);
  // Objet dédié (pas `loaderData` tel quel, qui porte aussi `cast`/`similar`)
  // pour que `initialData` corresponde exactement au type `ShowDetails`
  // renvoyé par `queryFn` — sinon l'inférence de `TData` de `useQuery` se
  // dégrade et fait perdre le typage de `data` plus bas dans ce composant.
  const detailsInitialData: ShowDetails = {
    show: loaderData.show,
    seasons: loaderData.seasons,
    episodes: loaderData.episodes,
  };
  const { data, isLoading, error } = useQuery({
    queryKey: detailsKey,
    queryFn: () => fetchShowDetails(Number(tmdbId), mediaType),
    initialData: detailsInitialData,
    staleTime: 60 * 1000,
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
  // saison) : `status`/`manual_override` peuvent changer côté SQL (triggers de
  // la migration auto_status) et le statut affiché plus haut sur cette page
  // doit refléter ce changement sans attendre une renavigation.
  // Si l'override valait "abandonne" juste avant l'action et vaut `null`
  // après refetch, ça signifie que le trigger SQL vient de lever la reprise
  // de suivi implicite (nouvel épisode marqué vu) : on l'annonce par un
  // toast, plutôt que de laisser le statut changer silencieusement.
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
      toast.success("Suivi repris automatiquement.");
    }
  };

  // Note (Lot 1 Home optimistic mark-watched) : `toggleWatched`/`toggleSeason`
  // ci-dessous font un rollback par snapshot complet (`ctx.prev` capturé à
  // l'onMutate) — ce schéma N'EST PAS concurrency-safe entre deux mutations
  // qui se chevauchent (le rollback de la plus ancienne peut écraser
  // l'optimisme d'une mutation plus récente encore en vol). C'est atténué ici
  // par `lockedEpisodes` (verrou explicite empêchant deux mutations
  // concurrentes sur le même épisode) mais reste un point faible générique
  // face à des épisodes DIFFÉRENTS mutés coup sur coup. `useMarkWatched`
  // (Home, `use-mark-watched.ts`) adopte volontairement un modèle plus
  // robuste (base + ensemble d'ids "en vol", jamais un snapshot complet) —
  // ne pas "réaligner" ce fichier dessus par réflexe, c'est un choix
  // scope-limité au Lot 1 Home, pas un refactor de cette page.
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

  // Bulk (marquer/démarquer toute une saison). Réutilise le même verrou par
  // épisode que toggleWatched pour empêcher un clic individuel concurrent
  // pendant l'opération groupée.
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

  // État d'override optimiste TV (Abandonner / Reprendre le suivi / Ne plus
  // suivre) : partagé entre le kebab-menu (hero) et la pastille de statut
  // (ProgressCard), qui vivent maintenant dans deux endroits différents de la
  // page mais doivent refléter exactement le même état pendant le court
  // instant entre le clic et le refetch. Appelé inconditionnellement (règle
  // des hooks) ; no-op tant que `userShow`/`user` ne sont pas encore chargés.
  const tvOverride = useTvOverride({
    userShow: userShow ?? null,
    followKey,
    onChanged: () => qc.invalidateQueries({ queryKey: followKey }),
  });

  const goToEpisode = (episode: EpisodeRow) => {
    setOpenSeasons((prev) =>
      prev.includes(String(episode.season_number))
        ? prev
        : [...prev, String(episode.season_number)],
    );
    scrollToIdSoon(`episode-${episode.id}`);
  };

  const goToSeason = (seasonNumber: number) => {
    setOpenSeasons((prev) =>
      prev.includes(String(seasonNumber)) ? prev : [...prev, String(seasonNumber)],
    );
    // Cible le trigger de l'accordéon (un vrai <button>, focusable), pas le
    // conteneur `AccordionItem` (un <div> sans tabIndex) : sinon `.focus()`
    // dans `scrollToIdSoon` est un no-op silencieux, cf. bug QA.
    scrollToIdSoon(`season-trigger-${seasonNumber}`);
  };

  if (isLoading || !data) {
    return (
      <div>
        <div className="h-72 w-full animate-pulse bg-surface-elevated" />
        <div className="mx-5 mt-4 space-y-3">
          <div className="h-28 w-full animate-pulse rounded-2xl bg-surface-elevated" />
          <div className="h-20 w-full animate-pulse rounded-2xl bg-surface-elevated" />
        </div>
        <div className="mx-5 mt-6 space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-surface-elevated" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-surface-elevated" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-surface-elevated" />
        </div>
        <div className="mx-5 mt-6 space-y-3">
          <div className="h-5 w-28 animate-pulse rounded bg-surface-elevated" />
          <div className="h-14 w-full animate-pulse rounded-xl bg-surface-elevated" />
          <div className="h-14 w-full animate-pulse rounded-xl bg-surface-elevated" />
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
  const isLiveStatus = !!show.status && LIVE_TMDB_STATUSES.has(show.status);

  const today = new Date().toISOString().slice(0, 10);
  const upcomingEpisodes =
    mediaType === "tv"
      ? episodes
          .filter((e) => e.air_date && e.air_date >= today)
          .sort((a, b) => (a.air_date! < b.air_date! ? -1 : 1))
      : [];


  const firstUnwatched =
    mediaType === "tv"
      ? episodes.find(
          (e) => (watched?.[e.id]?.count ?? 0) === 0 && e.air_date && e.air_date <= today,
        )
      : undefined;
  const hasAiredEpisodes =
    mediaType === "tv" && episodes.some((e) => e.air_date && e.air_date <= today);
  const totalWatchedEpisodes = episodes.filter((e) => (watched?.[e.id]?.count ?? 0) > 0).length;

  return (
    <>
      <Hero
        show={show}
        mediaType={mediaType}
        year={year}
        statusLabel={statusLabel}
        isLiveStatus={isLiveStatus}
        userShow={userShow ?? null}
        onFollow={() =>
          requireAuth(() => follow.mutate(), {
            reason: "suivre cette série",
            intent: {
              kind: "follow",
              tmdbId: Number(tmdbId),
              mediaType: mediaType as "tv" | "movie",
            },
          })
        }
        followPending={follow.isPending}
        tvOverride={tvOverride}
      />

      {mediaType === "tv" && <NetworkLine networks={show.networks} />}

      {mediaType === "tv" && userShow && (
        <div className="mx-5 mt-4">
          <ProgressCard
            status={userShow.status}
            manualOverride={tvOverride.manualOverride}
            recalculating={tvOverride.recalculating}
            totalWatchedEpisodes={totalWatchedEpisodes}
            totalEpisodes={episodes.length}
            firstUnwatched={firstUnwatched}
            hasAiredEpisodes={hasAiredEpisodes}
            onResumeClick={goToEpisode}
            onRestart={() => seasons[0] && goToSeason(seasons[0].season_number)}
            onResumeFollowing={() => tvOverride.setOverride(null)}
          />
        </div>
      )}

      {mediaType === "tv" && upcomingEpisodes.length > 0 && (
        <div className="mx-5 mt-3">
          <UpcomingSchedule episodes={upcomingEpisodes} />
        </div>
      )}


      {mediaType !== "tv" && userShow && (
        <div className="mx-5 mt-4">
          <MovieStatusPicker
            userShow={userShow}
            onChange={() => qc.invalidateQueries({ queryKey: followKey })}
          />
        </div>
      )}

      {show.overview && (
        <div className="mx-5 mt-6">
          <p className="font-counter text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
            Synopsis
          </p>
          <p
            ref={overviewRef}
            className={cn(
              "mt-1.5 text-sm leading-relaxed text-muted-foreground",
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

      <StarRating showId={show.id} />

      <WhereToWatch showTitle={show.title} watchProviders={show.watch_providers} />

      {mediaType === "tv" && (() => {
        const showEligible = episodes.filter((e) => !(e.air_date && e.air_date > today));
        const showEligibleWatched = showEligible.filter(
          (e) => (watched?.[e.id]?.count ?? 0) > 0,
        ).length;
        const showState: boolean | "indeterminate" =
          showEligible.length === 0 || showEligibleWatched === 0
            ? false
            : showEligibleWatched === showEligible.length
              ? true
              : "indeterminate";
        const showAnyLocked = episodes.some((e) => lockedEpisodes.has(e.id));
        const showToggleDisabled =
          showAnyLocked || (showEligible.length === 0 && totalWatchedEpisodes === 0);

        const markShowWatched = () =>
          requireAuth(
            () => {
              if (showAnyLocked) return;
              const ids = showEligible
                .filter((e) => (watched?.[e.id]?.count ?? 0) === 0)
                .map((e) => e.id);
              if (!ids.length) return;
              setLockedEpisodes((prev) => {
                const next = new Set(prev);
                ids.forEach((id) => next.add(id));
                return next;
              });
              toggleSeason.mutate({ action: "mark", episodeIds: ids });
            },
            { reason: "marquer cette série" },
          );

        const unmarkShowWatched = () =>
          requireAuth(
            () => {
              if (showAnyLocked) return;
              const ids = episodes
                .filter((e) => (watched?.[e.id]?.count ?? 0) > 0)
                .map((e) => e.id);
              if (!ids.length) return;
              setLockedEpisodes((prev) => {
                const next = new Set(prev);
                ids.forEach((id) => next.add(id));
                return next;
              });
              toggleSeason.mutate({ action: "unmark", episodeIds: ids });
            },
            { reason: "démarquer cette série" },
          );

        return (
        <div className="mt-6 px-5 pb-24">
          <p className="font-counter text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
            Saisons
          </p>
          <ShowToggle
            state={showState}
            disabled={showToggleDisabled}
            onMark={markShowWatched}
            onUnmark={unmarkShowWatched}
          />
          <Accordion
            type="multiple"
            value={openSeasons}
            onValueChange={setOpenSeasons}
            className="mt-3"
          >
            {seasons.map((s) => {
              const eps = episodes.filter((e) => e.season_number === s.season_number);
              const watchedCount = eps.filter((e) => (watched?.[e.id]?.count ?? 0) > 0).length;
              const last = eps[eps.length - 1]?.episode_number ?? 0;
              const seasonPct = eps.length ? Math.min(100, (watchedCount / eps.length) * 100) : 0;
              // Lisibilité de l'état accordéon fermé : "vue" seulement si
              // TOUS les épisodes de la saison sont marqués vus (même total
              // que la mini-barre, `eps.length` — pas `eligibleEpisodes`
              // ci-dessous). Une saison encore en diffusion n'atteint donc
              // jamais cet état tant qu'il reste des épisodes à venir non
              // vus : elle affiche le compteur (ex. 08/10), pas le check —
              // c'est le comportement voulu.
              const isSeasonDone = eps.length > 0 && watchedCount === eps.length;

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
                    const ids = eps
                      .filter((e) => (watched?.[e.id]?.count ?? 0) > 0)
                      .map((e) => e.id);
                    if (!ids.length) return;
                    lockEpisodes(ids);
                    toggleSeason.mutate({ action: "unmark", episodeIds: ids });
                  },
                  { reason: "démarquer cette saison" },
                );

              return (
                <AccordionItem
                  key={s.id}
                  value={String(s.season_number)}
                  id={`season-${s.season_number}`}
                  className="scroll-mt-6 border-b border-white/[0.06] last:border-b-0"
                >
                  <AccordionTrigger
                    id={`season-trigger-${s.season_number}`}
                    className="py-4 hover:no-underline"
                  >
                    <span className="flex flex-1 items-center justify-between gap-3">
                      <span className="font-display text-base text-foreground">
                        Saison {s.season_number}
                      </span>
                      {/* État lisible accordéon fermé : terminée (check +
                          "Vue", pas de barre) / en cours (compteur cyan +
                          barre) / pas commencée (compteur muted + barre
                          vide) — cf. décision produit, mêmes données que la
                          mini-barre (watchedCount/eps.length). */}
                      {isSeasonDone ? (
                        <span className="flex shrink-0 items-center gap-1 whitespace-nowrap font-counter text-[10px] uppercase tracking-[0.14em] text-cyan-accent">
                          <Check className="h-[15px] w-[15px]" aria-hidden="true" />
                          Vue
                        </span>
                      ) : (
                        <span className="flex shrink-0 items-center gap-2 whitespace-nowrap">
                          <span className="font-counter text-[12.5px] tabular-nums">
                            <span
                              className={
                                watchedCount > 0 ? "text-cyan-accent" : "text-muted-foreground"
                              }
                            >
                              {pad(watchedCount)}
                            </span>
                            <span className="text-muted-foreground">/{pad(eps.length)}</span>
                          </span>
                          <span className="h-[3px] w-11 shrink-0 overflow-hidden rounded-full bg-white/[0.09]">
                            <span
                              className="block h-full rounded-full bg-cyan-accent"
                              style={{ width: `${seasonPct}%` }}
                            />
                          </span>
                        </span>
                      )}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <VhsCounter
                      seasonNumber={s.season_number}
                      lastEpisode={last}
                      watched={watchedCount}
                      total={eps.length}
                    />
                    <SeasonToggle
                      seasonNumber={s.season_number}
                      state={seasonState}
                      disabled={seasonToggleDisabled}
                      onMark={markSeasonWatched}
                      onUnmark={unmarkSeasonWatched}
                    />
                    {/* Partage social : proposé uniquement quand la saison est
                        effectivement vue en entier — sinon il n'y a rien à
                        annoncer. */}
                    {seasonState === true && (
                      <ShareWatchDialog
                        triggerVariant="button"
                        triggerLabel="Partager cette saison"
                        title={show.title}
                        counter={`Saison ${pad(s.season_number)}`}
                        subtitle={`${watchedCount} épisode${watchedCount > 1 ? "s" : ""} vu${watchedCount > 1 ? "s" : ""}`}
                        posterUrl={show.poster_path}
                        badge="Saison terminée"
                        shareUrl={`${SITE_URL}/show/${mediaType}/${tmdbId}`}
                        caption={`J'ai terminé la saison ${s.season_number} de ${show.title} 📺`}
                      />
                    )}
                    <ul className="mt-3.5 flex flex-col">
                      {eps.map((e) => {
                        const count = watched?.[e.id]?.count ?? 0;
                        const isWatched = count > 0;
                        const isLocked = lockedEpisodes.has(e.id);
                        const lockEpisode = () =>
                          setLockedEpisodes((prev) => new Set(prev).add(e.id));
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
                            isTogglePending={isLocked}
                            share={
                              isWatched ? (
                                <ShareWatchDialog
                                  title={show.title}
                                  counter={`S${pad(e.season_number)}E${pad(e.episode_number)}`}
                                  subtitle={e.title}
                                  posterUrl={show.poster_path}
                                  badge="Épisode vu"
                                  shareUrl={`${SITE_URL}/show/${mediaType}/${tmdbId}`}
                                  caption={`Je viens de voir ${show.title} S${pad(e.season_number)}E${pad(e.episode_number)} 📺`}
                                />
                              ) : null
                            }
                          />
                        );
                      })}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
        );
      })()}


      <div className="mx-5 pb-24">
        {/* `initialData` seulement si le loader a effectivement trouvé quelque
            chose : un tableau vide peut aussi bien signifier "aucun casting
            connu" que "l'appel best-effort a échoué côté serveur" — dans le
            doute, on laisse le hook client retenter plutôt que de figer un
            résultat vide pendant tout le staleTime (1h). */}
        <CastRail
          tmdbId={tmdbId}
          mediaType={mediaType}
          initialData={loaderData.cast.length ? loaderData.cast : undefined}
        />
        <SimilarRail
          tmdbId={tmdbId}
          mediaType={mediaType}
          initialData={loaderData.similar.length ? loaderData.similar : undefined}
        />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Hero immersif
// ---------------------------------------------------------------------------

function Hero({
  show,
  mediaType,
  year,
  statusLabel,
  isLiveStatus,
  userShow,
  onFollow,
  followPending,
  tvOverride,
}: {
  show: ShowRow;
  mediaType: string;
  year: string;
  statusLabel: string | undefined;
  isLiveStatus: boolean;
  userShow: UserShowRow | null;
  onFollow: () => void;
  followPending: boolean;
  tvOverride: ReturnType<typeof useTvOverride>;
}) {
  const reducedMotion = useReducedMotion();
  const driftRef = useRef<HTMLDivElement>(null);

  // Fondu/dérive léger du bloc titre au scroll (statique par ailleurs — pas de
  // parallax sur le backdrop lui-même, cf. brief design : zéro jank iOS).
  // L'app scrolle le document (pas de conteneur `overflow-y-auto` imbriqué,
  // cf. `AppShell`), donc l'écouteur est posé sur `window`.
  useEffect(() => {
    const el = driftRef.current;
    if (!el) return;
    if (reducedMotion) {
      // Repli neutre explicite : couvre à la fois le montage initial avec
      // reduced-motion déjà actif, et le cas où l'utilisateur bascule le
      // réglage OS en cours de session (le cleanup de l'effet précédent,
      // ci-dessous, s'en charge aussi — les deux se recouvrent sans risque).
      el.style.transform = "";
      el.style.opacity = "";
      return;
    }
    const onScroll = () => {
      const st = window.scrollY;
      const f = Math.min(st / 240, 1);
      el.style.transform = `translateY(${st * 0.22}px)`;
      el.style.opacity = String(1 - f * 0.85);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      // Ne jamais laisser le hero figé décalé/estompé si `reducedMotion`
      // devient actif entre-temps (changement de réglage OS en cours de
      // session) ou au démontage.
      el.style.transform = "";
      el.style.opacity = "";
    };
  }, [reducedMotion]);

  return (
    <section className="relative isolate flex min-h-[300px] flex-col overflow-hidden px-5 pb-5 pt-6">
      <div aria-hidden className="absolute inset-0 -z-20">
        {show.backdrop_path ? (
          <img src={show.backdrop_path} alt="" className="h-full w-full object-cover object-top" />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background:
                "radial-gradient(120% 90% at 72% 18%, rgba(255,138,61,0.30) 0%, rgba(255,138,61,0) 55%)," +
                "radial-gradient(120% 100% at 20% 6%, rgba(77,217,196,0.22) 0%, rgba(77,217,196,0) 50%)," +
                "linear-gradient(180deg, #1a2330 0%, #10161f 60%, var(--background) 100%)",
            }}
          />
        )}
      </div>
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 -z-10 h-[62%] bg-gradient-to-b from-background/0 via-background/75 to-background"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-24 bg-gradient-to-b from-background/70 to-transparent"
      />

      <div className="relative flex items-center justify-between gap-2.5">
        <BackButton
          fallbackTo="/search"
          className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background/50 text-foreground backdrop-blur-sm"
        />
        {mediaType === "tv" && userShow && (
          <TvFollowMenu showTitle={show.title} tvOverride={tvOverride} />
        )}
      </div>

      <div ref={driftRef} className="relative mt-auto flex items-end gap-3.5 will-change-transform">
        <div className="h-[99px] w-[66px] shrink-0 overflow-hidden rounded-lg border border-white/[0.14] bg-gradient-to-br from-surface-elevated to-background shadow-[0_12px_28px_-10px_rgba(0,0,0,0.85)]">
          {show.poster_path && (
            <img src={show.poster_path} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="mb-2 flex flex-wrap items-center gap-2 font-counter text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
            <span>
              {mediaType === "tv" ? "Série" : "Film"} · {year}
            </span>
            {statusLabel &&
              (isLiveStatus ? (
                <span className="inline-flex items-center gap-1.5 text-primary">
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                  {statusLabel}
                </span>
              ) : (
                <span>{statusLabel}</span>
              ))}
          </p>
          <h1
            className="font-display text-[28px] leading-[1.05] text-foreground line-clamp-2"
            style={{ textShadow: "0 2px 20px rgba(0,0,0,0.6)" }}
          >
            {show.title}
          </h1>
          {show.tagline && (
            <p className="mt-2 text-sm italic leading-snug text-[#cfd6e2] line-clamp-2">« {show.tagline} »</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3.5">
            {!!show.vote_average && (
              <span className="inline-flex items-baseline gap-0.5 rounded-full border border-cyan-accent/40 bg-cyan-accent/10 px-2.5 py-1 font-counter text-[13px] tabular-nums text-cyan-accent">
                {show.vote_average.toFixed(1)}
                <small className="text-[10px] text-cyan-accent/65">/10</small>
              </span>
            )}
            {(show.genres ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {show.genres!.map((genre) => (
                  <span
                    key={genre}
                    className="rounded-full border border-border bg-background/35 px-2.5 py-0.5 text-[11px] text-muted-foreground"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}
          </div>
          {!userShow && (
            <div className="mt-4 flex flex-col items-start gap-1.5">
              <button
                type="button"
                onClick={onFollow}
                disabled={followPending}
                className="inline-flex h-11 items-center gap-1.5 rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground disabled:opacity-60"
              >
                <Plus className="h-3.5 w-3.5" />
                Suivre
              </button>
              {mediaType === "tv" && (
                <span className="font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
                  Suivez cette série pour activer le compteur
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Pastille de statut (calculée, lecture seule)
// ---------------------------------------------------------------------------
// `PillTone`/`StatusPill` (composant + tokens de couleur) vivent désormais
// dans src/components/status-pill.tsx — partagés avec les onglets de statut
// de la bibliothèque (library.tsx). `tvPillState` ci-dessous reste local :
// c'est de la logique métier propre à cette page (manual_override,
// hasAiredEpisodes...), pas un token de présentation réutilisable.

// Calcule le libellé/ton de la pastille "Votre progression". Ajoute un état
// "À jour" purement présentational, absent de `user_shows.status` (qui ne
// vaut jamais "termine" tant que la série diffuse encore, cf.
// `compute_tv_status` en base) : dérivé ici de `!firstUnwatched` sur les
// épisodes déjà diffusés, jamais persisté, n'affecte aucun autre écran
// (bibliothèque, etc.) qui continue de lire `STATUS_LABELS` tel quel.
function tvPillState({
  manualOverride,
  recalculating,
  status,
  hasAiredEpisodes,
  firstUnwatchedExists,
}: {
  manualOverride: string | null;
  recalculating: boolean;
  status: string;
  hasAiredEpisodes: boolean;
  firstUnwatchedExists: boolean;
}): { label: string; tone: PillTone } {
  if (recalculating) return { label: "Recalcul…", tone: "muted" };
  if (manualOverride)
    return { label: STATUS_LABELS[manualOverride] ?? manualOverride, tone: "muted" };
  if (status === "termine") return { label: "Terminé", tone: "cyan" };
  if (hasAiredEpisodes && !firstUnwatchedExists) return { label: "À jour", tone: "cyan" };
  if (status === "en_cours") return { label: "En cours", tone: "amber" };
  return { label: STATUS_LABELS[status] ?? status, tone: "muted" };
}

// ---------------------------------------------------------------------------
// Carte "Votre progression"
// ---------------------------------------------------------------------------

function ProgressCard({
  status,
  manualOverride,
  recalculating,
  totalWatchedEpisodes,
  totalEpisodes,
  firstUnwatched,
  hasAiredEpisodes,
  onResumeClick,
  onRestart,
  onResumeFollowing,
}: {
  status: string;
  manualOverride: string | null;
  recalculating: boolean;
  totalWatchedEpisodes: number;
  totalEpisodes: number;
  firstUnwatched: EpisodeRow | undefined;
  hasAiredEpisodes: boolean;
  onResumeClick: (episode: EpisodeRow) => void;
  onRestart: () => void;
  onResumeFollowing: () => void;
}) {
  const { ref, inView } = useInViewOnce<HTMLDivElement>();
  const reducedMotion = useReducedMotion();
  const { display, bump } = useRollingNumber(totalWatchedEpisodes, {
    enabled: inView,
    reducedMotion,
  });
  const displayPct = totalEpisodes ? Math.min(100, (display / totalEpisodes) * 100) : 0;

  const isAbandoned = !!manualOverride;
  const isDone = !manualOverride && status === "termine";
  const isCaughtUp = !manualOverride && status !== "termine" && hasAiredEpisodes && !firstUnwatched;

  const pill = tvPillState({
    manualOverride,
    recalculating,
    status,
    hasAiredEpisodes,
    firstUnwatchedExists: !!firstUnwatched,
  });

  return (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl border border-white/[0.07] bg-white/[0.018] p-[18px]",
        "opacity-0 translate-y-3 transition-[opacity,transform] duration-500 ease-out",
        "motion-reduce:opacity-100 motion-reduce:translate-y-0 motion-reduce:transition-none",
        inView && "opacity-100 translate-y-0",
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-2.5">
        <span className="font-counter text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
          Votre progression
        </span>
        <StatusPill label={pill.label} tone={pill.tone} />
      </div>

      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="flex items-baseline gap-1 font-counter tabular-nums">
          <span
            className={cn(
              "text-[36px] leading-none transition-transform motion-reduce:transition-none",
              isAbandoned ? "text-muted-foreground" : "text-cyan-accent",
              bump && !isAbandoned && "scale-110",
            )}
          >
            {display}
          </span>
          <span className="text-xl leading-none text-muted-foreground">/{totalEpisodes}</span>
        </span>
        <span className="font-counter text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground">
          épisodes vus
        </span>
      </div>

      <div className="h-1 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none",
            isAbandoned ? "bg-muted-foreground/60" : "bg-cyan-accent",
          )}
          style={{ width: `${displayPct}%` }}
        />
      </div>

      <p className="mt-3 text-[12.5px] text-muted-foreground">
        <b className="font-medium text-foreground/80">{formatApproxHours(totalWatchedEpisodes)}</b>{" "}
        de visionnage
        {isAbandoned && " · en pause"}
      </p>

      {!isAbandoned && !isDone && firstUnwatched && (
        <button
          type="button"
          onClick={() => onResumeClick(firstUnwatched)}
          className="mt-3.5 block w-full border-t border-white/[0.06] pt-3.5 text-left"
        >
          <span className="mb-2 block font-counter text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
            À voir maintenant
          </span>
          <span className="flex items-center gap-2.5">
            <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
              <Play className="h-3 w-3 translate-x-px" fill="currentColor" />
            </span>
            <span className="shrink-0 font-counter text-xs font-semibold text-primary">
              S{pad(firstUnwatched.season_number)}E{pad(firstUnwatched.episode_number)}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13.5px] text-foreground">
              {firstUnwatched.title ?? "—"}
            </span>
          </span>
        </button>
      )}

      {!isAbandoned && isCaughtUp && (
        <div className="mt-3.5 flex items-center gap-2 border-t border-white/[0.06] pt-3.5 font-counter text-[11px] text-cyan-accent">
          <Check className="h-3.5 w-3.5" />
          Vous avez tout vu jusqu'ici.
        </div>
      )}

      {isDone && (
        <>
          <div className="mt-3.5 flex items-center gap-2 border-t border-white/[0.06] pt-3.5 font-counter text-[11px] text-cyan-accent">
            <Check className="h-3.5 w-3.5" />À jour sur toute la série.
          </div>
          {/* Navigation seule (scroll + ouverture de la saison 1) : la refonte
              retire l'UI de rewatch (cf. EpisodeRow), donc ce lien ne
              déclenche aucune mutation "tout remarquer non vu". */}
          <button
            type="button"
            onClick={onRestart}
            className="mt-3 flex h-11 w-full items-center gap-2 text-sm text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
            Revoir depuis le début
            <ChevronRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </>
      )}

      {isAbandoned && (
        <button
          type="button"
          onClick={onResumeFollowing}
          className="mt-3.5 flex h-11 w-full items-center gap-2 border-t border-white/[0.06] pt-3.5 text-sm text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
          Reprendre le suivi
          <ChevronRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Calendrier des prochains épisodes (tous les épisodes à venir, pas seulement
// le suivant). C'est un argument produit majeur : les gens cherchent "quand
// sort le prochain épisode de …", et ils veulent voir toute la programmation
// à venir, pas juste le prochain. Rendu sobre, chiffres en font-counter,
// dates en français, avec un fold "Voir tout" au-delà de 5 items.
// ---------------------------------------------------------------------------

const INITIAL_UPCOMING_SHOWN = 3;

function formatCountdown(daysUntil: number): string {
  if (daysUntil <= 0) return "Aujourd'hui";
  if (daysUntil === 1) return "Demain";
  if (daysUntil < 7) return `Dans ${daysUntil}j`;
  const weeks = Math.round(daysUntil / 7);
  if (weeks < 5) return `Dans ${weeks} sem.`;
  const months = Math.round(daysUntil / 30);
  return `Dans ${months} mois`;
}

function formatEpisodeDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function UpcomingSchedule({ episodes }: { episodes: EpisodeRow[] }) {
  const { ref, inView } = useInViewOnce<HTMLDivElement>();
  const [expanded, setExpanded] = useState(false);

  const visible = expanded ? episodes : episodes.slice(0, INITIAL_UPCOMING_SHOWN);
  const hiddenCount = episodes.length - visible.length;

  return (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl border border-white/[0.07] bg-white/[0.018] p-[18px]",
        "opacity-0 translate-y-3 transition-[opacity,transform] duration-500 ease-out",
        "motion-reduce:opacity-100 motion-reduce:translate-y-0 motion-reduce:transition-none",
        inView && "opacity-100 translate-y-0",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-counter text-[9.5px] uppercase tracking-[0.24em] text-cyan-accent">
          {episodes.length === 1 ? "Prochain épisode" : `Prochains épisodes · ${episodes.length}`}
        </p>
      </div>

      <ul className="mt-3 flex flex-col divide-y divide-white/[0.05]">
        {visible.map((episode, idx) => {
          const daysUntil = Math.max(
            0,
            Math.ceil(
              (new Date(episode.air_date!).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
            ),
          );
          const countdown = formatCountdown(daysUntil);
          const isFirst = idx === 0;
          return (
            <li key={episode.id} className="flex items-center gap-3 py-2.5 first:pt-0">
              <span className="w-14 shrink-0 font-counter text-[12px] font-semibold tabular-nums text-cyan-accent">
                S{pad(episode.season_number)}E{pad(episode.episode_number)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] leading-snug text-foreground">
                  {episode.title ?? "—"}
                </p>
                <p className="mt-0.5 font-counter text-[10.5px] uppercase tracking-wide text-muted-foreground">
                  {formatEpisodeDate(episode.air_date!)}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 font-counter text-[10.5px] tabular-nums",
                  isFirst
                    ? "border border-cyan-accent/30 bg-cyan-accent/10 text-cyan-accent"
                    : "border border-white/[0.08] bg-transparent text-muted-foreground",
                )}
              >
                {countdown}
              </span>
            </li>
          );
        })}
      </ul>

      {hiddenCount > 0 && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.02] py-2 font-counter text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          Voir les {hiddenCount} suivants
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      )}
      {expanded && episodes.length > INITIAL_UPCOMING_SHOWN && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.02] py-2 font-counter text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          Réduire
          <ChevronDown className="h-3.5 w-3.5 rotate-180" />
        </button>
      )}
    </div>
  );
}


// ---------------------------------------------------------------------------
// Épisodes : lignes dépliables (résumé), coche séparée (stopPropagation)
// ---------------------------------------------------------------------------

function EpisodeRow({
  episode,
  count,
  onToggleWatched,
  isTogglePending,
  share,
}: {
  episode: EpisodeRow;
  count: number;
  onToggleWatched: () => void;
  isTogglePending: boolean;
  /** Déclencheur de partage, rendu seulement pour un épisode déjà vu. */
  share?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const isWatched = count > 0;
  const hasOverview = !!episode.overview;

  return (
    <li
      id={`episode-${episode.id}`}
      tabIndex={-1}
      className="scroll-mt-6 border-t border-white/[0.06] first:border-t-0"
    >
      <div
        role={hasOverview ? "button" : undefined}
        tabIndex={hasOverview ? 0 : undefined}
        aria-expanded={hasOverview ? expanded : undefined}
        onClick={hasOverview ? () => setExpanded((v) => !v) : undefined}
        onKeyDown={
          hasOverview
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setExpanded((v) => !v);
                }
              }
            : undefined
        }
        className={cn("flex items-start gap-3 py-3", hasOverview && "cursor-pointer")}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleWatched();
          }}
          disabled={isTogglePending}
          aria-label={isWatched ? "Marquer non vu" : "Marquer vu"}
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-full border transition-colors disabled:opacity-50",
            isWatched
              ? "border-cyan-accent bg-cyan-accent/10 text-cyan-accent"
              : "border-white/[0.07] bg-surface-elevated text-muted-foreground hover:border-primary/60 hover:text-primary",
          )}
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
        <div className="min-w-0 flex-1 pt-1.5">
          <div className="flex items-baseline gap-2">
            <span className="shrink-0 font-counter text-[11px] tracking-widest text-muted-foreground">
              E{pad(episode.episode_number)}
            </span>
            <span className="text-[13.5px] leading-snug text-foreground">
              {episode.title ?? "—"}
            </span>
          </div>
          <p className="mt-1 font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
            {episode.air_date ?? "date inconnue"}
          </p>
        </div>
        {share && (
          <div className="mt-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            {share}
          </div>
        )}
        {hasOverview && (
          <ChevronDown
            className={cn(
              "mt-2.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              expanded && "rotate-180",
            )}
            aria-hidden="true"
          />
        )}
      </div>
      {expanded && hasOverview && (
        <p className="pb-3.5 pl-14 pr-2 text-xs leading-relaxed text-muted-foreground">
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

// ---------------------------------------------------------------------------
// Override TV (Abandonner / Reprendre le suivi / Ne plus suivre) — état
// optimiste partagé entre le kebab-menu (hero) et la pastille de statut
// (ProgressCard). Extrait de l'ancien `TvStatusBadge` : logique de mutation
// strictement inchangée, seul l'endroit où elle est consommée a changé (2
// composants distincts au lieu d'un seul badge+menu).
// ---------------------------------------------------------------------------

function useTvOverride({
  userShow,
  followKey,
  onChanged,
}: {
  userShow: UserShowRow | null;
  followKey: unknown[];
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [pending, setPending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmUnfollowOpen, setConfirmUnfollowOpen] = useState(false);
  const [unfollowPending, setUnfollowPending] = useState(false);
  // Optimistic UI (cf. CLAUDE.md : jamais d'attente visible sur une action de
  // tracking) : au clic, on affiche immédiatement le résultat attendu, sans
  // attendre la requête ni le refetch déclenché par onChanged(). Pour
  // "Abandonner" le nouveau manual_override est connu à l'avance, donc
  // affiché tel quel. Pour "Reprendre le suivi", le statut réel dépend du
  // recalcul serveur (trigger SQL) qu'on ne peut pas prédire côté client : on
  // affiche "Recalcul…" transitoire jusqu'à ce que `userShow` reflète la
  // valeur confirmée.
  const [optimistic, setOptimistic] = useState<{
    manualOverride: "abandonne" | null;
    recalculating: boolean;
  } | null>(null);

  useEffect(() => {
    if (optimistic && userShow?.manual_override === optimistic.manualOverride) {
      setOptimistic(null);
    }
  }, [userShow?.manual_override, optimistic]);

  const manualOverride = optimistic
    ? optimistic.manualOverride
    : (userShow?.manual_override ?? null);
  const recalculating = optimistic?.recalculating ?? false;

  const setOverride = async (next: "abandonne" | null) => {
    if (!userShow || !user) return;
    // Annule tout refetch de `followKey` encore en vol (déclenché par un clic
    // précédent via onChanged()) avant d'écrire un nouvel état optimiste :
    // sans ça, une réponse obsolète peut résoudre après celle de cette action
    // et écraser le cache avec une donnée périmée, laissant l'état bloqué sur
    // "Recalcul…".
    await qc.cancelQueries({ queryKey: followKey });
    setOptimistic({ manualOverride: next, recalculating: next === null });
    setPending(true);
    const { error } = await supabase
      .from("user_shows")
      .update({ manual_override: next })
      .eq("user_id", user.id)
      .eq("show_id", userShow.show_id);
    setPending(false);
    if (error) {
      setOptimistic(null);
      toast.error(error.message);
      return;
    }
    onChanged();
  };

  // "Ne plus suivre" : suppression réelle de la ligne user_shows (jamais de
  // watch_status touché, cf. CLAUDE.md). Contrairement à setOverride, pas
  // d'état optimiste local : après succès, onChanged() invalide `followKey`
  // et le composant parent fait redevenir `userShow` null au refetch.
  const handleUnfollow = async () => {
    if (!userShow || !user) return;
    setUnfollowPending(true);
    try {
      await unfollowShow(user.id, userShow.show_id);
      setConfirmUnfollowOpen(false);
      onChanged();
      qc.invalidateQueries({ queryKey: ["followed-keys", user?.id] });
      qc.invalidateQueries({ queryKey: ["home-schedule", user?.id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de retirer cette série");
    } finally {
      setUnfollowPending(false);
    }
  };

  return {
    manualOverride,
    recalculating,
    pending,
    menuOpen,
    setMenuOpen,
    confirmUnfollowOpen,
    setConfirmUnfollowOpen,
    unfollowPending,
    setOverride,
    handleUnfollow,
  };
}

// Kebab menu (hero) : actions de suivi rares (Abandonner / Reprendre / Ne
// plus suivre). Le statut lisible directement vit dans `ProgressCard`
// (`StatusPill`), pas ici — ce menu ne rend plus aucun badge.
function TvFollowMenu({
  showTitle,
  tvOverride,
}: {
  showTitle: string;
  tvOverride: ReturnType<typeof useTvOverride>;
}) {
  const {
    manualOverride,
    pending,
    menuOpen,
    setMenuOpen,
    confirmUnfollowOpen,
    setConfirmUnfollowOpen,
    unfollowPending,
    setOverride,
    handleUnfollow,
  } = tvOverride;

  return (
    <>
      {/* modal={false} : évite le bug Radix connu (radix-ui/primitives#3317,
          shadcn-ui/ui#7124) où le pointer-events:none posé sur <body> par un
          DropdownMenu modal peut ne jamais être relâché quand un AlertDialog
          s'ouvre par-dessus (cf. onSelect "Ne plus suivre" ci-dessous), ce
          qui gèlerait toute la page. */}
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Gérer le suivi"
            disabled={pending || unfollowPending}
            className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background/50 text-foreground backdrop-blur-sm disabled:opacity-50"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
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
              // preventDefault : évite la fermeture "par défaut" du menu (avec
              // son retour de focus immédiat sur le trigger) pendant que
              // l'AlertDialog s'ouvre. On ferme le menu nous-mêmes juste après
              // via setMenuOpen(false), pour ne jamais le laisser réapparaître
              // visuellement derrière une fois l'AlertDialog fermé
              // (annulation ou confirmation).
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

      <AlertDialog open={confirmUnfollowOpen} onOpenChange={setConfirmUnfollowOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ne plus suivre {showTitle} ?</AlertDialogTitle>
            <AlertDialogDescription>
              La série disparaît de votre bibliothèque, pas votre historique : chaque épisode vu
              reste enregistré, prêt à être retrouvé — ou exporté — quand vous le voulez.
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
