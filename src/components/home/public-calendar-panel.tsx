import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAuthGate } from "@/hooks/use-auth-gate";
import { useFollowedKeys } from "@/hooks/use-followed-keys";
import { useQuickFollow } from "@/hooks/use-quick-follow";
import { usePublicCalendar, type PublicCalendarData } from "@/hooks/use-public-calendar";
import { DiscoveryGrid, trendingKey, type TrendingItem } from "@/components/home/discovery-grid";

/**
 * "Programme de la semaine" — calendrier public généraliste affiché à un
 * visiteur anonyme sur `/calendar` (cf. P0-4 SEO). Réutilise `DiscoveryGrid`
 * (même quick-follow optimiste + auth-gate que `SimilarRail`/`CardRail`) —
 * suivre une série depuis ces cartes déclenche l'overlay de connexion plutôt
 * que d'être simplement absent, cohérent avec le reste des surfaces
 * publiques de l'app.
 */
export function PublicCalendarPanel({ initialData }: { initialData?: PublicCalendarData }) {
  const { user } = useAuth();
  const { data, isLoading, isError } = usePublicCalendar(initialData);
  const { data: alreadyFollowedKeys = new Set<string>() } = useFollowedKeys(user?.id);
  const [optimisticKeys, setOptimisticKeys] = useState<Set<string>>(new Set());
  const followMutation = useQuickFollow(user?.id);
  const { requireAuth } = useAuthGate();

  const followedKeys = useMemo(
    () => new Set([...alreadyFollowedKeys, ...optimisticKeys]),
    [alreadyFollowedKeys, optimisticKeys],
  );

  const handleFollow = (item: TrendingItem) => {
    requireAuth(
      () => {
        const key = trendingKey(item);
        setOptimisticKeys((prev) => new Set(prev).add(key));
        followMutation.mutate(item, {
          onError: () => {
            setOptimisticKeys((prev) => {
              const next = new Set(prev);
              next.delete(key);
              return next;
            });
          },
        });
      },
      {
        reason: "suivre cette série",
        intent: { kind: "follow", tmdbId: item.tmdb_id, mediaType: item.media_type },
      },
    );
  };

  const pendingKey =
    followMutation.isPending && followMutation.variables
      ? trendingKey(followMutation.variables)
      : null;

  return (
    <div className="mx-5">
      <DiscoveryGrid
        title="Nouveaux épisodes aujourd'hui"
        items={data?.airingToday ?? []}
        isLoading={isLoading}
        isError={isError}
        followedKeys={followedKeys}
        pendingKey={pendingKey}
        onFollow={handleFollow}
      />
      <DiscoveryGrid
        title="En diffusion cette semaine"
        items={data?.onTheAir ?? []}
        isLoading={isLoading}
        isError={isError}
        followedKeys={followedKeys}
        pendingKey={pendingKey}
        onFollow={handleFollow}
      />
    </div>
  );
}
