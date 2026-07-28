import { supabase } from "@/integrations/supabase/client";
import type { NetworkRef, WatchProviders } from "@/lib/watch-providers";

/**
 * Types + fetch function shared between the show/movie detail route's
 * client-side `useQuery` and its SSR `loader` (cf. P0-1 SEO chantier —
 * un `loader` de route rejoue exactement le même appel `get-show-details`
 * plus tôt dans le cycle de vie de la route, sans dupliquer la logique de
 * cache TMDb qui reste entièrement côté edge function).
 */
export type ShowRow = {
  id: number;
  tmdb_id: number;
  media_type: string;
  title: string;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string | null;
  status: string | null;
  genres: string[] | null;
  vote_average: number | null;
  tagline: string | null;
  watch_providers: WatchProviders | null;
  networks: NetworkRef[] | null;
};

export type SeasonRow = {
  id: number;
  show_id: number;
  season_number: number;
  episode_count: number | null;
};

export type EpisodeRow = {
  id: number;
  show_id: number;
  season_number: number;
  episode_number: number;
  title: string | null;
  air_date: string | null;
  overview: string | null;
  still_path?: string | null;
};

export type ShowDetails = {
  show: ShowRow;
  seasons: SeasonRow[];
  episodes: EpisodeRow[];
};

export function showDetailsQueryKey(mediaType: string, tmdbId: string | number) {
  return ["show-details", mediaType, tmdbId] as const;
}

export async function fetchShowDetails(tmdbId: number, mediaType: string): Promise<ShowDetails> {
  const { data, error } = await supabase.functions.invoke("get-show-details", {
    body: { tmdb_id: tmdbId, media_type: mediaType },
  });
  if (error) throw error;
  return data as ShowDetails;
}
