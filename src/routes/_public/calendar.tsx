import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BackButton } from "@/components/back-button";
import { ProfileLink } from "@/components/screen-header";
import { useAuth } from "@/hooks/use-auth";
import { useCalendarTimeline } from "@/hooks/use-calendar-timeline";
import { CalendarTimelineList } from "@/components/home/calendar-timeline";
import { CalendarWeekView } from "@/components/home/calendar-week-view";
import { NoShowsPanel } from "@/components/home/empty-states";
import { SITE_URL } from "@/lib/app-config";
import { fetchPublicCalendar } from "@/hooks/use-public-calendar";
import { PublicCalendarPanel } from "@/components/home/public-calendar-panel";

export const Route = createFileRoute("/_public/calendar")({
  component: CalendarScreen,
  // Toujours exécuté, connecté ou non : la route ne peut pas savoir côté
  // serveur si le visiteur est authentifié (session résolue côté client via
  // `useAuth`, cf. `_authenticated/route.tsx` qui reste `ssr:false` pour
  // cette raison) — un visiteur connecté paie donc un préchargement inutilisé
  // (silencieusement ignoré au rendu), acceptable : appel léger, mis en cache
  // côté edge function (`Cache-Control`) et react-query (`staleTime`).
  //
  // Best-effort strict (QA bloquant #1) : ce calendrier public généraliste
  // ne doit JAMAIS pouvoir faire planter la route — en particulier pour un
  // utilisateur CONNECTÉ dont le calendrier personnalisé (`useCalendarTimeline`,
  // totalement indépendant de cet appel) n'a rien à voir avec ce fetch. Un
  // throw ici remonterait à l'errorComponent du root faute d'errorComponent
  // local, remplaçant tout l'app shell (bottom nav comprise) par un écran
  // d'erreur générique — inacceptable pour une feature annexe. `null` en cas
  // d'échec ; `PublicCalendarPanel`/`usePublicCalendar` gèrent déjà
  // `isLoading`/`isError` côté client (refetch normal, pas de blocage).
  loader: async () => {
    try {
      return await fetchPublicCalendar();
    } catch (err) {
      console.error("[calendar loader] fetchPublicCalendar failed (best-effort, ignored)", err);
      return null;
    }
  },
  head: () => ({
    meta: [
      {
        title: "Calendrier des sorties séries — Programme de la semaine — tvtrackd",
      },
      {
        name: "description",
        content:
          "Le calendrier des séries en diffusion cette semaine et des nouveaux épisodes du jour. Connectez-vous pour un calendrier personnalisé des séries que vous suivez.",
      },
      { property: "og:title", content: "Calendrier des sorties séries — tvtrackd" },
      {
        property: "og:description",
        content: "Séries en diffusion cette semaine et nouveaux épisodes du jour.",
      },
      { property: "og:url", content: `${SITE_URL}/calendar` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/calendar` }],
  }),
});

function CalendarScreen() {
  const { user } = useAuth();
  const timeline = useCalendarTimeline();
  const loaderData = Route.useLoaderData();
  const [mode, setMode] = useState<"timeline" | "week">("timeline");

  return (
    <>
      <div className="flex items-center gap-3 px-5 pt-6">
        <BackButton fallbackTo="/" />

        <div className="min-w-0 flex-1">
          <p className="font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
            Calendrier
          </p>
          <h1 className="font-display text-lg text-foreground">
            {user ? "Programme à venir" : "Programme de la semaine"}
          </h1>
        </div>
        {user && <ProfileLink />}
      </div>

      <div className="mt-6 pb-10">
        {!user ? (
          <>
            <PublicCalendarPanel initialData={loaderData ?? undefined} />
            <div className="mx-5 mt-8 rounded-xl border border-dashed border-border bg-transparent p-6 text-center">
              <p className="font-counter text-[11px] uppercase tracking-widest text-muted-foreground">
                Connexion requise
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Créez un compte pour construire votre calendrier à partir des séries que vous
                suivez.
              </p>
              <Link
                to="/auth"
                className="mt-4 inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground"
              >
                Se connecter / Créer un compte
              </Link>
            </div>
          </>
        ) : !timeline.isLoading && !timeline.hasFollowedShows ? (
          <NoShowsPanel />
        ) : (
          <>
            {/* Bascule vue continue (timeline) / vue semaine par semaine —
                mêmes données, deux modes de lecture. */}
            <div className="mb-6 flex gap-1 rounded-full border border-border bg-surface p-1 mx-5 w-fit">
              {(
                [
                  ["timeline", "Continu"],
                  ["week", "Semaine"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  aria-pressed={mode === value}
                  className={`rounded-full px-4 py-1.5 font-counter text-[11px] uppercase tracking-widest transition-colors ${
                    mode === value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {mode === "timeline" ? (
              <CalendarTimelineList timeline={timeline} />
            ) : (
              <CalendarWeekView timeline={timeline} />
            )}
          </>
        )}
      </div>
    </>
  );
}
