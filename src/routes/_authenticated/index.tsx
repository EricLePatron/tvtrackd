import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Play } from "lucide-react";
import { ScreenHeader } from "@/components/screen-header";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/")({
  component: HomeScreen,
});

type UpcomingEp = {
  id: number;
  season_number: number;
  episode_number: number;
  title: string | null;
  air_date: string | null;
  show: {
    id: number;
    tmdb_id: number;
    media_type: string;
    title: string;
    poster_path: string | null;
  };
};

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function formatDate(d: string | null) {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function HomeScreen() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["home-schedule", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Followed shows (active statuses)
      const { data: us } = await supabase
        .from("user_shows")
        .select("show_id")
        .eq("user_id", user!.id)
        .in("status", ["a_voir", "en_cours"]);
      const showIds = (us ?? []).map((r) => r.show_id);
      if (!showIds.length) return { tonight: null, upcoming: [] as UpcomingEp[] };

      const past = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
      const future = new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString().slice(0, 10);

      const { data: eps } = await supabase
        .from("episodes")
        .select(
          "id, season_number, episode_number, title, air_date, show:shows!inner(id, tmdb_id, media_type, title, poster_path)",
        )
        .in("show_id", showIds)
        .not("air_date", "is", null)
        .gte("air_date", past)
        .lte("air_date", future)
        .order("air_date", { ascending: true });

      const episodes = (eps ?? []) as unknown as UpcomingEp[];
      const epIds = episodes.map((e) => e.id);
      const { data: watched } = epIds.length
        ? await supabase
            .from("watch_status")
            .select("episode_id")
            .eq("user_id", user!.id)
            .in("episode_id", epIds)
        : { data: [] };
      const watchedSet = new Set((watched ?? []).map((w) => w.episode_id));

      const unwatched = episodes.filter((e) => !watchedSet.has(e.id));
      const today = new Date().toISOString().slice(0, 10);
      const tonight =
        unwatched.find((e) => (e.air_date ?? "") <= today) ??
        unwatched[0] ??
        null;
      const upcoming = unwatched.filter((e) => e.id !== tonight?.id);

      return { tonight, upcoming };
    },
  });

  const tonight = data?.tonight;
  const upcoming = data?.upcoming ?? [];

  return (
    <>
      <ScreenHeader eyebrow="Ce soir" title="Programme">
        Vos prochaines diffusions, en un coup d'œil.
      </ScreenHeader>

      {/* Ticket stub */}
      <div className="mx-5">
        {isLoading ? (
          <div className="h-40 animate-pulse rounded-xl bg-card" />
        ) : tonight ? (
          <Link
            to="/show/$mediaType/$tmdbId"
            params={{
              mediaType: tonight.show.media_type,
              tmdbId: String(tonight.show.tmdb_id),
            }}
            className="relative block overflow-hidden rounded-xl border border-border bg-card"
          >
            {/* Perforation notches */}
            <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-background" />
            <span className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 h-4 w-4 rounded-full bg-background" />

            <div className="flex gap-4 p-4">
              <div className="h-24 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-surface-elevated">
                {tonight.show.poster_path && (
                  <img
                    src={tonight.show.poster_path}
                    alt={tonight.show.title}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-counter text-[10px] uppercase tracking-[0.25em] text-primary">
                  À voir · {formatDate(tonight.air_date)}
                </p>
                <h2 className="mt-1 font-display text-lg leading-tight text-foreground truncate">
                  {tonight.show.title}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground truncate">
                  {tonight.title ?? "—"}
                </p>
                <div className="mt-3 flex items-center justify-between rounded-md bg-surface-elevated px-3 py-1.5">
                  <span className="font-counter text-sm tracking-widest text-secondary">
                    S{pad(tonight.season_number)} E{pad(tonight.episode_number)}
                  </span>
                  <Play className="h-4 w-4 text-primary" />
                </div>
              </div>
            </div>
            <div className="border-t border-dashed border-border px-4 py-2">
              <p className="font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
                Nightframe · Ticket #{pad(tonight.id % 100)}
              </p>
            </div>
          </Link>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-transparent p-6 text-center">
            <Calendar className="mx-auto h-5 w-5 text-muted-foreground" />
            <p className="mt-3 font-counter text-[11px] uppercase tracking-widest text-muted-foreground">
              Rien ce soir
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Suivez une série pour voir le calendrier s'animer.
            </p>
          </div>
        )}
      </div>

      {/* Programme rail */}
      <div className="mt-8">
        <div className="mb-3 flex items-baseline justify-between px-5">
          <h3 className="font-display text-sm uppercase tracking-widest text-foreground">
            Programme
          </h3>
          <span className="font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
            {pad(upcoming.length)} à venir
          </span>
        </div>
        {upcoming.length === 0 ? (
          <p className="px-5 text-xs text-muted-foreground">Aucun épisode planifié.</p>
        ) : (
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-4">
            {upcoming.map((e) => (
              <Link
                key={e.id}
                to="/show/$mediaType/$tmdbId"
                params={{
                  mediaType: e.show.media_type,
                  tmdbId: String(e.show.tmdb_id),
                }}
                className="w-32 shrink-0 snap-start"
              >
                <div className="aspect-[2/3] overflow-hidden rounded-md border border-border bg-surface-elevated">
                  {e.show.poster_path && (
                    <img
                      src={e.show.poster_path}
                      alt={e.show.title}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <p className="mt-1.5 line-clamp-1 text-xs text-foreground">{e.show.title}</p>
                <div className="flex items-baseline justify-between font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
                  <span className="text-primary">
                    S{pad(e.season_number)}E{pad(e.episode_number)}
                  </span>
                  <span>{formatDate(e.air_date)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
