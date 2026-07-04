import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TrendingItem } from "@/components/home/discovery-grid";

/** "Nouvelles sorties" — TMDb tv shows sorted by most recent first-air date, used by the discovery grids. */
export function useNewReleases(enabled: boolean = true) {
  return useQuery({
    queryKey: ["new-releases-media"],
    enabled,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("new-releases-media", {
        body: {},
      });
      if (error) throw error;
      return (data as { results: TrendingItem[] })?.results ?? [];
    },
  });
}
