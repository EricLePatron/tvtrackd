import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { BackButton } from "@/components/back-button";
import { useAuth } from "@/hooks/use-auth";
import { useCalendarTimeline } from "@/hooks/use-calendar-timeline";
import { useCalendarWeek } from "@/hooks/use-calendar-week";
import { CalendarTimelineList } from "@/components/home/calendar-timeline";
import { CalendarWeekGrid } from "@/components/home/calendar-week-grid";
import { CalendarViewToggle } from "@/components/home/calendar-view-toggle";
import { NoShowsPanel } from "@/components/home/empty-states";
import { getMondayOfWeek, addDaysToDateString } from "@/lib/schedule";
import {
  getCalendarViewPreference,
  setCalendarViewPreference,
  type CalendarViewPreference,
} from "@/lib/client-storage";

const calendarSearchSchema = z.object({
  view: z.enum(["agenda", "semaine"]).optional(),
});

export const Route = createFileRoute("/_public/calendar")({
  // Wrapped in try/catch rather than passing `calendarSearchSchema` directly
  // — same defensive pattern as `/auth` (see `auth.tsx`): a malformed
  // `?view=` should never take down the whole screen, just fall back to no
  // explicit override (→ the localStorage/default resolution below).
  validateSearch: (search: Record<string, unknown>) => {
    try {
      return calendarSearchSchema.parse(search);
    } catch {
      return {};
    }
  },
  component: CalendarScreen,
});

function CalendarScreen() {
  const { user } = useAuth();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const timeline = useCalendarTimeline();

  // SSR-safe default: the route is server-rendered, so the first paint (and
  // pre-hydration client render) can never read localStorage — both always
  // resolve to "agenda" unless an explicit `?view=` is present, avoiding a
  // hydration mismatch. A returning visitor with a stored "semaine"
  // preference may see a brief Agenda→Semaine flash right after hydration
  // (see effect below) — accepted tradeoff, not fixed here.
  const [view, setView] = useState<CalendarViewPreference>(search.view ?? "agenda");

  useEffect(() => {
    if (search.view) return; // explicit URL override always wins over localStorage
    const stored = getCalendarViewPreference();
    if (stored && stored !== view) setView(stored);
    // Only meant to run once, right after hydration — intentionally not
    // re-running on every `search.view`/`view` change (that's handled by the
    // toggle handler and the branch above instead).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [weekStart, setWeekStart] = useState(() => getMondayOfWeek(timeline.today));
  const week = useCalendarWeek(weekStart, { enabled: view === "semaine" });

  function handleToggle(next: CalendarViewPreference) {
    setView(next);
    setCalendarViewPreference(next);
    // `replace: true` — an explicit view toggle shouldn't push a history
    // entry: `BackButton` above uses `router.history.back()`, and a pushed
    // entry per tap would turn "Retour" into "undo last toggle" instead of
    // leaving the /calendar screen.
    navigate({ search: (prev) => ({ ...prev, view: next }), replace: true });
  }

  const showToggleAndContent = !!user && (timeline.isLoading || timeline.hasFollowedShows);

  return (
    <>
      <div className="flex items-center justify-between gap-3 px-5 pt-6">
        <div className="flex items-center gap-3">
          <BackButton fallbackTo="/" />

          <div>
            <p className="font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
              Calendrier
            </p>
            <h1 className="font-display text-lg text-foreground">Programme à venir</h1>
          </div>
        </div>

        {showToggleAndContent && <CalendarViewToggle view={view} onToggle={handleToggle} />}
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
        ) : view === "semaine" ? (
          <CalendarWeekGrid
            week={week}
            today={timeline.today}
            onPrevWeek={() => setWeekStart((s) => addDaysToDateString(s, -7))}
            onNextWeek={() => setWeekStart((s) => addDaysToDateString(s, 7))}
            onToday={() => setWeekStart(getMondayOfWeek(timeline.today))}
          />
        ) : (
          <CalendarTimelineList timeline={timeline} />
        )}
      </div>
    </>
  );
}
