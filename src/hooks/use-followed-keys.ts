import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { trendingKey } from "@/components/home/discovery-grid";

/**
 * All shows the user already has a `user_shows` row for, regardless of
 * status (a_voir/en_cours/termine/abandonne/archive) — used to pre-mark
 * "already followed" items in the discovery grids so the quick-follow "+"
 * never re-appears (and can't be clicked) for a show that's merely
 * finished/archived rather than genuinely new.
 */
export function useFollowedKeys(userId: string | undefined) {
  return useQuery({
    queryKey: ["followed-keys", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_shows")
        .select("show:shows(tmdb_id, media_type)")
        .eq("user_id", userId!);

      const keys = new Set<string>();
      for (const row of data ?? []) {
        const show = row.show as { tmdb_id: number; media_type: string } | null;
        if (show) keys.add(trendingKey(show));
      }
      return keys;
    },
  });
}
