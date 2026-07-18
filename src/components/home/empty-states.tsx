import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import type { ShowLite, ScheduleEpisode } from "@/lib/schedule";
import { formatCountdownLabel } from "@/lib/schedule";

/** Cas 1 — aucune série suivie : import / recherche. */
export function NoShowsPanel() {
  return (
    <div className="mx-5">
      <div className="rounded-xl border border-dashed border-border bg-transparent p-6 text-center">
        <p className="font-counter text-[11px] uppercase tracking-widest text-muted-foreground">
          Aucune série suivie
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Importez votre historique ou cherchez une série pour démarrer.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Link
            to="/profile"
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Importer mon historique
          </Link>
          <Link
            to="/search"
            className="inline-flex h-11 items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground"
          >
            Chercher une série
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Cas 2 — tout vu, rien de programmé : bannière de confirmation. */
export function AllCaughtUpBanner() {
  return (
    <div className="mx-5">
      <div className="flex items-center gap-3 rounded-xl border border-cyan-accent/40 bg-cyan-accent/10 px-4 py-3.5">
        <Check className="h-4 w-4 shrink-0 text-cyan-accent" />
        <div>
          <p className="font-counter text-[11px] uppercase tracking-widest text-cyan-accent">
            À jour
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Rien de neuf pour l'instant — tout est marqué vu.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Cas 3 — rien maintenant, mais une prochaine sortie connue : ticket vide + compte à rebours. */
export function NothingNowCountdownTicket({
  countdown,
}: {
  countdown: { show: ShowLite; episode: ScheduleEpisode; daysUntil: number };
}) {
  // Formulation alignée sur la fiche série (référence) via `formatCountdownLabel`
  // — "aujourd'hui"/"demain"/"dans Nj" est déjà une phrase autonome, donc pas
  // de "dans" en dur ici (sinon "Prochain épisode dans dans 3 j").
  const dayLabel = formatCountdownLabel(countdown.daysUntil);
  return (
    <div className="mx-5">
      <div className="rounded-xl border border-dashed border-border bg-transparent p-6 text-center">
        {/* Cyan, pas ambre — même sémantique que NextEpisodeCard sur la fiche
            série (anticipation/info, pas une action) ; seul accent de
            couleur de ce ticket, rien d'autre à basculer ici. */}
        <p className="font-counter text-[11px] uppercase tracking-widest text-cyan-accent">
          Prochain épisode {dayLabel}
        </p>
        <p className="mt-2 font-display text-lg text-foreground">{countdown.show.title}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Rien à regarder ce soir — la suite arrive bientôt.
        </p>
      </div>
    </div>
  );
}

/** Cas 4 — file d'attente active (Zone A pleine), rien de programmé en Zone B. */
export function NothingScheduledNotice() {
  return <p className="px-5 text-xs text-muted-foreground">Rien de prévu pour l'instant.</p>;
}
