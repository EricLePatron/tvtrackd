import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TrendingItem } from "@/components/home/discovery-grid";

/**
 * "Vous aimerez aussi" — TMDb recommendations pour un titre donné, avec
 * fallback sur /similar côté edge function. Réutilise le type `TrendingItem`
 * pour être passé directement à `DiscoveryGrid`.
 */
export function useSimilarMedia(
  tmdbId: number | string | undefined,
  mediaType: "tv" | "movie" | string | undefined,
) {
  return useQuery({
    queryKey: ["similar-media", mediaType, tmdbId],
    enabled: !!tmdbId && (mediaType === "tv" || mediaType === "movie"),
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("similar-media", {
        body: { tmdb_id: Number(tmdbId), media_type: mediaType },
      });
      if (error) throw error;
      return (data as { results: TrendingItem[] })?.results ?? [];
    },
  });
}
