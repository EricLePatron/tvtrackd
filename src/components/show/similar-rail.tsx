import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAuthGate } from "@/hooks/use-auth-gate";
import { useSimilarMedia } from "@/hooks/use-similar-media";
import { useQuickFollow } from "@/hooks/use-quick-follow";
import { useFollowedKeys } from "@/hooks/use-followed-keys";
import { DiscoveryGrid, trendingKey, type TrendingItem } from "@/components/home/discovery-grid";

/**
 * "Vous aimerez aussi" — carrousel de recommandations basé sur les titres
 * similaires TMDb, affiché en bas de la fiche série/film. Réutilise
 * `DiscoveryGrid` (variant compact) et la même mécanique de quick-follow
 * optimiste que les rails Découverte.
 */
export function SimilarRail({
  tmdbId,
  mediaType,
}: {
  tmdbId: number | string;
  mediaType: "tv" | "movie" | string;
}) {
  const { user } = useAuth();
  const { data: items = [], isLoading, isError } = useSimilarMedia(tmdbId, mediaType);
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

  if (!isLoading && !isError && items.length === 0) return null;

  return (
    <DiscoveryGrid
      title="Vous aimerez aussi"
      items={items}
      isLoading={isLoading}
      isError={isError}
      variant="compact"
      followedKeys={followedKeys}
      pendingKey={
        followMutation.isPending && followMutation.variables
          ? trendingKey(followMutation.variables)
          : null
      }
      onFollow={handleFollow}
    />
  );
}
