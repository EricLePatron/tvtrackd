import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";

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

/**
 * Cas 3 — rien à voir maintenant, mais une sortie à venir : n'a plus de
 * composant dédié. La Home rend directement le bloc "Bientôt" partagé
 * (`NextReleaseHeroCard`, un seul item en grand format, alimenté par
 * `selectNextReleases`) depuis `HomeContent` (index.tsx) pour cet état — le
 * même gabarit que celui utilisé sous le hero en état `normal`, plutôt qu'un
 * troisième template dédié (ex-`NothingNowCountdownTicket`/`AwaitedHeroCard`/
 * `AwaitedShowsList`/`AwaitedRow`, retirés).
 */

/** Cas 4 — file d'attente active (Zone A pleine), rien de programmé en Zone B. */
export function NothingScheduledNotice() {
  return <p className="px-5 text-xs text-muted-foreground">Rien de prévu pour l'instant.</p>;
}
