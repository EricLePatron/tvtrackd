import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

/**
 * Mutation partagée pour marquer un épisode "vu" en 1 clic depuis la Home
 * (Reprendre / Nouveau) et le calendrier (épisodes passés non vus). Ne gère
 * jamais le décochage : le clic vient d'une carte qui, par construction,
 * représente un épisode non vu — décocher passe par la fiche série.
 */
export function useMarkWatched() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ episodeId }: { episodeId: number; showId: number }) => {
      if (!user) throw new Error("no user");
      const { error } = await supabase.from("watch_status").upsert(
        {
          user_id: user.id,
          episode_id: episodeId,
          watch_count: 1,
          watched_at: new Date().toISOString(),
        },
        { onConflict: "user_id,episode_id" },
      );
      if (error) throw error;
    },
    onError: () => {
      toast.error("Impossible de marquer l'épisode");
    },
    onSuccess: (_data, { showId }) => {
      toast.success("Marqué comme vu");
      // Home + calendrier + fiche série (le cas échéant) doivent re-render.
      qc.invalidateQueries({ queryKey: ["home-schedule", user?.id] });
      qc.invalidateQueries({ queryKey: ["calendar-timeline-episodes", user?.id] });
      qc.invalidateQueries({ queryKey: ["library", user?.id] });
      qc.invalidateQueries({ queryKey: ["library-progress", user?.id] });
      qc.invalidateQueries({ queryKey: ["watched", user?.id, showId] });
    },
  });
}
