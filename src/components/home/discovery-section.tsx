import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTrending } from "@/hooks/use-trending";
import { useQuickFollow } from "@/hooks/use-quick-follow";
import { DiscoveryGrid, type TrendingItem } from "@/components/home/discovery-grid";

/**
 * Container wiring "Le rayon du moment" to live TMDb trending data and the
 * one-tap quick-follow mutation, with local optimistic state for the "+"
 * button (instant check, rollback on error).
 */
export function DiscoverySection({ variant }: { variant: "grid" | "compact" }) {
  const { user } = useAuth();
  const { data: items = [], isLoading } = useTrending(!!user);
  const [followedIds, setFollowedIds] = useState<Set<number>>(new Set());
  const followMutation = useQuickFollow(user?.id);

  const handleFollow = (item: TrendingItem) => {
    setFollowedIds((prev) => new Set(prev).add(item.tmdb_id));
    followMutation.mutate(item, {
      onError: () => {
        setFollowedIds((prev) => {
          const next = new Set(prev);
          next.delete(item.tmdb_id);
          return next;
        });
      },
    });
  };

  return (
    <DiscoveryGrid
      items={items}
      isLoading={isLoading}
      variant={variant}
      followedIds={followedIds}
      pendingId={followMutation.isPending ? (followMutation.variables?.tmdb_id ?? null) : null}
      onFollow={handleFollow}
    />
  );
}
