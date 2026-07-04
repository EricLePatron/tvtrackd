import { useQuery } from "@tanstack/react-query";
import { fetchNewReleasesTv } from "@/lib/tmdb-client";

/** "Nouvelles sorties" — TMDb tv shows sorted by most recent first-air date, used by the discovery grids. */
export function useNewReleases(enabled: boolean = true) {
  return useQuery({
    queryKey: ["new-releases-media"],
    enabled,
    staleTime: 30 * 60 * 1000,
    queryFn: () => fetchNewReleasesTv(),
  });
}
