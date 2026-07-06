import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { followShow } from "@/lib/follow-show";
import type { TrendingItem } from "@/components/home/discovery-grid";

/**
 * One-tap "+" follow from a discovery grid. `shows` has no RLS write policy
 * for `authenticated` — only `service_role` can upsert it — so we first go
 * through `get-show-details` (same edge function the show page uses to
 * populate its cache) to obtain the internal `show.id`, then upsert
 * `user_shows` client-side, which RLS does allow for the current user.
 *
 * If a `user_shows` row already exists for this show (any status —
 * en_cours, termine, abandonne, archive…), it is left untouched: `status`
 * (et `manual_override` pour les séries) sont déjà en place et ne doivent
 * jamais être écrasés — voir `followShow` dans `src/lib/follow-show.ts`,
 * partagée avec la mutation `follow` de la route show detail et
 * `use-replay-pending-intent`. The discovery grids also pre-mark
 * already-followed items via `useFollowedKeys` so the "+" shouldn't
 * normally be clickable in that case at all — this is a defense-in-depth
 * check against overwriting real progress on a race/stale-cache click.
 */
export function useQuickFollow(userId: string | undefined) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (item: TrendingItem) => {
      if (!userId) throw new Error("no user");
      const { data, error } = await supabase.functions.invoke("get-show-details", {
        body: { tmdb_id: item.tmdb_id, media_type: item.media_type },
      });
      if (error) throw error;
      const show = (data as { show: { id: number } }).show;

      const { data: existing } = await supabase
        .from("user_shows")
        .select("status")
        .eq("user_id", userId)
        .eq("show_id", show.id)
        .maybeSingle();

      await followShow(userId, show.id, !!existing);
      return show;
    },
    onError: () => {
      toast.error("Impossible de suivre cette série pour le moment");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["home-schedule", userId] });
      qc.invalidateQueries({ queryKey: ["followed-keys", userId] });
    },
  });
}
