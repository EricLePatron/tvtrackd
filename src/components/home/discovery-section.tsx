import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAuthGate } from "@/hooks/use-auth-gate";
import { useTrending } from "@/hooks/use-trending";
import { useNewReleases } from "@/hooks/use-new-releases";
import { useQuickFollow } from "@/hooks/use-quick-follow";
import { useFollowedKeys } from "@/hooks/use-followed-keys";
import { DiscoveryGrid, trendingKey, type TrendingItem } from "@/components/home/discovery-grid";

/**
 * Shared optimistic-follow wiring for a single discovery rail: layers a local
 * optimistic "+" state (instant check, rollback on error) for the one-tap
 * quick-follow button on top of the shows the user already follows (any
 * status), so a rail item matching an existing follow never shows as "not
 * followed". Used by both the "Tendances" and "Nouveautés" rails below.
 */
function useDiscoveryRail(items: TrendingItem[], isLoading: boolean, userId: string | undefined) {
  const { data: alreadyFollowedKeys = new Set<string>() } = useFollowedKeys(userId);
  const [optimisticKeys, setOptimisticKeys] = useState<Set<string>>(new Set());
  const followMutation = useQuickFollow(userId);
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
      { reason: "suivre cette série" },
    );
  };

  return {
    items,
    isLoading,
    followedKeys,
    pendingKey:
      followMutation.isPending && followMutation.variables
        ? trendingKey(followMutation.variables)
        : null,
    handleFollow,
  };
}

/** "Tendances" — TMDb weekly trending tv shows. */
function TrendingRail({ variant }: { variant: "grid" | "compact" }) {
  const { user } = useAuth();
  const { data: items = [], isLoading } = useTrending(true);
  const rail = useDiscoveryRail(items, isLoading, user?.id);

  return (
    <DiscoveryGrid
      title="Tendances"
      items={rail.items}
      isLoading={rail.isLoading}
      variant={variant}
      followedKeys={rail.followedKeys}
      pendingKey={rail.pendingKey}
      onFollow={rail.handleFollow}
    />
  );
}

/** "Nouveautés" — TMDb tv shows sorted by most recent first-air date. */
function NewReleasesRail({ variant }: { variant: "grid" | "compact" }) {
  const { user } = useAuth();
  const { data: items = [], isLoading } = useNewReleases(true);
  const rail = useDiscoveryRail(items, isLoading, user?.id);

  return (
    <DiscoveryGrid
      title="Nouveautés"
      items={rail.items}
      isLoading={rail.isLoading}
      variant={variant}
      followedKeys={rail.followedKeys}
      pendingKey={rail.pendingKey}
      onFollow={rail.handleFollow}
    />
  );
}

/**
 * Discovery container — stacks the "Tendances" and "Nouveautés" rails, each
 * independently wired to its TMDb data source and the shared quick-follow
 * mutation. Rendered once, at a single fixed spot, regardless of the Home
 * screen's state (see `routes/_public/index.tsx`), and by default on the
 * search screen while the query is empty/too short (see
 * `routes/_public/search.tsx`).
 */
export function DiscoverySection({ variant }: { variant: "grid" | "compact" }) {
  return (
    <>
      <TrendingRail variant={variant} />
      <NewReleasesRail variant={variant} />
    </>
  );
}
