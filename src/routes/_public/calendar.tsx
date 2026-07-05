import { createFileRoute, Link } from "@tanstack/react-router";
import { BackButton } from "@/components/back-button";
import { useAuth } from "@/hooks/use-auth";
import { useCalendarTimeline } from "@/hooks/use-calendar-timeline";
import { CalendarTimelineList } from "@/components/home/calendar-timeline";
import { NoShowsPanel } from "@/components/home/empty-states";

export const Route = createFileRoute("/_public/calendar")({
  component: CalendarScreen,
});

function CalendarScreen() {
  const { user } = useAuth();
  const timeline = useCalendarTimeline();

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

      <div className="mt-6 pb-10">
        {!user ? (
          <div className="mx-5 rounded-xl border border-dashed border-border bg-transparent p-6 text-center">
            <p className="font-counter text-[11px] uppercase tracking-widest text-muted-foreground">
              Connexion requise
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Créez un compte pour construire votre calendrier à partir des séries que vous suivez.
            </p>
            <Link
              to="/auth"
              className="mt-4 inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground"
            >
              Se connecter / Créer un compte
            </Link>
          </div>
        ) : !timeline.isLoading && !timeline.hasFollowedShows ? (
          <NoShowsPanel />
        ) : (
          <CalendarTimelineList timeline={timeline} />
        )}
      </div>
    </>
  );
}
