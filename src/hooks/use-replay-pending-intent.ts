import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { takePendingIntent } from "@/lib/client-storage";

type ShowDetailsResponse = {
  show: { id: number };
  episodes: { id: number; season_number: number; episode_number: number }[];
};

/**
 * Replays the action captured by `useAuthGate` (see
 * `src/lib/client-storage.ts` — `PendingIntent`) once the user is signed in,
 * regardless of which page they land back on. Mounted once in `AppShell` so
 * it runs for both the public and authenticated layouts.
 *
 * Deliberately talks to Supabase directly (same calls as
 * `use-quick-follow.ts` / the show detail route) rather than reusing those
 * components' local mutations, which won't exist if the user lands back on
 * a different page than the one where the action was gated.
 */
export function useReplayPendingIntent() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const replayedRef = useRef(false);

  useEffect(() => {
    if (!user || replayedRef.current) return;

    const intent = takePendingIntent();
    if (!intent) return;
    replayedRef.current = true;

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-show-details", {
          body: { tmdb_id: intent.tmdbId, media_type: intent.mediaType },
        });
        if (error) throw error;
        const { show, episodes } = data as ShowDetailsResponse;

        if (intent.kind === "follow") {
          const { data: existing } = await supabase
            .from("user_shows")
            .select("status")
            .eq("user_id", user.id)
            .eq("show_id", show.id)
            .maybeSingle();

          const { error: upsertError } = await supabase
            .from("user_shows")
            .upsert(
              { user_id: user.id, show_id: show.id, status: existing?.status ?? "a_voir" },
              { onConflict: "user_id,show_id" },
            );
          if (upsertError) throw upsertError;

          qc.invalidateQueries({ queryKey: ["user-show", user.id, show.id] });
          qc.invalidateQueries({ queryKey: ["followed-keys", user.id] });
          qc.invalidateQueries({ queryKey: ["home-schedule", user.id] });
          toast.success("Ajouté à votre bibliothèque");
          return;
        }

        // kind === "mark_watched"
        const episode = episodes.find(
          (e) =>
            e.season_number === intent.seasonNumber && e.episode_number === intent.episodeNumber,
        );
        if (!episode) return;

        const { data: existingWatch } = await supabase
          .from("watch_status")
          .select("watch_count")
          .eq("user_id", user.id)
          .eq("episode_id", episode.id)
          .maybeSingle();

        const { error: watchError } = await supabase.from("watch_status").upsert(
          {
            user_id: user.id,
            episode_id: episode.id,
            watch_count: (existingWatch?.watch_count ?? 0) + 1,
            watched_at: new Date().toISOString(),
          },
          { onConflict: "user_id,episode_id" },
        );
        if (watchError) throw watchError;

        qc.invalidateQueries({ queryKey: ["watched", user.id, show.id] });
        qc.invalidateQueries({ queryKey: ["home-schedule", user.id] });
        toast.success("Marqué comme vu");
      } catch {
        toast.error("Impossible de reprendre votre action précédente");
      }
    })();
  }, [user, qc]);
}
