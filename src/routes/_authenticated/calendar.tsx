import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  addDaysToDateString,
  bucketUpcoming,
  groupUpcomingByDay,
  type ScheduleEpisode,
} from "@/lib/schedule";
import { UpcomingBucketRails, PlusTardSummary } from "@/components/home/upcoming-section";

export const Route = createFileRoute("/_authenticated/calendar")({
  component: CalendarScreen,
});

function CalendarScreen() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["calendar-upcoming", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);

      const { data: us } = await supabase
        .from("user_shows")
        .select("show_id")
        .eq("user_id", user!.id)
        .in("status", ["a_voir", "en_cours"]);
      const showIds = (us ?? []).map((r) => r.show_id);

      if (!showIds.length) {
        return { today, dayGroups: [] };
      }

      const future = addDaysToDateString(today, 90);

      const { data: eps } = await supabase
        .from("episodes")
        .select(
          "id, season_number, episode_number, title, air_date, show:shows!inner(id, tmdb_id, media_type, title, poster_path)",
        )
        .in("show_id", showIds)
        .not("air_date", "is", null)
        .gt("air_date", today)
        .lte("air_date", future)
        .order("air_date", { ascending: true });

      const episodes = (eps ?? []) as unknown as ScheduleEpisode[];
      const dayGroups = groupUpcomingByDay(episodes, today, 90);

      return { today, dayGroups };
    },
  });

  const buckets = data ? bucketUpcoming(data.dayGroups, data.today) : null;

  return (
    <>
      <div className="flex items-center gap-3 px-5 pt-6">
        <Link
          to="/"
          className="rounded-full border border-border bg-card p-2 text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <p className="font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
            Calendrier
          </p>
          <h1 className="font-display text-lg text-foreground">Programme à venir</h1>
        </div>
      </div>

      <div className="mt-6 space-y-8 px-5 pb-10">
        {isLoading || !data || !buckets ? (
          <div className="h-40 animate-pulse rounded-xl bg-card" />
        ) : buckets.demain.length === 0 &&
          buckets.cetteSemaine.length === 0 &&
          buckets.plusTard.length === 0 ? (
          <p className="text-center font-counter text-[11px] uppercase tracking-widest text-muted-foreground">
            Aucun épisode planifié.
          </p>
        ) : (
          <>
            <UpcomingBucketRails
              label="Demain"
              groups={buckets.demain}
              today={data.today}
              saturated
            />
            <UpcomingBucketRails
              label="Cette semaine"
              groups={buckets.cetteSemaine}
              today={data.today}
              saturated
            />
            <PlusTardSummary groups={buckets.plusTard} />
          </>
        )}
      </div>
    </>
  );
}
