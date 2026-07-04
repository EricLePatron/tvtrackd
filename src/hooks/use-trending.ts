import { useQuery } from "@tanstack/react-query";
import { fetchTrendingTv } from "@/lib/tmdb-client";

/** "Le rayon du moment" — TMDb weekly trending, used by the discovery grids. */
export function useTrending(enabled: boolean = true) {
  return useQuery({
    queryKey: ["trending-media"],
    enabled,
    staleTime: 30 * 60 * 1000,
    queryFn: () => fetchTrendingTv(),
  });
}
