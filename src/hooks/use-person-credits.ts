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

/**
 * Infos + filmographie complète d'une personne (acteur, réalisateur…). Sert
 * la page /person/$personId ; sortie combined (tv + movie) triée par popularité.
 */
export function usePersonCredits(personId: number | string | undefined) {
  return useQuery({
    queryKey: ["person-credits", personId],
    enabled: !!personId,
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("person-credits", {
        body: { person_id: Number(personId) },
      });
      if (error) throw error;
      return data as { person: PersonInfo; credits: PersonCredit[] };
    },
  });
}
