import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TrendingItem } from "@/components/home/discovery-grid";

export function similarMediaQueryKey(
  mediaType: "tv" | "movie" | string | undefined,
  tmdbId: number | string | undefined,
) {
  return ["similar-media", mediaType, tmdbId] as const;
}

/** Fetch brut, réutilisé par le hook ci-dessous ET par le `loader` SSR de la
 * fiche série/film (cf. P0-1) — un seul endroit qui appelle l'edge function. */
export async function fetchSimilarMedia(
  tmdbId: number | string,
  mediaType: "tv" | "movie" | string,
): Promise<TrendingItem[]> {
  const { data, error } = await supabase.functions.invoke("similar-media", {
    body: { tmdb_id: Number(tmdbId), media_type: mediaType },
  });
  if (error) throw error;
  return (data as { results: TrendingItem[] })?.results ?? [];
}

/**
 * "Vous aimerez aussi" — TMDb recommendations pour un titre donné, avec
 * fallback sur /similar côté edge function. Réutilise le type `TrendingItem`
 * pour être passé directement à `DiscoveryGrid`.
 *
 * `initialData` (optionnel) : préremplissage depuis le `loader` SSR de la
 * fiche (best-effort, cf. route) — évite un refetch client immédiat après
 * l'hydratation tant que `staleTime` n'est pas dépassé.
 */
export function useSimilarMedia(
  tmdbId: number | string | undefined,
  mediaType: "tv" | "movie" | string | undefined,
  initialData?: TrendingItem[],
) {
  return useQuery({
    queryKey: similarMediaQueryKey(mediaType, tmdbId),
    enabled: !!tmdbId && (mediaType === "tv" || mediaType === "movie"),
    staleTime: 60 * 60 * 1000,
    ...(initialData !== undefined ? { initialData } : {}),
    queryFn: () => fetchSimilarMedia(tmdbId!, mediaType as "tv" | "movie"),
  });
}
