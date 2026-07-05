import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAuthGate } from "@/hooks/use-auth-gate";
import { useTrending } from "@/hooks/use-trending";
import { useQuickFollow } from "@/hooks/use-quick-follow";
import { useFollowedKeys } from "@/hooks/use-followed-keys";
import { DiscoveryGrid, trendingKey, type TrendingItem } from "@/components/home/discovery-grid";

/**
 * Container wiring "Le rayon du moment" to live TMDb trending data and the
 * one-tap quick-follow mutation, with local optimistic state for the "+"
 * button (instant check, rollback on error) layered on top of the shows the
 * user already follows (any status) so a trending item matching an existing
 * follow never shows as "not followed".
 */
export function DiscoverySection({ variant }: { variant: "grid" | "compact" }) {
  const { user } = useAuth();
  const { data: items = [], isLoading } = useTrending(true);
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

  return (
    <DiscoveryGrid
      items={items}
      isLoading={isLoading}
      variant={variant}
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
