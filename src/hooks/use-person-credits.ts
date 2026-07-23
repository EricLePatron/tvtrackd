import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TrendingItem } from "@/components/home/discovery-grid";

export type PersonInfo = {
  id: number;
  name: string;
  biography: string;
  profile_url: string | null;
  known_for_department: string | null;
  birthday: string | null;
  place_of_birth: string | null;
};

export type PersonCredit = TrendingItem & { character: string };

export type PersonCreditsData = { person: PersonInfo; credits: PersonCredit[] };

export function personCreditsQueryKey(personId: number | string | undefined) {
  return ["person-credits", personId] as const;
}

/** Fetch brut, réutilisé par le hook ci-dessous ET par le `loader` SSR de la
 * fiche personne (cf. P0-1) — un seul endroit qui appelle l'edge function. */
export async function fetchPersonCredits(personId: number | string): Promise<PersonCreditsData> {
  const { data, error } = await supabase.functions.invoke("person-credits", {
    body: { person_id: Number(personId) },
  });
  if (error) throw error;
  return data as PersonCreditsData;
}

/**
 * Infos + filmographie complète d'une personne (acteur, réalisateur…). Sert
 * la page /person/$personId ; sortie combined (tv + movie) triée par popularité.
 *
 * `initialData` (optionnel) : préremplissage depuis le `loader` SSR de la
 * route (cf. P0-1) — évite un refetch client immédiat après l'hydratation.
 */
export function usePersonCredits(
  personId: number | string | undefined,
  initialData?: PersonCreditsData,
) {
  return useQuery({
    queryKey: personCreditsQueryKey(personId),
    enabled: !!personId,
    staleTime: 60 * 60 * 1000,
    ...(initialData !== undefined ? { initialData } : {}),
    queryFn: () => fetchPersonCredits(personId!),
  });
}
