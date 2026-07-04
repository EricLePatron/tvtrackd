import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TrendingItem } from "@/components/home/discovery-grid";

/** "Le rayon du moment" — TMDb weekly trending, used by the discovery grids. */
export function useTrending(enabled: boolean = true) {
  return useQuery({
    queryKey: ["trending-media"],
    enabled,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("trending-media", {
        body: {},
      });
      if (error) throw error;
      return (data as { results: TrendingItem[] })?.results ?? [];
    },
  });
}
