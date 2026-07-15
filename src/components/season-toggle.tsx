import { Check } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const BUTTON_BASE_CLASSES =
  "mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-md border border-border bg-surface-elevated px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

/**
 * Action pleine largeur pour marquer/démarquer une saison entière vue/non
 * vue (fiche série — refonte "accordéons de saison", cf.
 * `docs/design/fiche-serie-mockup.html` `.mark-all`). Toute la logique
 * tri-state hérite de l'ancien bouton-icône rond : seul l'habillage change
 * (bouton pleine largeur à libellé explicite), pas le comportement ni les
 * mutations (`onMark`/`onUnmark`, dialogue de confirmation au démarquage).
 *
 * - Non coché -> "Marquer la saison comme vue".
 * - Indéterminé (une partie déjà vue) -> "Marquer le reste de la saison
 *   comme vue" (même action `onMark`, libellé plus précis).
 * - Coché (saison entièrement vue) -> "Démarquer la saison", avec
 *   confirmation car ça supprime l'historique de rewatch de toute la
 *   saison.
 *
 * Le libellé visible porte lui-même l'information d'état : pas de
 * `aria-pressed`/`aria-label` séparé ici (pertinent seulement pour l'ancien
 * bouton-icône sans texte).
 */
export function SeasonToggle({
  seasonNumber,
  state,
  disabled,
  onMark,
  onUnmark,
}: {
  seasonNumber: number;
  state: boolean | "indeterminate";
  disabled: boolean;
  onMark: () => void;
  onUnmark: () => void;
}) {
  if (state === true) {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              BUTTON_BASE_CLASSES,
              "border-cyan-accent/40 bg-cyan-accent/10 text-cyan-accent hover:text-cyan-accent",
            )}
          >
            <Check className="h-3.5 w-3.5" />
            Démarquer la saison
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Démarquer la saison {seasonNumber} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Ça supprime l'historique de visionnage de tous les épisodes de cette saison, y compris
              les revisionnages. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={onUnmark}
              className={cn(buttonVariants({ variant: "destructive" }))}
            >
              Démarquer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <button type="button" disabled={disabled} onClick={onMark} className={BUTTON_BASE_CLASSES}>
      <Check className="h-3.5 w-3.5 opacity-60" />
      {state === "indeterminate"
        ? "Marquer le reste de la saison comme vue"
        : "Marquer la saison comme vue"}
    </button>
  );
}
