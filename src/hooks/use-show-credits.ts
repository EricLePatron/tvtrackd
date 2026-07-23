import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CastMember = {
  person_id: number;
  name: string;
  character: string;
  profile_url: string | null;
};

export function showCreditsQueryKey(
  mediaType: "tv" | "movie" | string | undefined,
  tmdbId: number | string | undefined,
) {
  return ["show-credits", mediaType, tmdbId] as const;
}

/** Fetch brut, réutilisé par le hook ci-dessous ET par le `loader` SSR de la
 * fiche série/film (cf. P0-1) — un seul endroit qui appelle l'edge function. */
export async function fetchShowCredits(
  tmdbId: number | string,
  mediaType: "tv" | "movie" | string,
): Promise<CastMember[]> {
  const { data, error } = await supabase.functions.invoke("show-credits", {
    body: { tmdb_id: Number(tmdbId), media_type: mediaType },
  });
  if (error) throw error;
  return (data as { cast: CastMember[] })?.cast ?? [];
}

/**
 * Casting principal d'une série/film (via TMDb aggregate_credits pour tv,
 * /credits pour movie). Résultat mis en cache 1h côté React Query.
 *
 * `initialData` (optionnel) : permet au `loader` SSR de la fiche de
 * pré-remplir le cache react-query avec le casting déjà fetché côté serveur
 * (best-effort, cf. route) — évite un refetch client immédiat après
 * l'hydratation tant que `staleTime` n'est pas dépassé.
 */
export function useShowCredits(
  tmdbId: number | string | undefined,
  mediaType: "tv" | "movie" | string | undefined,
  initialData?: CastMember[],
) {
  return useQuery({
    queryKey: showCreditsQueryKey(mediaType, tmdbId),
    enabled: !!tmdbId && (mediaType === "tv" || mediaType === "movie"),
    staleTime: 60 * 60 * 1000,
    ...(initialData !== undefined ? { initialData } : {}),
    queryFn: () => fetchShowCredits(tmdbId!, mediaType as "tv" | "movie"),
  });
}
