import { ShareWatchDialog } from "@/components/share-watch-dialog";
import { useAuth } from "@/hooks/use-auth";
import { APP_NAME, SITE_URL } from "@/lib/app-config";
import { WEEKLY_RECAP_MIN_EPISODES, useWeeklyRecap } from "@/lib/weekly-recap";

/**
 * Bloc « Ma semaine » sous le Programme : visible dès 3 épisodes vus depuis
 * lundi. Sobre : le nombre en Plex Mono (compteur), un seul bouton de partage.
 */
export function WeeklyRecapBlock() {
  const { user } = useAuth();
  const { data: recap } = useWeeklyRecap(user?.id);

  if (!user || !recap || recap.episodes < WEEKLY_RECAP_MIN_EPISODES) return null;

  return (
    <section className="mt-8 px-5" aria-label="Ma semaine">
      <h2 className="font-display text-xl font-bold text-foreground">Ma semaine</h2>
      <div className="mt-3 rounded-xl border border-white/[0.07] bg-surface-elevated p-4">
        <p className="font-counter text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {recap.rangeLabel}
        </p>
        <p className="mt-1 flex items-baseline gap-2">
          <span className="font-counter text-4xl font-semibold tabular-nums text-cyan-accent">
            {recap.episodes}
          </span>
          <span className="text-sm text-muted-foreground">
            épisode{recap.episodes > 1 ? "s" : ""} vu{recap.episodes > 1 ? "s" : ""}
          </span>
        </p>
        <ShareWatchDialog
          triggerVariant="button"
          triggerLabel="Partager ma semaine"
          card={{
            kind: "week",
            rangeLabel: recap.rangeLabel,
            episodes: recap.episodes,
            posterUrls: recap.topShows
              .map((s) => s.posterPath)
              .filter((u): u is string => !!u)
              .slice(0, 4),
          }}
          previewAlt={`Ma semaine : ${recap.episodes} épisodes vus, ${recap.rangeLabel}`}
          shareUrl={SITE_URL}
          caption={`Ma semaine sur ${APP_NAME} : ${recap.episodes} épisodes vus`}
        />
      </div>
    </section>
  );
}
