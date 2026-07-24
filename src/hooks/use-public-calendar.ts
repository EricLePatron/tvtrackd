import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TrendingItem } from "@/components/home/discovery-grid";

export type PublicCalendarData = {
  airingToday: TrendingItem[];
  onTheAir: TrendingItem[];
};

export function publicCalendarQueryKey() {
  return ["public-calendar"] as const;
}

/** Fetch brut, réutilisé par le hook ci-dessous ET par le `loader` SSR de la
 * route `/calendar` (cf. P0-4) — un seul endroit qui appelle l'edge function. */
export async function fetchPublicCalendar(): Promise<PublicCalendarData> {
  const { data, error } = await supabase.functions.invoke("public-calendar", {
    body: {},
  });
  if (error) throw error;
  return data as PublicCalendarData;
}

/**
 * "Programme de la semaine" — calendrier public généraliste (TMDb
 * airing_today/on_the_air), affiché aux visiteurs anonymes de `/calendar`
 * (cf. P0-4 SEO). `initialData` (optionnel) : préremplissage depuis le
 * `loader` SSR de la route, évite un refetch client immédiat après
 * l'hydratation.
 */
export function usePublicCalendar(initialData?: PublicCalendarData) {
  return useQuery({
    queryKey: publicCalendarQueryKey(),
    staleTime: 60 * 60 * 1000,
    ...(initialData !== undefined ? { initialData } : {}),
    queryFn: fetchPublicCalendar,
  });
}
