import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CastMember = {
  person_id: number;
  name: string;
  character: string;
  profile_url: string | null;
};

/**
 * Casting principal d'une série/film (via TMDb aggregate_credits pour tv,
 * /credits pour movie). Résultat mis en cache 1h côté React Query.
 */
export function useShowCredits(
  tmdbId: number | string | undefined,
  mediaType: "tv" | "movie" | string | undefined,
) {
  return useQuery({
    queryKey: ["show-credits", mediaType, tmdbId],
    enabled: !!tmdbId && (mediaType === "tv" || mediaType === "movie"),
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("show-credits", {
        body: { tmdb_id: Number(tmdbId), media_type: mediaType },
      });
      if (error) throw error;
      return (data as { cast: CastMember[] })?.cast ?? [];
    },
  });
}
